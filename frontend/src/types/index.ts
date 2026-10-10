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
  | 'comment';

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

export interface BoardElement {
  id: string;
  kind: ElementKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
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
  commentCount?: number;
  opacity?: number;
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
  elementId?: string;
  x?: number;
  y?: number;
  author: { id: string; name: string; color: string };
  text: string;
  createdAt: string;
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