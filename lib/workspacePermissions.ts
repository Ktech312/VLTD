
// src/lib/workspacePermissions.ts

export type WorkspaceRole =
  | "OWNER"
  | "ADMIN"
  | "MANAGER"
  | "MEMBER"
  | "VIEWER";

export type Permission =
  | "ADD_ITEM"
  | "EDIT_ITEM"
  | "DELETE_ITEM"
  | "VIEW_PORTFOLIO"
  | "MANAGE_MEMBERS"
  | "BILLING_ACCESS";

const rolePermissions: Record<WorkspaceRole, Permission[]> = {
  OWNER: [
    "ADD_ITEM",
    "EDIT_ITEM",
    "DELETE_ITEM",
    "VIEW_PORTFOLIO",
    "MANAGE_MEMBERS",
    "BILLING_ACCESS",
  ],
  ADMIN: [
    "ADD_ITEM",
    "EDIT_ITEM",
    "DELETE_ITEM",
    "VIEW_PORTFOLIO",
    "MANAGE_MEMBERS",
  ],
  MANAGER: [
    "ADD_ITEM",
    "EDIT_ITEM",
    "VIEW_PORTFOLIO",
  ],
  MEMBER: [
    "ADD_ITEM",
    "VIEW_PORTFOLIO",
  ],
  VIEWER: [
    "VIEW_PORTFOLIO",
  ],
};

export function hasPermission(role: WorkspaceRole, permission: Permission) {
  return rolePermissions[role].includes(permission);
}
