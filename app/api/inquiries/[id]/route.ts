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
    update inquiries
    set
      message = coalesce($3, message),
      category = coalesce($4, category),
      priority = coalesce($5, priority),
      keywords = coalesce($6, keywords),
      reply = coalesce($7, reply),
      status = coalesce($8, status),
      profile = coalesce($9, profile),
      tone = coalesce($10, tone),
      response_window = coalesce($11, response_window),
      ai_generated_at = coalesce($12, ai_generated_at),
      ai_model = coalesce($13, ai_model),
      ai_draft = coalesce($14, ai_draft),
      ai_quality = coalesce($15::jsonb, ai_quality),
      reply_revision_log = coalesce($16::jsonb, reply_revision_log),
      assignee_id = coalesce($17, assignee_id),
      internal_note = coalesce($18, internal_note),
      timeline = coalesce($19::jsonb, timeline),
      tattoo_area = coalesce($20, tattoo_area),
      tattoo_size = coalesce($21, tattoo_size),
      tattoo_style = coalesce($22, tattoo_style),
      is_coverup = coalesce($23, is_coverup),
      session_count = coalesce($24, session_count),
      quoted_price = coalesce($25, quoted_price),
      updated_at = now()
    where id = $1
      and workspace_id = $2
    returning
      id,
      customer_id as "customerId",
      customer_name as customer,
      channel,
      message,
      category,
      priority,
      keywords,
      reply,
      status,
      created_at as "createdAt",
      profile,
      tone,
      response_window as "responseWindow",
      ai_generated_at as "aiGeneratedAt",
      ai_model as "aiModel",
      ai_draft as "aiDraft",
      ai_quality as "aiQuality",
      reply_revision_log as "replyRevisionLog",
      assignee_id as "assigneeId",
      internal_note as "internalNote",
      timeline,
      tattoo_area as "tattooArea",
      tattoo_size as "tattooSize",
      tattoo_style as "tattooStyle",
      is_coverup as "isCoverup",
      session_count as "sessionCount",
      quoted_price as "quotedPrice"
    `,
    [
      id,
      workspaceContext.workspaceId,
      body.message ?? null,
      body.category ?? null,
      body.priority ?? null,
      body.keywords ?? null,
      body.reply ?? null,
      body.status ?? null,
      body.profile ?? null,
      body.tone ?? null,
      body.responseWindow ?? null,
      body.aiGeneratedAt ?? null,
      body.aiModel ?? null,
      body.aiDraft ?? null,
      body.aiQuality ? JSON.stringify(body.aiQuality) : null,
      body.replyRevisionLog ? JSON.stringify(body.replyRevisionLog) : null,
      body.assigneeId ?? null,
      body.internalNote ?? null,
      body.timeline ? JSON.stringify(body.timeline) : null,
      body.tattooArea ?? null,
      body.tattooSize ?? null,
      body.tattooStyle ?? null,
      body.isCoverup ?? null,
      body.sessionCount ?? null,
      body.quotedPrice ?? null,
    ],
  );

  if (!result.rows[0]) {
    return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
  }

  return NextResponse.json({ inquiry: result.rows[0] });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const workspaceContext = await getWorkspaceContext(_request).catch((error) => {
    if (error instanceof WorkspaceAccessError) return null;
    throw error;
  });
  if (!workspaceContext) return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });
  try {
    requireWorkspacePermission(workspaceContext, "inquiry.delete");
  } catch (error) {
    if (error instanceof WorkspacePermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const { id } = await context.params;
  const result = await pool.query(
    `
    delete from inquiries
    where id = $1
      and workspace_id = $2
    returning id
    `,
    [id, workspaceContext.workspaceId],
  );

  if (!result.rows[0]) {
    return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, id });
}
