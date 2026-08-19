import type { ElementKind, SuggestionKind, Tool } from '../types';

export interface ShortcutDef {
  keys: string[];
  mac?: string[];
  action: string;
  tool?: Tool;
}

export const SHORTCUTS: ShortcutDef[] = [
  { keys: ['v'], action: 'Select', tool: 'select' },
  { keys: ['h'], action: 'Hand / Pan', tool: 'hand' },
  { keys: ['p'], action: 'Pen', tool: 'pen' },
  { keys: ['r'], action: 'Rectangle', tool: 'rect' },
  { keys: ['o'], action: 'Circle', tool: 'circle' },
  { keys: ['a'], action: 'Arrow', tool: 'arrow' },
  { keys: ['l'], action: 'Line', tool: 'line' },
  { keys: ['t'], action: 'Text', tool: 'text' },
  { keys: ['s'], action: 'Sticky note', tool: 'sticky' },
  { keys: ['c'], action: 'Comment', tool: 'comment' },
  { keys: ['k', 'mod'], mac: ['k', 'meta'], action: 'Command palette' },
  { keys: ['z', 'mod'], mac: ['z', 'meta'], action: 'Undo' },
  { keys: ['Z', 'mod', 'shift'], mac: ['Z', 'meta', 'shift'], action: 'Redo' },
  { keys: ['Delete', 'Backspace'], action: 'Delete selection' },
  { keys: ['0'], action: 'Reset zoom' },
  { keys: ['=', 'mod'], mac: ['=', 'meta'], action: 'Zoom in' },
  { keys: ['-', 'mod'], mac: ['-', 'meta'], action: 'Zoom out' },
  { keys: ['g'], action: 'Toggle grid' },
  { keys: ['space'], action: 'Temporary pan (hold)' },
];

export function shortcutLabel(shortcut: ShortcutDef): string {
  const keys = shortcut.mac ?? shortcut.keys;
  return keys
    .map((k) => {
      if (k === 'mod' || k === 'meta' || k === 'ctrl') return '⌘';
      if (k === 'shift') return '⇧';
      if (k === 'option' || k === 'alt') return '⌥';
      if (k === 'Delete') return 'Del';
      return k.length === 1 ? k.toUpperCase() : k;
    })
    .join('');
}

export const TOOL_LABEL: Record<Tool, string> = {
  select: 'Select',
  hand: 'Hand',
  pen: 'Pen',
  rect: 'Rectangle',
  circle: 'Circle',
  line: 'Line',
  arrow: 'Arrow',
  text: 'Text',
  sticky: 'Sticky note',
  image: 'Image',
  document: 'Document',
  comment: 'Comment',
};

export const ELEMENT_LABEL: Record<ElementKind, string> = {
  rect: 'Rectangle',
  circle: 'Circle',
  line: 'Line',
  arrow: 'Arrow',
  pen: 'Freehand',
  text: 'Text',
  sticky: 'Sticky note',
  image: 'Image',
  document: 'Document',
  comment: 'Comment',
};

export const SUGGESTION_META: Record<
  SuggestionKind,
  { title: string; detail: string; tag: string }
> = {
  auth: {
    title: 'Add authentication layer',
    detail: 'Protect the API behind token-based auth before exposing it.',
    tag: 'AUTH',
  },
  cache: {
    title: 'Add caching',
    detail: 'Frequently read data could sit behind a cache to cut latency.',
    tag: 'CACHE',
  },
  queue: {
    title: 'Consider a message queue',
    detail: 'Async work between services stays reliable with a queue.',
    tag: 'QUEUE',
  },
  monitoring: {
    title: 'Add monitoring',
    detail: 'Logs, metrics and tracing make production behaviour visible.',
    tag: 'OBSERV',
  },
  database: {
    title: 'Normalise the data layer',
    detail: 'The database is the single source of truth — document it.',
    tag: 'DB',
  },
  gateway: {
    title: 'Route through a gateway',
    detail: 'A single entry point keeps clients simple and traffic centralised.',
    tag: 'GATE',
  },
};

export const PRESENCE_COLORS = ['#d9480f', '#2563eb', '#7c3aed', '#0d9488', '#c2352c', '#b45309'];
