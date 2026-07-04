import { NextRequest, NextResponse } from "next/server";

import { pool, resolveSession, SESSION_COOKIE } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await resolveSession(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.json({ authenticated: false, currentUserId: null, currentWorkspaceId: null, users: [], workspaces: [] });
  }

  const currentUserId = session.userId;
  const currentWorkspaceId = session.workspaceId;

  const users = await pool.query(
    `
    select id, name, email
    from app_users
    where id = $1
    limit 1
    `,
    [currentUserId],
  );

  const workspaces = await pool.query(
    `
    select
      workspaces.id,
      workspaces.name,
      workspaces.profile,
      workspace_members.user_id as "userId",
      workspace_members.role
    from workspace_members
    join workspaces on workspaces.id = workspace_members.workspace_id
    where workspace_members.user_id = $1
    order by workspaces.created_at, workspaces.id
    `,
    [currentUserId],
  );

  const resolvedWorkspaceId = workspaces.rows.some((workspace) => workspace.id === currentWorkspaceId)
    ? currentWorkspaceId
    : workspaces.rows[0]?.id ?? null;

  return NextResponse.json({
    authenticated: users.rows.length > 0,
    currentUserId,
    currentWorkspaceId: resolvedWorkspaceId,
    users: users.rows,
    workspaces: workspaces.rows,
  });
}
