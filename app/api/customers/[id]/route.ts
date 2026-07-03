import { NextRequest, NextResponse } from "next/server";

import { getWorkspaceContext, pool, requireWorkspacePermission, WorkspaceAccessError, WorkspacePermissionError } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const workspaceContext = await getWorkspaceContext(request).catch((error) => {
    if (error instanceof WorkspaceAccessError) return null;
    throw error;
  });
  if (!workspaceContext) return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });

  try {
    requireWorkspacePermission(workspaceContext, "inquiry.update");
  } catch (error) {
    if (error instanceof WorkspacePermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const { id } = await context.params;
  const body = await request.json();

  const result = await pool.query(
    `
    update customers
    set
      status = coalesce($3, status),
      tags = coalesce($4, tags),
      note = coalesce($5, note),
      skin_notes = coalesce($6, skin_notes),
      updated_at = now()
    where id = $1
      and workspace_id = $2
    returning
      id,
      name,
      channel,
      contact,
      status,
      tags,
      note,
      skin_notes as "skinNotes",
      normalized_key as "normalizedKey",
      created_at as "createdAt",
      updated_at as "updatedAt"
    `,
    [id, workspaceContext.workspaceId, body.status ?? null, body.tags ?? null, body.note ?? null, body.skinNotes ?? null],
  );

  if (!result.rows[0]) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  return NextResponse.json({ customer: result.rows[0] });
}
