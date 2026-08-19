import { create } from 'zustand';
import type { PresenceUser, Tool } from '../types';
import { throttle } from '../utils';
import { DEMO_USERS } from '../data/demo';

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
  removeUser: (id: string) => void;
  setStatus: (status: ConnectionStatus) => void;
  setMode: (mode: PresenceMode) => void;
}

const WAYPOINTS: Array<[number, number]> = [
  [-880, -90], [-660, -90], [-410, -90], [-240, -30], [-325, 130], [-410, 260], [-170, -90],
  [160, -180], [200, -30], [-40, 250], [-600, -30], [-760, -60], [-880, -140], [-880, -90],
];

const PRESENCE_COLORS = ['#d9480f', '#2f9e44', '#1971c2', '#e8590c', '#7048e8', '#0c8599'];

function makeSimulatedUsers(): PresenceUser[] {
  return DEMO_USERS.slice(1).map((u, i) => ({
    id: u.id,
    name: u.name,
    color: u.color,
    cursor: { x: WAYPOINTS[i % WAYPOINTS.length][0], y: WAYPOINTS[i % WAYPOINTS.length][1], tool: 'select' as Tool },
    isLocal: false,
  }));
}

export const usePresenceStore = create<PresenceState>((set, get) => {
  let simTimer: ReturnType<typeof setInterval> | null = null;
  const simOffsets: Record<string, number> = {};
  const waypointIndex: Record<string, number> = {};

  const startSimulation = () => {
    const users = makeSimulatedUsers();
    users.forEach((u, i) => {
      simOffsets[u.id] = i * 137 + 20;
      waypointIndex[u.id] = i;
    });
    set({ users, mode: 'simulated', status: 'connected' });

    if (simTimer) clearInterval(simTimer);
    simTimer = setInterval(() => {
      set((s) => ({
        users: s.users.map((u) => {
          if (u.isLocal) return u;
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
    if (!local) return;
    if (mode === 'live' && socket) {
      (socket as { emit: (e: string, p: unknown) => void }).emit('cursor:update', {
        userId: local.id,
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
      if (status === 'connecting' || status === 'connected') return;
      set({ status: 'connecting' });

      const { io } = await import('socket.io-client');
      const token = localStorage.getItem('vb_token');
      const socket = io(import.meta.env.VITE_SOCKET_URL || undefined, {
        transports: ['websocket', 'polling'],
        auth: token ? { token } : undefined,
        timeout: 2500,
      });

      const fail = () => {
        socket.close();
        stopSimulation();
        startSimulation();
      };

      socket.on('connect', () => {
        set({ status: 'connected', mode: 'live', socket });
        socket.emit('board:join', { boardId });
      });

      socket.on('connect_error', () => {
        set({ status: 'offline' });
        stopSimulation();
        startSimulation();
      });

      socket.on('user:join', (user: Omit<PresenceUser, 'isLocal'>) => get().addUser(user));
      socket.on('user:leave', ({ userId }: { userId: string }) => get().removeUser(userId));
      socket.on('cursor:update', (payload: { id: string; userId: string; x: number; y: number; tool: Tool }) => {
        set((s) => ({
          users: s.users.map((u) =>
            !u.isLocal && (u.id === payload.id || u.id === payload.userId)
              ? { ...u, cursor: { x: payload.x, y: payload.y, tool: payload.tool } }
              : u,
          ),
        }));
      });

      const timeout = setTimeout(fail, 3000);
      socket.once('connect', () => clearTimeout(timeout));
    },

    disconnect: () => {
      const { socket } = get();
      if (socket) (socket as { close: () => void }).close();
      stopSimulation();
      set({ users: [], status: 'idle', mode: 'none', socket: null });
    },

    updateLocalCursor: (x, y, tool) => {
      set((s) => ({
        users: s.users.map((u) => (u.isLocal ? { ...u, cursor: { x, y, tool } } : u)),
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
              cursor: cursor ?? { x: 0, y: 0, tool: 'select' },
              isLocal: false,
            },
          ],
        };
      }),

    removeUser: (id) => set((s) => ({ users: s.users.filter((u) => u.id !== id) })),

    setStatus: (status) => set({ status }),
    setMode: (mode) => set({ mode }),
  };
});
