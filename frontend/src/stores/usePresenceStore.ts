import { create } from 'zustand';
import type { PresenceUser, Tool } from '../types';
import { throttle } from '../utils';
import { DEMO_USERS } from '../data/demo';
import { useBoardStore } from './useBoardStore';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'offline';
export type PresenceMode = 'live' | 'simulated' | 'none';

interface PresenceState {
  users: PresenceUser[];
  status: ConnectionStatus;
  mode: PresenceMode;
  socket: unknown;
  connect: (boardId: string) => void;
  disconnect: () => void;
  updateLocalCursor: (x: number, y: number, tool: Tool) => void;
  addUser: (user: Omit<PresenceUser, 'isLocal'>) => void;
  addLocalUser: (user: Omit<PresenceUser, 'isLocal'>) => void;
  removeUser: (id: string) => void;
  setStatus: (status: ConnectionStatus) => void;
  setMode: (mode: PresenceMode) => void;
}

const WAYPOINTS: Array<[number, number]> = [
  [-880, -90], [-660, -90], [-410, -90], [-240, -30], [-325, 130], [-410, 260], [-170, -90],
  [160, -180], [200, -30], [-40, 250], [-600, -30], [-760, -60], [-880, -140], [-880, -90],
];

const PRESENCE_COLORS = ['#d9480f', '#2f9e44', '#1971c2', '#e8590c', '#7048e8', '#0c8599'];

interface SocketLike {
  id?: string;
  close: () => void;
  emit: (event: string, payload: unknown) => void;
  on: (event: string, fn: (...args: unknown[]) => void) => void;
  once: (event: string, fn: (...args: unknown[]) => void) => void;
}

interface RemotePresenceUser {
  id: string | number;
  userId?: string | number;
  name: string;
  color?: string;
  cursor?: PresenceUser['cursor'];
}

interface CursorPayload {
  id: string | number;
  userId?: string | number;
  x: number;
  y: number;
  tool: Tool;
}

/** Resolves a collaborator's real name from the board member profiles. */
export function profileNameFor(userId?: string | number): string | null {
  if (userId === undefined || userId === null) return null;
  const members = useBoardStore.getState().board?.members ?? [];
  const member = members.find((m) => m.id === String(userId));
  const name = member?.name;
  return name && name !== 'User' ? name : null;
}

function makeSimulatedUsers(): PresenceUser[] {
  return DEMO_USERS.slice(1).map((u, i) => ({
    id: u.id,
    name: u.name,
    color: u.color,
    cursor: { x: WAYPOINTS[i % WAYPOINTS.length][0], y: WAYPOINTS[i % WAYPOINTS.length][1], tool: 'select' as Tool },
    lastSeen: Date.now(),
    isLocal: false,
  }));
}

export const usePresenceStore = create<PresenceState>((set, get) => {
  let simTimer: ReturnType<typeof setInterval> | null = null;
  let activeBoardId: string | null = null;
  const simOffsets: Record<string, number> = {};
  const waypointIndex: Record<string, number> = {};

  const toLiveBoardId = (boardId: string): number | null => {
    if (!/^\d+$/.test(boardId)) return null;
    const parsed = Number(boardId);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  };

  const remoteColor = (index: number) => PRESENCE_COLORS[index % PRESENCE_COLORS.length] ?? PRESENCE_COLORS[0];

  const normalizeRemoteUser = (user: RemotePresenceUser, index: number): PresenceUser => ({
    id: String(user.id),
    name: user.name || profileNameFor(user.userId) || 'User',
    color: user.color ?? remoteColor(index),
    // board:users payloads carry no cursor — render nothing until the first
    // cursor:update arrives instead of spawning a phantom arrow at (0,0).
    ...(user.cursor ? { cursor: user.cursor, lastSeen: Date.now() } : {}),
    isLocal: false,
  });

  const setRemoteUsers = (remoteUsers: RemotePresenceUser[], selfSocketId?: string) => {
    set((s) => {
      const localUsers = s.users.filter((u) => u.isLocal);
      const remotes = remoteUsers
        .filter((u) => String(u.id) !== selfSocketId)
        .map((u, index) => normalizeRemoteUser(u, index));
      return { users: [...localUsers, ...remotes] };
    });
  };

  const startSimulation = () => {
    const users = makeSimulatedUsers();
    users.forEach((u, i) => {
      simOffsets[u.id] = i * 137 + 20;
      waypointIndex[u.id] = i;
    });
    set((s) => ({
      users: [...s.users.filter((u) => u.isLocal), ...users],
      mode: 'simulated',
      status: 'connected',
      socket: null,
    }));

    if (simTimer) clearInterval(simTimer);
    simTimer = setInterval(() => {
      set((s) => ({
        users: s.users.map((u) => {
          if (u.isLocal || !u.cursor) return u;
          const idx = waypointIndex[u.id] ?? 0;
          const target = WAYPOINTS[idx % WAYPOINTS.length];
          const offset = simOffsets[u.id] ?? 0;
          const wobble = Math.sin(Date.now() / 900 + offset) * 6;
          const dx = target[0] - u.cursor.x;
          const dy = target[1] - u.cursor.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 6) waypointIndex[u.id] = idx + 1;
          return {
            ...u,
            cursor: {
              x: u.cursor.x + dx * 0.06 + wobble * 0.02,
              y: u.cursor.y + dy * 0.06,
              tool: Math.sin(Date.now() / 5000 + offset) > 0.6 ? 'pen' : 'select',
            },
            lastSeen: Date.now(),
          };
        }),
      }));
    }, 90);
  };

  const stopSimulation = () => {
    if (simTimer) {
      clearInterval(simTimer);
      simTimer = null;
    }
  };

  const broadcastCursor = throttle((x: number, y: number, tool: Tool) => {
    const { socket, mode, users } = get();
    const local = users.find((u) => u.isLocal);
    const boardId = activeBoardId ? toLiveBoardId(activeBoardId) : null;
    if (!local || !boardId) return;
    if (mode === 'live' && socket) {
      (socket as { emit: (e: string, p: unknown) => void }).emit('cursor:update', {
        boardId,
        x, y, tool,
      });
    }
  }, 50);

  return {
    users: [],
    status: 'idle',
    mode: 'none',
    socket: null,

    connect: async (boardId) => {
      const { status } = get();
      if ((status === 'connecting' || status === 'connected') && activeBoardId === boardId) return;
      activeBoardId = boardId;
      set({ status: 'connecting' });

      const liveBoardId = toLiveBoardId(boardId);
      const { io } = await import('socket.io-client');
      const token = localStorage.getItem('vb_token');
      if (!token || !liveBoardId) {
        stopSimulation();
        startSimulation();
        return;
      }

      const socket = io(import.meta.env.VITE_SOCKET_URL || undefined, {
        transports: ['websocket', 'polling'],
        auth: { token },
        timeout: 2500,
      });

      const fail = () => {
        socket.close();
        stopSimulation();
        startSimulation();
      };

      socket.on('connect', () => {
        set({ status: 'connected', mode: 'live', socket });
        socket.emit('board:join', { boardId: liveBoardId });
      });

      socket.on('connect_error', () => {
        set({ status: 'offline' });
        stopSimulation();
        startSimulation();
      });

      socket.on('board:users', (users: RemotePresenceUser[]) => {
        setRemoteUsers(Array.isArray(users) ? users : [], (socket as SocketLike).id);
      });
      socket.on('user:join', (user: RemotePresenceUser) => {
        if (String(user.id) !== (socket as SocketLike).id) get().addUser(normalizeRemoteUser(user, get().users.length));
      });
      socket.on('user:leave', ({ id }: { id: string | number }) => get().removeUser(String(id)));
      socket.on('cursor:update', (payload: CursorPayload) => {
        set((s) => ({
          users: s.users.some((u) => !u.isLocal && (u.id === String(payload.id) || u.id === String(payload.userId)))
            ? s.users.map((u) =>
                !u.isLocal && (u.id === String(payload.id) || u.id === String(payload.userId))
                  ? {
                      ...u,
                      // Upgrade placeholder names with the real profile name.
                      name: u.name === 'User' ? (profileNameFor(payload.userId) ?? 'User') : u.name,
                      cursor: { x: payload.x, y: payload.y, tool: payload.tool },
                      lastSeen: Date.now(),
                    }
                  : u,
              )
            : [
                ...s.users,
                {
                  id: String(payload.id),
                  name: profileNameFor(payload.userId) ?? 'User',
                  color: remoteColor(s.users.length),
                  cursor: { x: payload.x, y: payload.y, tool: payload.tool },
                  lastSeen: Date.now(),
                  isLocal: false,
                },
              ],
        }));
      });

      const timeout = setTimeout(fail, 3000);
      socket.once('connect', () => clearTimeout(timeout));
    },

    disconnect: () => {
      const { socket } = get();
      if (socket) (socket as SocketLike).close();
      stopSimulation();
      activeBoardId = null;
      set((s) => ({ users: s.users.filter((u) => u.isLocal), status: 'idle', mode: 'none', socket: null }));
    },

    updateLocalCursor: (x, y, tool) => {
      set((s) => ({
        users: s.users.map((u) => (u.isLocal ? { ...u, cursor: { x, y, tool }, lastSeen: Date.now() } : u)),
      }));
      broadcastCursor(x, y, tool);
    },

    addUser: (user) =>
      set((s) => {
        if (s.users.some((u) => u.id === user.id)) return s;
        const { name, cursor, color, ...rest } = user;
        return {
          users: [
            ...s.users,
            {
              ...rest,
              name,
              color: color ?? PRESENCE_COLORS[(s.users.length + s.users.filter((u) => !u.isLocal).length) % PRESENCE_COLORS.length],
              // Remote arrivals may have no cursor yet — keep it undefined so
              // the overlay does not paint a phantom arrow at the origin.
              cursor,
              isLocal: false,
            },
          ],
        };
      }),

    // The board's own presence entry. MUST be isLocal: true — every other
    // feature keys off it (cursor emission guard, updateLocalCursor, remote
    // merge filters), and a false flag here silently breaks live cursors for
    // everyone (nobody broadcasts cursor:update).
    addLocalUser: (user) =>
      set((s) => {
        if (s.users.some((u) => u.isLocal)) return s;
        return {
          users: [
            { ...user, color: user.color ?? PRESENCE_COLORS[0], isLocal: true },
            ...s.users.filter((u) => u.id !== user.id),
          ],
        };
      }),

    removeUser: (id) => set((s) => ({ users: s.users.filter((u) => u.id !== id) })),

    setStatus: (status) => set({ status }),
    setMode: (mode) => set({ mode }),
  };
});
