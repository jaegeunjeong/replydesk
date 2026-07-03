import { NextRequest, NextResponse } from "next/server";

import { pool } from "@/lib/db";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { userId?: string; workspaceId?: string };
  const userId = request.cookies.get("replydesk_user")?.value || request.headers.get("x-replydesk-user-id") || body.userId || "";
  const workspaceId = body.workspaceId || "";

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
    [userId, workspaceId],
  );

  if (!membership.rows[0]) {
    return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true, session: membership.rows[0] });

  response.cookies.set("replydesk_user", userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  response.cookies.set("replydesk_workspace", workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
