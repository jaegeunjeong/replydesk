import { NextRequest, NextResponse } from "next/server";

import { getWorkspaceContext, pool, requireWorkspacePermission, WorkspaceAccessError, WorkspacePermissionError } from "@/lib/db";

export async function GET(request: NextRequest) {
  const context = await getWorkspaceContext(request).catch((error) => {
    if (error instanceof WorkspaceAccessError) return null;
    throw error;
  });
  if (!context) return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });

  const result = await pool.query(
    `
    select profile, prices, faq
    from business_knowledge
    where workspace_id = $1
    order by profile
    `,
    [context.workspaceId],
  );

  return NextResponse.json({ knowledge: result.rows });
}

export async function PUT(request: NextRequest) {
  const context = await getWorkspaceContext(request).catch((error) => {
    if (error instanceof WorkspaceAccessError) return null;
    throw error;
  });
  if (!context) return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });
  try {
    requireWorkspacePermission(context, "knowledge.write");
  } catch (error) {
    if (error instanceof WorkspacePermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const body = await request.json();
  const profile = body.profile || "tattoo";

  const result = await pool.query(
    `
    insert into business_knowledge (workspace_id, profile, prices, faq, updated_at)
    values ($1, $2, $3, $4, now())
    on conflict (workspace_id, profile) do update set
      prices = excluded.prices,
      faq = excluded.faq,
      updated_at = now()
    returning profile, prices, faq
    `,
    [context.workspaceId, profile, body.prices || "", body.faq || ""],
  );

  return NextResponse.json({ knowledge: result.rows[0] });
}
