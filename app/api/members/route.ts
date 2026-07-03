import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { getWorkspaceContext, pool, requireWorkspacePermission, WorkspaceAccessError, WorkspaceContext, WorkspacePermissionError } from "@/lib/db";
import { isWorkspaceRole, roleLabels, WorkspaceRole } from "@/lib/permissions";

const INVITABLE_ROLES: WorkspaceRole[] = ["member"];

export async function GET(request: NextRequest) {
  const context = await getWorkspaceContext(request).catch((error) => {
    if (error instanceof WorkspaceAccessError) return null;
    throw error;
  });
  if (!context) return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });

  const result = await pool.query(
    `
    select
      app_users.id,
      app_users.name,
      app_users.email,
      workspace_members.role,
      workspace_members.created_at as "joinedAt"
    from workspace_members
    join app_users on app_users.id = workspace_members.user_id
    where workspace_members.workspace_id = $1
    order by
      case workspace_members.role
        when 'owner' then 1
        when 'member' then 2
        else 3
      end,
      app_users.name
    `,
    [context.workspaceId],
  );

  return NextResponse.json({ members: result.rows });
}

export async function POST(request: NextRequest) {
  const context = await getWorkspaceContext(request).catch((error) => {
    if (error instanceof WorkspaceAccessError) return null;
    throw error;
  });
  if (!context) return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });

  const permissionError = requireMemberManage(context);
  if (permissionError) return permissionError;

  const body = (await request.json()) as { email?: string; name?: string; role?: string };
  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim() || email.split("@")[0] || "새 멤버";
  const role = body.role || "member";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!isWorkspaceRole(role) || !INVITABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const userId = getUserId(email);
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query(
      `
      insert into app_users (id, name, email, updated_at)
      values ($1, $2, $3, now())
      on conflict (email) do update set
        name = excluded.name,
        updated_at = now()
      `,
      [userId, name, email],
    );
    const userResult = await client.query("select id from app_users where email = $1 limit 1", [email]);
    const resolvedUserId = userResult.rows[0]?.id || userId;

    const member = await client.query(
      `
      insert into workspace_members (workspace_id, user_id, role)
      values ($1, $2, $3)
      on conflict (workspace_id, user_id) do update set
        role = excluded.role
      returning user_id as id, role
      `,
      [context.workspaceId, resolvedUserId, role],
    );

    await client.query("commit");

    return NextResponse.json({
      member: {
        id: member.rows[0].id,
        name,
        email,
        role,
        roleLabel: roleLabels[role],
      },
    });
  } catch (error) {
    await client.query("rollback");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to invite member" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}

function requireMemberManage(context: WorkspaceContext) {
  try {
    requireWorkspacePermission(context, "member.manage");
    return null;
  } catch (error) {
    if (error instanceof WorkspacePermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}

function getUserId(email: string) {
  const hash = createHash("sha256").update(email).digest("hex").slice(0, 18);
  return `user_${hash}`;
}
