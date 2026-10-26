import type { Board, BoardElement, BoardVersion, CommentItem, User } from '../types';

export const DEMO_USERS: User[] = [
  { id: 'u1', name: 'Demo Owner', email: 'owner@visualboard.dev', color: '#d9480f', initials: 'DO', role: 'owner' },
  { id: 'u2', name: 'Aisha', email: 'aisha@visualboard.dev', color: '#2563eb', initials: 'AI', role: 'editor' },
  { id: 'u3', name: 'Marcus', email: 'marcus@visualboard.dev', color: '#7c3aed', initials: 'MK', role: 'editor' },
];

export const demoElements: BoardElement[] = [
  {
    id: 'el_user', kind: 'rect', x: -880, y: -90, width: 150, height: 60, rotation: 0,
    fill: '#fafaf8', stroke: '#c2c0b5', strokeWidth: 1.5, radius: 8, fontSize: 14,
    content: 'User', version: 1,
  },
  {
    id: 'el_frontend', kind: 'rect', x: -660, y: -90, width: 180, height: 60, rotation: 0,
    fill: '#fafaf8', stroke: '#c2c0b5', strokeWidth: 1.5, radius: 8, fontSize: 14,
    content: 'Frontend', version: 1,
  },
  {
    id: 'el_api', kind: 'rect', x: -410, y: -90, width: 170, height: 60, rotation: 0,
    fill: '#fbf1e8', stroke: '#d9480f', strokeWidth: 1.5, radius: 8, fontSize: 14,
    content: 'API Gateway', version: 2,
    attachment: {
      id: 'att_1', name: 'architecture.pdf', type: 'application/pdf', size: 482611,
      uploadedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    commentCount: 1,
  },
  {
    id: 'el_auth', kind: 'rect', x: -410, y: 70, width: 170, height: 60, rotation: 0,
    fill: '#fafaf8', stroke: '#c2c0b5', strokeWidth: 1.5, radius: 8, fontSize: 14,
    content: 'Authentication', version: 1,
  },
  {
    id: 'el_db', kind: 'rect', x: -410, y: 230, width: 170, height: 60, rotation: 0,
    fill: '#fafaf8', stroke: '#c2c0b5', strokeWidth: 1.5, radius: 8, fontSize: 14,
    content: 'PostgreSQL', version: 1,
    attachment: {
      id: 'att_2', name: 'schema.sql', type: 'text/plain', size: 12840,
      uploadedAt: new Date(Date.now() - 86400000).toISOString(),
    },
  },
  {
    id: 'el_cache', kind: 'rect', x: -170, y: -90, width: 160, height: 60, rotation: 0,
    fill: '#fafaf8', stroke: '#c2c0b5', strokeWidth: 1.5, radius: 8, fontSize: 14,
    content: 'Redis Cache', version: 1,
  },
  {
    id: 'el_queue', kind: 'rect', x: -130, y: 220, width: 190, height: 60, rotation: 0,
    fill: '#fafaf8', stroke: '#c2c0b5', strokeWidth: 1.5, radius: 8, fontSize: 14,
    content: 'Message Queue', version: 1,
  },
  {
    id: 'el_sketch', kind: 'pen', x: -880, y: -270, width: 0, height: 0, rotation: 0,
    fill: 'transparent', stroke: '#78766e', strokeWidth: 1.75,
    content: '',
    points: [
      -880, -270, -860, -255, -835, -252, -810, -246, -785, -243, -762, -238, -738, -240,
      -718, -232, -695, -228, -672, -226, -650, -222, -628, -226, -608, -220,
    ],
    version: 1,
  },
  {
    id: 'el_title', kind: 'text', x: -880, y: -330, width: 260, height: 24, rotation: 0,
    fill: 'transparent', stroke: 'transparent', strokeWidth: 0, fontSize: 16,
    content: 'System Architecture', version: 1,
  },
  {
    id: 'el_note1', kind: 'sticky', x: 120, y: -230, width: 200, height: 120, rotation: -3,
    fill: '#fdeeb0', stroke: '#e6cf74', strokeWidth: 1, fontSize: 13,
    content: 'Keep the API stateless — push session data into the cache.', version: 1,
  },
  {
    id: 'el_note2', kind: 'sticky', x: 150, y: -60, width: 200, height: 120, rotation: 2,
    fill: '#fbe4d4', stroke: '#e9b99a', strokeWidth: 1, fontSize: 13,
    content: 'Rate limiting goes in front of the gateway.', version: 1,
  },
  {
    id: 'el_doc', kind: 'document', x: 150, y: 110, width: 200, height: 72, rotation: 0,
    fill: '#fafaf8', stroke: '#c2c0b5', strokeWidth: 1, radius: 6, fontSize: 12,
    content: 'api-spec.md', version: 1,
  },
  {
    id: 'el_cmt1', kind: 'comment', x: -360, y: -150, width: 16, height: 16, rotation: 0,
    fill: '#d9480f', stroke: 'transparent', strokeWidth: 0, content: '', commentCount: 1, version: 1,
  },
  {
    id: 'el_cmt2', kind: 'comment', x: -160, y: 170, width: 16, height: 16, rotation: 0,
    fill: '#2563eb', stroke: 'transparent', strokeWidth: 0, content: '', commentCount: 2, version: 1,
  },
  {
    id: 'el_conn_1', kind: 'arrow', x: 0, y: 0, width: 0, height: 0, rotation: 0,
    fill: 'transparent', stroke: '#a8a69c', strokeWidth: 1.5, content: '',
    points: [-730, -60, -660, -60], version: 1,
  },
  {
    id: 'el_conn_2', kind: 'arrow', x: 0, y: 0, width: 0, height: 0, rotation: 0,
    fill: 'transparent', stroke: '#a8a69c', strokeWidth: 1.5, content: '',
    points: [-480, -60, -410, -60], version: 1,
  },
  {
    id: 'el_conn_3', kind: 'arrow', x: 0, y: 0, width: 0, height: 0, rotation: 0,
    fill: 'transparent', stroke: '#a8a69c', strokeWidth: 1.5, content: '',
    points: [-325, -30, -325, 70], version: 1,
  },
  {
    id: 'el_conn_4', kind: 'arrow', x: 0, y: 0, width: 0, height: 0, rotation: 0,
    fill: 'transparent', stroke: '#a8a69c', strokeWidth: 1.5, content: '',
    points: [-325, 130, -325, 230], version: 1,
  },
  {
    id: 'el_conn_5', kind: 'arrow', x: 0, y: 0, width: 0, height: 0, rotation: 0,
    fill: 'transparent', stroke: '#a8a69c', strokeWidth: 1.5, content: '',
    points: [-240, -30, -170, -30], version: 1,
  },
  {
    id: 'el_conn_6', kind: 'arrow', x: 0, y: 0, width: 0, height: 0, rotation: 0,
    fill: 'transparent', stroke: '#a8a69c', strokeWidth: 1.5, content: '',
    points: [-240, -30, -40, 220], version: 1,
  },
];

export const demoBoard: Board = {
  id: 'demo-architecture',
  title: 'Checkout Service Architecture',
  description: 'Design review — v3 proposal',
  ownerId: 'u1',
  createdAt: new Date(Date.now() - 86400000 * 6).toISOString(),
  updatedAt: new Date().toISOString(),
  elements: demoElements,
  members: DEMO_USERS,
};

export const demoComments: CommentItem[] = [
  {
    id: 'c1',
    boardId: 'demo-architecture',
    elementId: 'el_api',
    author: { id: 'u3', name: 'Marcus', color: '#7c3aed' },
    text: 'Should the gateway also terminate TLS here?',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'c2',
    boardId: 'demo-architecture',
    x: -160, y: 170,
    author: { id: 'u2', name: 'Aisha', color: '#2563eb' },
    text: 'Queue consumers are still unbuilt — flagging for the sprint.',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'c3',
    boardId: 'demo-architecture',
    x: -160, y: 170,
    author: { id: 'u1', name: 'Demo Owner', color: '#d9480f' },
    text: 'Added to backlog. Priority: high.',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
];

export const demoVersions: BoardVersion[] = [
  {
    id: 'v1', label: 'Version 01', timestamp: new Date(Date.now() - 86400000 * 5).toISOString(),
    author: 'Demo Owner', description: 'Initial sketch — flow from client to database.', elementCount: 7,
  },
  {
    id: 'v2', label: 'Version 02', timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
    author: 'Aisha', description: 'Added caching layer and queue boundary.', elementCount: 11,
  },
  {
    id: 'v3', label: 'Version 03', timestamp: new Date(Date.now() - 86400000).toISOString(),
    author: 'Marcus', description: 'Authentication service extracted, notes attached.', elementCount: 15,
  },
  {
    id: 'v4', label: 'Current', timestamp: new Date().toISOString(),
    author: 'Demo Owner', description: 'Review session — comments and attachments added.', elementCount: 19,
  },
];

