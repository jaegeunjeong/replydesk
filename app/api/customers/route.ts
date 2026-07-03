import { NextRequest, NextResponse } from "next/server";

import { getWorkspaceContext, pool, WorkspaceAccessError } from "@/lib/db";

export async function GET(request: NextRequest) {
  const context = await getWorkspaceContext(request).catch((error) => {
    if (error instanceof WorkspaceAccessError) return null;
    throw error;
  });
  if (!context) return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });

  const result = await pool.query(
    `
    select
      customers.id,
      customers.name,
      customers.channel,
      customers.contact,
      customers.status,
      customers.tags,
      customers.note,
      customers.skin_notes as "skinNotes",
      customers.normalized_key as "normalizedKey",
      count(inquiries.id)::int as "inquiryCount",
      max(inquiries.created_at) as "lastInquiryAt",
      customers.created_at as "createdAt",
      customers.updated_at as "updatedAt"
    from customers
    left join inquiries
      on inquiries.customer_id = customers.id
      and inquiries.workspace_id = customers.workspace_id
    where customers.workspace_id = $1
    group by customers.id
    having count(inquiries.id) > 0
    order by "lastInquiryAt" desc nulls last, customers.updated_at desc
    `,
    [context.workspaceId],
  );

  return NextResponse.json({ customers: result.rows });
}
