export type WorkspaceRole = "owner" | "member";
export type PermissionTemplateKey = "tattoo";

export type Permission =
  | "inquiry.read"
  | "inquiry.create"
  | "inquiry.update"
  | "inquiry.delete"
  | "inquiry.bulk_delete"
  | "knowledge.write"
  | "settings.write"
  | "member.manage"
  | "billing.manage"
  | "workspace.transfer"
  | "export.csv";

export const permissionLabels: Record<Permission, string> = {
  "inquiry.read": "\uBB38\uC758 \uC5F4\uB78C",
  "inquiry.create": "\uBB38\uC758 \uB4F1\uB85D",
  "inquiry.update": "\uBB38\uC758 \uCC98\uB9AC",
  "inquiry.delete": "\uBB38\uC758 \uC0AD\uC81C",
  "inquiry.bulk_delete": "\uC804\uCCB4 \uC0AD\uC81C",
  "knowledge.write": "\uC9C0\uC2DD\uBCA0\uC774\uC2A4 \uC218\uC815",
  "settings.write": "\uC6B4\uC601 \uC124\uC815",
  "member.manage": "\uBA64\uBC84 \uAD00\uB9AC",
  "billing.manage": "\uACB0\uC81C \uAD00\uB9AC",
  "workspace.transfer": "\uC18C\uC720\uAD8C \uC774\uC804",
  "export.csv": "CSV \uB0B4\uBCF4\uB0B4\uAE30",
};

const baseRolePermissions: Record<WorkspaceRole, Permission[]> = {
  owner: [
    "inquiry.read",
    "inquiry.create",
    "inquiry.update",
    "inquiry.delete",
    "inquiry.bulk_delete",
    "knowledge.write",
    "settings.write",
    "member.manage",
    "billing.manage",
    "workspace.transfer",
    "export.csv",
  ],
  member: [
    "inquiry.read",
    "inquiry.create",
    "inquiry.update",
    "inquiry.delete",
    "knowledge.write",
    "export.csv",
  ],
};

export const roleLabels: Record<WorkspaceRole, string> = {
  owner: "\uB300\uD45C",
  member: "\uD300\uC6D0",
};

export function getRolePermissions(role: WorkspaceRole, _template?: PermissionTemplateKey) {
  return baseRolePermissions[role] ?? baseRolePermissions.member;
}

export function hasPermission(role: string | null | undefined, permission: Permission, _template?: PermissionTemplateKey) {
  if (!role || !isWorkspaceRole(role)) return false;
  return getRolePermissions(role).includes(permission);
}

export function isWorkspaceRole(role: string): role is WorkspaceRole {
  return role in baseRolePermissions;
}
