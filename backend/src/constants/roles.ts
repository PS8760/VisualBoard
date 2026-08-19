export const Roles = {
  OWNER: 'owner',
  EDITOR: 'editor',
  VIEWER: 'viewer',
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];

export const RoleValues: Role[] = [Roles.OWNER, Roles.EDITOR, Roles.VIEWER];

export default Roles;
