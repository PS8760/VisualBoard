export const ElementKind = {
  RECT: 'rect',
  CIRCLE: 'circle',
  STICKY: 'sticky',
  LINE: 'line',
  ARROW: 'arrow',
  PEN: 'pen',
  TEXT: 'text',
  IMAGE: 'image',
  DOCUMENT: 'document',
  COMMENT: 'comment',
} as const;

export const ElementErrors = {
  NOT_FOUND: 'Element not found',
  BOARD_NOT_FOUND: 'Board not found',
} as const;

export default ElementKind;