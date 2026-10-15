import { create } from 'zustand';
import { toast } from 'sonner';
import type { PresenceUser, Tool } from '../types';
import { colorForUser, throttleTrailing } from '../utils';
import { DEMO_USERS } from '../data/demo';
import { useBoardStore } from './useBoardStore';
import { useAuthStore } from './useAuthStore';
import { addLaserPoint, setLaserSender } from '../services/laser';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline';
export type PresenceMode = 'live' | 'simulated' | 'none';
export type BoardRole = 'owner' | 'editor' | 'viewer';

interface PresenceState {
  users: PresenceUser[];
  status: ConnectionStatus;
  mode: PresenceMode;
  socket: unknown;
  /** Board the socket has an acknowledged room membership for. */
  joinedBoardId: string | null;
  /** Role the server reported on join. */
  role: BoardRole | null;
  /** Authenticated user id (string) — used to recognise our own broadcasts. */
  selfUserId: string | null;
  connect: (boardId: string) => void;
  disconnect: () => void;
  rejoin: () => void;
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

interface SocketLike {
  id?: string;
  connected: boolean;
  io: { on: (event: string, fn: (...args: unknown[]) => void) => void };
  connect: () => void;
  close: () => void;
  disconnect: () => void;
  emit: (event: string, ...args: unknown[]) => void;
  timeout: (ms: number) => { emit: (event: string, payload: unknown, cb: (err: Error | null, res: JoinAck) => void) => void };
  on: (event: string, fn: (...args: never[]) => void) => void;
}

interface JoinAck {
  ok: boolean;
  role?: BoardRole;
  users?: RemotePresenceUser[];
  code?: string;
  message?: string;
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

const toLiveBoardId = (boardId: string): number | null => {
  if (!/^\d+$/.test(boardId)) return null;
  const parsed = Number(boardId);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

export const usePresenceStore = create<PresenceState>((set, get) => {
  let simTimer: ReturnType<typeof setInterval> | null = null;
  let activeBoardId: string | null = null;
  /** Bumped on every connect/disconnect so late async work can detect it is stale. */
  let generation = 0;
  let detachWindow: (() => void) | null = null;
  const simOffsets: Record<string, number> = {};
  const waypointIndex: Record<string, number> = {};

  const normalizeRemoteUser = (user: RemotePresenceUser): PresenceUser => ({
    id: String(user.id),
    name: user.name || profileNameFor(user.userId) || 'User',
    color: user.color ?? colorForUser(user.userId ?? user.id),
    // board:users payloads carry no cursor — render nothing until the first
    // cursor:update arrives instead of spawning a phantom arrow at (0,0).
    ...(user.cursor ? { cursor: user.cursor, lastSeen: Date.now() } : {}),
    isLocal: false,
  });

  const setRemoteUsers = (remoteUsers: RemotePresenceUser[], selfSocketId?: string) => {
    set((s) => ({
      users: [
        ...s.users.filter((u) => u.isLocal),
        ...remoteUsers.filter((u) => String(u.id) !== selfSocketId).map(normalizeRemoteUser),
      ],
    }));
  };

  /** Demo/preview boards only — real boards never show fabricated collaborators. */
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
          if (Math.hypot(dx, dy) < 6) waypointIndex[u.id] = idx + 1;
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

  // Leading + trailing: the final resting position is always delivered.
  const broadcastCursor = throttleTrailing((x: number, y: number, tool: Tool) => {
    const { socket, mode, joinedBoardId } = get();
    const boardId = joinedBoardId ? toLiveBoardId(joinedBoardId) : null;
    if (!boardId || mode !== 'live' || !socket) return;
    (socket as SocketLike).emit('cursor:update', { boardId, x, y, tool });
  }, 50);

  const join = (socket: SocketLike, boardId: string, gen: number) => {
    const liveId = toLiveBoardId(boardId);
    if (!liveId) return;
    socket.timeout(8_000).emit('board:join', { boardId: liveId }, (err, res) => {
      if (gen !== generation) return;
      if (err) {
        // No ack in time — try again while the socket is up.
        if (socket.connected) setTimeout(() => gen === generation && join(socket, boardId, gen), 1_000);
        return;
      }
      if (!res?.ok) {
        set({ status: 'offline', joinedBoardId: null });
        toast.error('Could not join the live session', { id: 'vb-join', description: res?.message });
        return;
      }
      setRemoteUsers(res.users ?? [], socket.id);
      set({ status: 'connected', mode: 'live', joinedBoardId: boardId, role: res.role ?? null });
      useBoardStore.getState().setCanEdit(res.role !== 'viewer');
    });
  };

  return {
    users: [],
    status: 'idle',
    mode: 'none',
    socket: null,
    joinedBoardId: null,
    role: null,
    selfUserId: null,

    connect: async (boardId) => {
      const { status } = get();
      if ((status === 'connecting' || status === 'connected' || status === 'reconnecting') && activeBoardId === boardId) return;
      const gen = ++generation;
      activeBoardId = boardId;
      const selfUserId = useAuthStore.getState().user?.id ?? null;
      set({ status: 'connecting', joinedBoardId: null, role: null, selfUserId });

      const liveBoardId = toLiveBoardId(boardId);
      const token = localStorage.getItem('vb_token');
      if (!token || !liveBoardId) {
        stopSimulation();
        startSimulation();
        return;
      }

      const { io } = await import('socket.io-client');
      // disconnect()/another connect() ran while the module was loading.
      if (gen !== generation) return;

      const socket = io(import.meta.env.VITE_SOCKET_URL || undefined, {
        transports: ['websocket', 'polling'],
        auth: { token },
        timeout: 8_000,
        // Exponential backoff with jitter; never gives up while the board is open.
        reconnection: true,
        reconnectionDelay: 500,
        reconnectionDelayMax: 10_000,
        randomizationFactor: 0.5,
      }) as unknown as SocketLike;

      set({ socket, mode: 'live' });

      socket.on('connect', () => {
        if (gen !== generation) return;
        set({ status: 'connecting' });
        join(socket, boardId, gen);
      });

      socket.on('disconnect', (reason: string) => {
        if (gen !== generation) return;
        // Remote presence is re-sent on rejoin; stale arrows would linger.
        set((s) => ({
          users: s.users.filter((u) => u.isLocal),
          joinedBoardId: null,
          // A client-side disconnect here only happens for the offline pause.
          status: reason === 'io client disconnect' ? 'offline' : 'reconnecting',
        }));
        // A server-initiated disconnect does not auto-reconnect in socket.io.
        if (reason === 'io server disconnect') socket.connect();
      });

      socket.on('connect_error', (err: Error) => {
        if (gen !== generation) return;
        if (err?.message === 'ERR_UNAUTHORIZED') {
          socket.disconnect();
          set({ status: 'offline' });
          toast.error('Your session has expired', { id: 'vb-auth', description: 'Sign in again to keep collaborating.' });
          return;
        }
        set({ status: 'reconnecting' });
      });

      socket.io.on('reconnect_attempt', () => {
        if (gen === generation && get().status !== 'connected') set({ status: 'reconnecting' });
      });

      socket.on('board:users', (users: RemotePresenceUser[]) => {
        if (gen === generation) setRemoteUsers(Array.isArray(users) ? users : [], socket.id);
      });
      socket.on('user:join', (user: RemotePresenceUser) => {
        if (gen === generation && String(user.id) !== socket.id) get().addUser(normalizeRemoteUser(user));
      });
      socket.on('user:leave', ({ id }: { id: string | number }) => {
        if (gen === generation) get().removeUser(String(id));
      });
      // Laser pointer relay (ephemeral). Throttled per frame by the caller.
      setLaserSender((p) => {
        const { joinedBoardId } = get();
        const live = joinedBoardId ? toLiveBoardId(joinedBoardId) : null;
        if (gen === generation && live && socket.connected) {
          (socket as unknown as { volatile: { emit: (e: string, v: unknown) => void } }).volatile.emit('laser:point', { boardId: live, ...p });
        }
      });
      socket.on('laser:point', (payload: { id: string; userId?: string | number; x: number; y: number; start?: boolean }) => {
        if (gen !== generation) return;
        const user = get().users.find((u) => u.id === String(payload.id));
        const color = user?.color ?? colorForUser(payload.userId ?? payload.id);
        addLaserPoint(String(payload.id), color, payload, user?.name ?? profileNameFor(payload.userId) ?? undefined, payload.start);
      });

      socket.on('cursor:update', (payload: CursorPayload) => {
        if (gen !== generation) return;
        const key = String(payload.id);
        set((s) => {
          const exists = s.users.some((u) => !u.isLocal && u.id === key);
          if (!exists) {
            return {
              users: [
                ...s.users,
                {
                  id: key,
                  name: profileNameFor(payload.userId) ?? 'User',
                  color: colorForUser(payload.userId ?? key),
                  cursor: { x: payload.x, y: payload.y, tool: payload.tool },
                  lastSeen: Date.now(),
                  isLocal: false,
                },
              ],
            };
          }
          return {
            users: s.users.map((u) =>
              !u.isLocal && u.id === key
                ? {
                    ...u,
                    // Upgrade placeholder names with the real profile name.
                    name: u.name === 'User' ? (profileNameFor(payload.userId) ?? 'User') : u.name,
                    cursor: { x: payload.x, y: payload.y, tool: payload.tool },
                    lastSeen: Date.now(),
                  }
                : u,
            ),
          };
        });
      });

      // The browser knows about network loss long before a heartbeat times
      // out (an established WebSocket can sit "open" on a dead link for the
      // whole ping window). Drop it immediately so edits queue visibly, and
      // reconnect the moment the network returns instead of waiting for the
      // next backoff tick.
      let pausedForOffline = false;
      const onOffline = () => {
        if (gen !== generation) return;
        pausedForOffline = true;
        socket.disconnect();
        set((s) => ({ users: s.users.filter((u) => u.isLocal), joinedBoardId: null, status: 'offline' }));
      };
      const onOnline = () => {
        if (gen !== generation) return;
        if (pausedForOffline || !socket.connected) {
          pausedForOffline = false;
          set({ status: 'reconnecting' });
          socket.connect();
        }
      };
      window.addEventListener('offline', onOffline);
      window.addEventListener('online', onOnline);
      detachWindow = () => {
        window.removeEventListener('offline', onOffline);
        window.removeEventListener('online', onOnline);
      };
    },

    disconnect: () => {
      generation++;
      setLaserSender(null);
      const { socket } = get();
      if (socket) (socket as SocketLike).close();
      detachWindow?.();
      detachWindow = null;
      stopSimulation();
      activeBoardId = null;
      set((s) => ({
        users: s.users.filter((u) => u.isLocal),
        status: 'idle',
        mode: 'none',
        socket: null,
        joinedBoardId: null,
        role: null,
      }));
    },

    rejoin: () => {
      const { socket } = get();
      if (!socket || !activeBoardId || !(socket as SocketLike).connected) return;
      set({ joinedBoardId: null });
      join(socket as SocketLike, activeBoardId, generation);
    },

    updateLocalCursor: (x, y, tool) => {
      // Only the outgoing broadcast needs the cursor; writing it into the store
      // re-rendered every presence consumer on every mouse move.
      broadcastCursor(x, y, tool);
    },

    addUser: (user) =>
      set((s) => {
        if (s.users.some((u) => u.id === user.id)) return s;
        return { users: [...s.users, { ...user, color: user.color ?? colorForUser(user.id), isLocal: false }] };
      }),

    // The board's own presence entry. MUST be isLocal: true — remote merge
    // filters key off it.
    addLocalUser: (user) =>
      set((s) => {
        if (s.users.some((u) => u.isLocal)) return s;
        return {
          users: [
            { ...user, color: user.color ?? colorForUser(user.id), isLocal: true },
            ...s.users.filter((u) => u.id !== user.id),
          ],
        };
      }),

    removeUser: (id) => set((s) => ({ users: s.users.filter((u) => u.id !== id) })),

    setStatus: (status) => set({ status }),
    setMode: (mode) => set({ mode }),
  };
});
