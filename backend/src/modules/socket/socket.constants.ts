export const SocketEvents = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',

  JOIN_BOARD: 'board:join',
  LEAVE_BOARD: 'board:leave',
  BOARD_USERS: 'board:users',
  /** Board elements were replaced wholesale (version restore). */
  BOARD_RESTORED: 'board:restored',
  /** Board metadata (title/description) changed. */
  BOARD_UPDATED: 'board:updated',

  USER_JOIN: 'user:join',
  USER_LEAVE: 'user:leave',
  CURSOR_UPDATE: 'cursor:update',
  /** Ephemeral laser-pointer trail point (relayed, never persisted). */
  LASER_POINT: 'laser:point',

  ELEMENT_CREATED: 'element:created',
  ELEMENT_UPDATED: 'element:updated',
  ELEMENT_REMOVED: 'element:removed',
  /** Ephemeral in-flight transform (drag/resize) — relayed, never persisted. */
  ELEMENT_PREVIEW: 'element:preview',

  COMMENT_CREATED: 'comment:created',
  COMMENT_UPDATED: 'comment:updated',
  COMMENT_REMOVED: 'comment:removed',

  VERSION_CREATED: 'version:created',

  ERROR: 'error',
} as const;

export default SocketEvents;
