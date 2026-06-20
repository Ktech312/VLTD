// src/lib/workspaces.ts

export type WorkspaceType = "PERSONAL" | "BUSINESS";

export type Workspace = {
  id: string;
  name: string;
  type: WorkspaceType;
  createdAt: number;
};

let cachedWorkspaces: Workspace[] | null = null;
let currentWorkspaceId: string | null = null;

const listeners = new Set<(workspace: Workspace) => void>();

export function loadWorkspaces(): Workspace[] {
  if (cachedWorkspaces) return cachedWorkspaces;

  cachedWorkspaces = [
    {
      id: "personal",
      name: "Personal Vault",
      type: "PERSONAL",
      createdAt: Date.now(),
    },
  ];

  currentWorkspaceId = cachedWorkspaces[0].id;

  return cachedWorkspaces;
}

export function getCurrentWorkspace(): Workspace {
  const workspaces = loadWorkspaces();
  return workspaces.find((w) => w.id === currentWorkspaceId) ?? workspaces[0];
}

export function switchWorkspace(id: string) {
  const workspaces = loadWorkspaces();
  const ws = workspaces.find((w) => w.id === id);
  if (!ws) return;

  currentWorkspaceId = ws.id;
  listeners.forEach((fn) => fn(ws));
}

export function onWorkspaceChange(fn: (workspace: Workspace) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getWorkspaceName(): string {
  return getCurrentWorkspace().name;
}

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  subtitle: string;
  type: "personal" | "business";
  logoText: string;
};

export type WorkspaceRole =
  | "OWNER"
  | "ADMIN"
  | "INVENTORY_MANAGER"
  | "VIEWER";

export type WorkspaceMember = {
  id: string;
  name: string;
  role: WorkspaceRole;
  status: "ACTIVE" | "INVITED" | "DISABLED";
  email?: string;
  note?: string;
};

export type WorkspaceRoleDefaults = {
  addItem: boolean;
  editItem: boolean;
  deleteItem: boolean;
  viewPortfolioFinancials: boolean;
  manageMembers: boolean;
  billingAccess: boolean;
};

export function toWorkspaceSummary(profile: any): WorkspaceSummary {
  const type = profile?.profile_type === "business" ? "business" : "personal";

  return {
    id: profile?.id ?? "personal",
    name: profile?.display_name ?? "Personal Vault",
    slug: profile?.username ?? "personal",
    subtitle: type === "business" ? "Business Workspace" : "Personal Workspace",
    type,
    logoText: (profile?.display_name ?? "P").slice(0, 1).toUpperCase(),
  };
}

export function placeholderMembers(
  _workspace?: WorkspaceSummary | Workspace | null,
  email?: string | null
): WorkspaceMember[] {
  return [
    {
      id: "owner",
      name: "You",
      role: "OWNER",
      status: "ACTIVE",
      email: email ?? undefined,
      note: "Primary owner account",
    },
  ];
}

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