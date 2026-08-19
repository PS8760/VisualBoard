export const Routes = {
  API_PREFIX: '/api/v1',

  HEALTH: '/health',
  HEALTH_READY: '/health/ready',

  AUTH: {
    REGISTER: '/auth/register',
    LOGIN: '/auth/login',
    GITHUB_EXCHANGE: '/auth/github/exchange',
    GOOGLE_EXCHANGE: '/auth/google/exchange',
  },

  USERS: {
    ME: '/users/me',
  },

  BOARDS: '/boards',
  BOARD: '/boards/:id',
  BOARD_MEMBERS: '/boards/:id/members',
  BOARD_MEMBER: '/boards/:id/members/:userId',

  ELEMENTS: '/boards/:boardId/elements',
  ELEMENT: '/boards/:boardId/elements/:elementId',
  ELEMENTS_BULK: '/boards/:boardId/elements/bulk',

  COMMENTS: '/boards/:boardId/comments',
  COMMENT: '/boards/:boardId/comments/:commentId',

  VERSIONS: '/boards/:boardId/versions',
  VERSION: '/boards/:boardId/versions/:versionId',
  VERSION_RESTORE: '/boards/:boardId/versions/:versionId/restore',

  DOCUMENTS: '/boards/:boardId/documents',
  DOCUMENT: '/documents/:documentId',
  DOCUMENT_DOWNLOAD: '/documents/:documentId/download',
} as const;

export default Routes;
