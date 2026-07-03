import { NextRequest, NextResponse } from "next/server";

import { getWorkspaceContext, pool, requireWorkspacePermission, WorkspaceAccessError, WorkspacePermissionError } from "@/lib/db";
import { isWorkspaceRole, WorkspaceRole } from "@/lib/permissions";

const ASSIGNABLE_ROLES: WorkspaceRole[] = ["member"];

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const workspaceContext = await getWorkspaceContext(request).catch((error) => {
    if (error instanceof WorkspaceAccessError) return null;
    throw error;
  });
  if (!workspaceContext) return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });

  try {
    requireWorkspacePermission(workspaceContext, "member.manage");
  } catch (error) {
    if (error instanceof WorkspacePermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const { userId } = await context.params;
  const body = (await request.json()) as { role?: string };
  const nextRole = body.role || "";

  if (!isWorkspaceRole(nextRole) || !ASSIGNABLE_ROLES.includes(nextRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const current = await pool.query(
    `
    select role
    from workspace_members
    where workspace_id = $1
      and user_id = $2
    limit 1
    `,
    [workspaceContext.workspaceId, userId],
  );

  if (!current.rows[0]) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }
  if (current.rows[0].role === "owner") {
    return NextResponse.json({ error: "Owner role cannot be changed here" }, { status: 403 });
  }

  const result = await pool.query(
    `
    update workspace_members
    set role = $3
    where workspace_id = $1
      and user_id = $2
    returning user_id as id, role
    `,
    [workspaceContext.workspaceId, userId, nextRole],
  );

  return NextResponse.json({ member: result.rows[0] });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const workspaceContext = await getWorkspaceContext(request).catch((error) => {
    if (error instanceof WorkspaceAccessError) return null;
    throw error;
  });
  if (!workspaceContext) return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });

  try {
    requireWorkspacePermission(workspaceContext, "member.manage");
  } catch (error) {
    if (error instanceof WorkspacePermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const { userId } = await context.params;
  if (userId === workspaceContext.userId) {
    return NextResponse.json({ error: "You cannot remove yourself" }, { status: 400 });
  }

  const current = await pool.query(
    `
    select role
    from workspace_members
    where workspace_id = $1
      and user_id = $2
    limit 1
    `,
    [workspaceContext.workspaceId, userId],
  );

  if (!current.rows[0]) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }
  if (current.rows[0].role === "owner") {
    return NextResponse.json({ error: "Owner cannot be removed here" }, { status: 403 });
  }

  await pool.query(
    `
    delete from workspace_members
    where workspace_id = $1
      and user_id = $2
    `,
    [workspaceContext.workspaceId, userId],
  );

  return NextResponse.json({ ok: true, id: userId });
}
