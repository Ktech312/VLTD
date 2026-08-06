// src/lib/workspaces.ts
//
// The multi-workspace-switching system that used to live in this file
// (loadWorkspaces/getCurrentWorkspace/switchWorkspace/placeholderMembers)
// was local-only mock data -- a single hardcoded "Personal Vault" entry,
// never wired to Supabase -- and has been fully superseded by the real,
// live multi-profile system (src/lib/auth.ts's getOnboardingStatus()/
// activeProfile, used throughout /account, /more, etc.). Removed 2026-08-05.
// Only the role-permission mapping below is real and still used
// (src/app/account/roles/page.tsx).

export type WorkspaceRole =
  | "OWNER"
  | "ADMIN"
  | "INVENTORY_MANAGER"
  | "VIEWER";

export type WorkspaceRoleDefaults = {
  addItem: boolean;
  editItem: boolean;
  deleteItem: boolean;
  viewPortfolioFinancials: boolean;
  manageMembers: boolean;
  billingAccess: boolean;
};

export function getRoleDefaults(role: WorkspaceRole): WorkspaceRoleDefaults {
  switch (role) {
    case "OWNER":
      return {
        addItem: true,
        editItem: true,
        deleteItem: true,
        viewPortfolioFinancials: true,
        manageMembers: true,
        billingAccess: true,
      };
    case "ADMIN":
      return {
        addItem: true,
        editItem: true,
        deleteItem: true,
        viewPortfolioFinancials: true,
        manageMembers: true,
        billingAccess: false,
      };
    case "INVENTORY_MANAGER":
      return {
        addItem: true,
        editItem: true,
        deleteItem: false,
        viewPortfolioFinancials: false,
        manageMembers: false,
        billingAccess: false,
      };
    case "VIEWER":
    default:
      return {
        addItem: false,
        editItem: false,
        deleteItem: false,
        viewPortfolioFinancials: false,
        manageMembers: false,
        billingAccess: false,
      };
  }
}
