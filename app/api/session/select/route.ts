import { NextRequest, NextResponse } from "next/server";

import { pool, resolveSession, SESSION_COOKIE, updateSessionWorkspace } from "@/lib/db";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await resolveSession(token);
  if (!session || !token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json()) as { workspaceId?: string };
  const workspaceId = String(body.workspaceId || "");

  const membership = await pool.query(
    `
    select
      app_users.id as "userId",
      app_users.name as "userName",
      workspaces.id as "workspaceId",
      workspaces.name as "workspaceName",
      workspaces.profile,
      workspace_members.role
    from workspace_members
    join app_users on app_users.id = workspace_members.user_id
    join workspaces on workspaces.id = workspace_members.workspace_id
    where workspace_members.user_id = $1
      and workspace_members.workspace_id = $2
    limit 1
    `,
    [session.userId, workspaceId],
  );

  if (!membership.rows[0]) {
    return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });
  }

  await updateSessionWorkspace(token, workspaceId);

  return NextResponse.json({ ok: true, session: membership.rows[0] });
}
