export const SocketEvents = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',

  JOIN_BOARD: 'board:join',
  LEAVE_BOARD: 'board:leave',
  BOARD_USERS: 'board:users',

  USER_JOIN: 'user:join',
  USER_LEAVE: 'user:leave',
  CURSOR_UPDATE: 'cursor:update',

  ELEMENT_CREATED: 'element:created',
  ELEMENT_UPDATED: 'element:updated',
  ELEMENT_REMOVED: 'element:removed',

  COMMENT_CREATED: 'comment:created',
  COMMENT_REMOVED: 'comment:removed',

  ERROR: 'error',
} as const;

export default SocketEvents;
