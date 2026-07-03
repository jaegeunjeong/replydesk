import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";

import { getWorkspaceContext, pool, requireWorkspacePermission, WorkspaceAccessError, WorkspacePermissionError } from "@/lib/db";

type InquiryPayload = {
  id: string;
  customer?: string;
  channel?: string;
  message: string;
  category: string;
  priority: string;
  keywords?: string[];
  reply: string;
  status?: string;
  profile?: string;
  tone?: string;
  responseWindow?: string;
  aiGeneratedAt?: string;
  aiModel?: string;
  aiDraft?: string;
  aiQuality?: unknown;
  replyRevisionLog?: unknown[];
  assigneeId?: string | null;
  internalNote?: string;
  timeline?: unknown[];
  tattooArea?: string | null;
  tattooSize?: string | null;
  tattooStyle?: string | null;
  isCoverup?: boolean;
  sessionCount?: number | null;
  quotedPrice?: string | null;
  preferredDate?: string | null;
};

export async function GET(request: NextRequest) {
  const context = await getWorkspaceContext(request).catch((error) => {
    if (error instanceof WorkspaceAccessError) return null;
    throw error;
  });
  if (!context) return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });

  const result = await pool.query(
    `
    select
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
      quoted_price as "quotedPrice",
      preferred_date as "preferredDate"
    from inquiries
    where workspace_id = $1
    order by created_at desc
    `,
    [context.workspaceId],
  );

  return NextResponse.json({ inquiries: result.rows });
}

export async function POST(request: NextRequest) {
  const context = await getWorkspaceContext(request).catch((error) => {
    if (error instanceof WorkspaceAccessError) return null;
    throw error;
  });
  if (!context) return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });
  try {
    requireWorkspacePermission(context, "inquiry.create");
  } catch (error) {
    if (error instanceof WorkspacePermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const body = await request.json();
  const inquiries = Array.isArray(body?.inquiries) ? body.inquiries : [body];

  const client = await pool.connect();

  try {
    await client.query("begin");

    for (const inquiry of inquiries as InquiryPayload[]) {
      const customerName = inquiry.customer || "미확인 고객";
      const channel = inquiry.channel || "미확인";
      const customerKey = getCustomerKey(customerName, channel);
      const customerId = getCustomerId(context.workspaceId, customerKey);
      const contact = extractContact(channel);

      await client.query(
        `
        insert into customers (
          id,
          workspace_id,
          normalized_key,
          name,
          channel,
          contact,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, now(), now())
        on conflict (workspace_id, normalized_key) do update set
          name = excluded.name,
          channel = excluded.channel,
          contact = coalesce(excluded.contact, customers.contact),
          updated_at = now()
        `,
        [customerId, context.workspaceId, customerKey, customerName, channel, contact],
      );

      await client.query(
        `
        insert into inquiries (
          id,
          workspace_id,
          customer_id,
          customer_name,
          channel,
          message,
          category,
          priority,
          keywords,
          reply,
          status,
          profile,
          tone,
          response_window,
          ai_generated_at,
          ai_model,
          ai_draft,
          ai_quality,
          reply_revision_log,
          assignee_id,
          internal_note,
          timeline,
          tattoo_area,
          tattoo_size,
          tattoo_style,
          is_coverup,
          session_count,
          quoted_price,
          preferred_date,
          created_at,
          updated_at
        )
        values (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, $17, $18::jsonb, $19::jsonb,
          $20, $21, $22::jsonb,
          $23, $24, $25, $26, $27, $28, $29,
          now(), now()
        )
        on conflict (id) do update set
          customer_id = excluded.customer_id,
          customer_name = excluded.customer_name,
          channel = excluded.channel,
          message = excluded.message,
          category = excluded.category,
          priority = excluded.priority,
          keywords = excluded.keywords,
          reply = excluded.reply,
          status = excluded.status,
          profile = excluded.profile,
          tone = excluded.tone,
          response_window = excluded.response_window,
          ai_generated_at = excluded.ai_generated_at,
          ai_model = excluded.ai_model,
          ai_draft = excluded.ai_draft,
          ai_quality = excluded.ai_quality,
          reply_revision_log = excluded.reply_revision_log,
          assignee_id = excluded.assignee_id,
          internal_note = excluded.internal_note,
          timeline = excluded.timeline,
          tattoo_area = excluded.tattoo_area,
          tattoo_size = excluded.tattoo_size,
          tattoo_style = excluded.tattoo_style,
          is_coverup = excluded.is_coverup,
          session_count = excluded.session_count,
          quoted_price = excluded.quoted_price,
          preferred_date = excluded.preferred_date,
          updated_at = now()
        `,
        [
          inquiry.id,
          context.workspaceId,
          customerId,
          customerName,
          channel,
          inquiry.message,
          inquiry.category,
          inquiry.priority,
          inquiry.keywords || [],
          inquiry.reply,
          inquiry.status || "new",
          inquiry.profile || "tattoo",
          inquiry.tone || "warm",
          inquiry.responseWindow || "fast",
          inquiry.aiGeneratedAt || null,
          inquiry.aiModel || null,
          inquiry.aiDraft || null,
          JSON.stringify(inquiry.aiQuality || {}),
          JSON.stringify(inquiry.replyRevisionLog || []),
          inquiry.assigneeId || null,
          inquiry.internalNote || "",
          JSON.stringify(inquiry.timeline || []),
          inquiry.tattooArea || null,
          inquiry.tattooSize || null,
          inquiry.tattooStyle || null,
          inquiry.isCoverup || false,
          inquiry.sessionCount || null,
          inquiry.quotedPrice || null,
          inquiry.preferredDate || null,
        ],
      );
    }

    await client.query("commit");

    return NextResponse.json({ ok: true, saved: inquiries.length });
  } catch (error) {
    await client.query("rollback");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save inquiries" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}

export async function DELETE(request: NextRequest) {
  const context = await getWorkspaceContext(request).catch((error) => {
    if (error instanceof WorkspaceAccessError) return null;
    throw error;
  });
  if (!context) return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });
  try {
    requireWorkspacePermission(context, "inquiry.bulk_delete");
  } catch (error) {
    if (error instanceof WorkspacePermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  await pool.query("delete from inquiries where workspace_id = $1", [context.workspaceId]);

  return NextResponse.json({ ok: true });
}

function getCustomerKey(customer: string, channel: string) {
  const normalizedCustomer = normalizeCustomerValue(customer);

  if (normalizedCustomer && normalizedCustomer !== normalizeCustomerValue("이름 미상")) {
    return `customer:${normalizedCustomer}`;
  }

  return `channel:${normalizeCustomerValue(channel || "unknown")}`;
}

function getCustomerId(workspaceId: string, customerKey: string) {
  const hash = createHash("sha256").update(`${workspaceId}:${customerKey}`).digest("hex").slice(0, 24);
  return `cust_${hash}`;
}

function normalizeCustomerValue(value: string) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

function extractContact(channel: string) {
  const phoneLike = channel.match(/(?:\+?\d[\d\s-]{7,}\d)/);
  return phoneLike?.[0]?.replace(/\s+/g, "") ?? null;
}
