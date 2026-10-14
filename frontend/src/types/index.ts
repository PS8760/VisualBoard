export interface User {
  id: string;
  name: string;
  email: string;
  color: string;
  initials: string;
  role: 'owner' | 'editor' | 'viewer';
  avatar?: string | null;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data?: { token?: string; user?: User };
  token?: string;
  user?: User;
}

export type Tool =
  | 'select'
  | 'hand'
  | 'pen'
  | 'rect'
  | 'circle'
  | 'line'
  | 'arrow'
  | 'text'
  | 'sticky'
  | 'image'
  | 'document'
  | 'comment'
  | 'laser';

export type ElementKind =
  | 'rect'
  | 'circle'
  | 'line'
  | 'arrow'
  | 'pen'
  | 'text'
  | 'sticky'
  | 'image'
  | 'document'
  | 'comment';

export interface AttachmentMeta {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  url?: string;
}

/** Attachment of a connector end to a shape, with an optional fixed anchor. */
export interface ConnectorBinding {
  elementId: string;
  anchor?: { type: 'auto' } | { type: 'side'; side: 'top' | 'right' | 'bottom' | 'left' } | { type: 'point'; nx: number; ny: number };
}

export interface BoardElement {
  id: string;
  kind: ElementKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  /** Interactive resize factor (1 = unscaled). Images bake scale into width/height. */
  scaleX?: number;
  scaleY?: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius?: number;
  fontSize?: number;
  content: string;
  anchor?: { x: number; y: number };
  points?: number[];
  pointsToPath?: string;
  attachment?: AttachmentMeta | null;
  /** solid | dashed | dotted stroke. */
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  /** Line/arrow endpoints are absolute scene coordinates (x/y/width/height are their bbox). */
  pointsAbsolute?: boolean;
  /** Connector curvature: px the curve bows off the straight chord at its midpoint (0 = straight). */
  bend?: number;
  /** Connector ends attached to shapes; they follow the shape when it moves. */
  startBinding?: ConnectorBinding | null;
  endBinding?: ConnectorBinding | null;
  /** Connector routing mode (default straight; legacy `bend` implies curved). */
  routing?: 'straight' | 'curved' | 'elbow';
  /** Connector control points as a flat [x0,y0,x1,y1,…] list (straight & curved routes). */
  waypoints?: number[];
  startMarker?: string;
  endMarker?: string;
  /** Marching-ants flow animation along the connector. */
  animated?: boolean;
  /** Connector mid-line label and its position along the path (0..1). */
  label?: string;
  labelT?: number;
  /** Label color for shapes. */
  textColor?: string;
  /** Locked elements can be selected (to unlock) but not moved or resized. */
  locked?: boolean;
  /** Stacking order; higher draws on top. Elements without it keep creation order. */
  zIndex?: number;
  /** @deprecated legacy denormalized counter — counts are derived from comments. */
  commentCount?: number;
  opacity?: number;
  /** Server-assigned, monotonically increasing per element (0 = never persisted). */
  version: number;
}

export interface Board {
  id: string;
  title: string;
  description?: string;
  ownerId?: string;
  createdAt: string;
  updatedAt: string;
  elements: BoardElement[];
  members: User[];
}

export interface CommentItem {
  id: string;
  boardId: string;
  /** Element the thread is pinned to (follows the element when it moves). */
  elementId?: string;
  /** Absolute world-space anchor; used for free pins and as a fallback for element pins. */
  x?: number;
  y?: number;
  author: { id: string; name: string; color: string; initials?: string };
  text: string;
  createdAt: string;
  /** True while an optimistic comment awaits the server. */
  pending?: boolean;
  /** Set when the server rejected an optimistic comment. */
  failed?: boolean;
}

export type SuggestionKind = 'auth' | 'cache' | 'queue' | 'monitoring' | 'database' | 'gateway';

export interface Suggestion {
  id: string;
  kind: SuggestionKind;
  title: string;
  detail: string;
  icon: string;
  target: { from: string; to: string };
}

export interface BoardVersion {
  id: string;
  label: string;
  /** Snapshot origin: manual checkpoint, auto-save, or safety copy. */
  kind?: string;
  timestamp: string;
  author: string;
  description: string;
  elementCount: number;
}

export interface PresenceCursor {
  x: number;
  y: number;
  tool: Tool;
}

export interface PresenceUser {
  id: string;
  name: string;
  color: string;
  cursor?: PresenceCursor;
  /** Epoch ms of the last cursor update — idle cursors are hidden after 5s. */
  lastSeen?: number;
  isLocal: boolean;
}

export interface SaveStatus {
  state: 'idle' | 'saving' | 'saved' | 'error' | 'offline';
  message?: string;
}

export type PanelTab = 'info' | 'comments' | 'documents' | 'suggestions';

export interface ToastOptions {
  description?: string;
  duration?: number;
}