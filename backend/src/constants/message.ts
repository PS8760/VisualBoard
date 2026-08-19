export const Messages = {
  AUTH: {
    REGISTERED: 'Account created successfully',
    LOGGED_IN: 'Logged in successfully',
    INVALID_CREDENTIALS: 'Invalid email or password',
    EMAIL_IN_USE: 'An account with that email already exists',
    UNAUTHORIZED: 'Authentication required',
    INVALID_TOKEN: 'Invalid or expired token',
  },
  BOARD: {
    CREATED: 'Board created',
    UPDATED: 'Board updated',
    DELETED: 'Board deleted',
    NOT_FOUND: 'Board not found',
    MEMBER_ADDED: 'Member added',
    MEMBER_REMOVED: 'Member removed',
    MEMBER_UPDATED: 'Member role updated',
    SELF_REMOVE_OWNER: 'The owner cannot be removed from their own board',
    LAST_OWNER: 'A board must keep at least one owner',
  },
  ELEMENT: {
    CREATED: 'Element created',
    UPDATED: 'Element updated',
    DELETED: 'Element deleted',
    NOT_FOUND: 'Element not found',
    BOARD_NOT_FOUND: 'Board not found',
    BULK_SYNCED: 'Elements synchronized',
  },
  COMMENT: {
    CREATED: 'Comment created',
    UPDATED: 'Comment updated',
    DELETED: 'Comment deleted',
    NOT_FOUND: 'Comment not found',
    NOT_AUTHOR: 'Only the author can modify this comment',
  },
  VERSION: {
    CREATED: 'Snapshot created',
    RESTORED: 'Board restored',
    NOT_FOUND: 'Version not found',
  },
  DOCUMENT: {
    UPLOADED: 'Document attached',
    DELETED: 'Document deleted',
    NOT_FOUND: 'Document not found',
    INVALID_TYPE: 'File type not allowed',
    TOO_LARGE: 'File exceeds the size limit',
    MISSING: 'No file provided',
  },
  USER: {
    NOT_FOUND: 'User not found',
    UPDATED: 'Profile updated',
  },
  HEALTH: {
    OK: 'OK',
  },
} as const;

export default Messages;
