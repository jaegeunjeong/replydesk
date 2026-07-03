import { Pool } from "pg";
import { NextRequest } from "next/server";
import { hasPermission, Permission } from "@/lib/permissions";

declare global {
  // eslint-disable-next-line no-var
  var replydeskPgPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}

export const pool =
  globalThis.replydeskPgPool ??
  new Pool({
    connectionString,
    ssl: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.replydeskPgPool = pool;
}

export const DEFAULT_WORKSPACE_ID = "default-workspace";
export const DEFAULT_USER_ID = "demo-owner";

export async function ensureDefaultWorkspace() {
  await pool.query(
    `
    insert into workspaces (id, name, profile)
    values ($1, $2, $3)
    on conflict (id) do update set
      name = excluded.name,
      profile = excluded.profile,
      updated_at = now()
    `,
    [DEFAULT_WORKSPACE_ID, "타투 스튜디오 데모", "tattoo"],
  );
}

export type WorkspaceContext = {
  userId: string;
  workspaceId: string;
  role: string;
};

export async function getWorkspaceContext(request: NextRequest): Promise<WorkspaceContext> {
  await ensureDefaultWorkspace();

  const userId = request.cookies.get("replydesk_user")?.value || request.headers.get("x-replydesk-user-id");
  const workspaceId = request.cookies.get("replydesk_workspace")?.value || request.headers.get("x-replydesk-workspace-id");

  if (!userId || !workspaceId) {
    throw new WorkspaceAccessError();
  }

  const membership = await pool.query(
    `
    select role
    from workspace_members
    where user_id = $1
      and workspace_id = $2
    limit 1
    `,
    [userId, workspaceId],
  );

  if (!membership.rows[0]) {
    throw new WorkspaceAccessError();
  }

  return { userId, workspaceId, role: membership.rows[0].role };
}

export function requireWorkspacePermission(context: WorkspaceContext, permission: Permission) {
  if (!hasPermission(context.role, permission)) {
    throw new WorkspacePermissionError(permission);
  }
}

export class WorkspaceAccessError extends Error {
  constructor() {
    super("Workspace access denied");
  }
}

export class WorkspacePermissionError extends Error {
  constructor(public permission: Permission) {
    super(`Permission required: ${permission}`);
  }
}
