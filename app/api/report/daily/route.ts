import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceContext, pool, WorkspaceAccessError } from "@/lib/db";

export async function GET(request: NextRequest) {
  const context = await getWorkspaceContext(request).catch((error) => {
    if (error instanceof WorkspaceAccessError) return null;
    throw error;
  });
  if (!context) return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });

  const tz = request.nextUrl.searchParams.get("tz") || "Asia/Seoul";

  const result = await pool.query(
    `
    with
      all_inquiries as (
        select
          id,
          status,
          category,
          priority,
          created_at,
          (created_at at time zone $2)::date = (now() at time zone $2)::date as is_today
        from inquiries
        where workspace_id = $1
      ),
      today as (
        select * from all_inquiries where is_today
      ),
      top_cats as (
        select category, count(*) as cnt
        from all_inquiries
        where is_today
        group by category
        order by cnt desc
        limit 3
      ),
      repeat_customers as (
        select customer_id, count(*) as cnt
        from inquiries
        where workspace_id = $1
          and (created_at at time zone $2)::date = (now() at time zone $2)::date
        group by customer_id
        having count(*) >= 2
      ),
      top_customers as (
        select c.name, rc.cnt
        from repeat_customers rc
        join customers c on c.id = rc.customer_id
        order by rc.cnt desc
        limit 5
      )
    select
      (select count(*) from today)::int                                       as today_total,
      (select count(*) from today where status = 'done')::int                 as today_done,
      (select count(*) from today where status != 'done')::int                as today_open,
      (select count(*) from today where priority = '긴급')::int               as today_urgent,
      (select count(*) from today where status = 'new')::int                  as today_new,
      (select count(*) from today where status = 'drafted')::int              as today_drafted,
      (select count(*) from today where status = 'pending')::int              as today_pending,
      (select count(*) from today where status = 'escalated')::int            as today_escalated,
      (select count(*) from all_inquiries where status != 'done')::int        as total_open,
      (select count(*) from all_inquiries where status = 'done')::int         as total_done,
      (select coalesce(json_agg(row_to_json(top_cats)), '[]'::json) from top_cats) as top_categories,
      (select coalesce(json_agg(row_to_json(top_customers)), '[]'::json) from top_customers) as repeat_customers
    `,
    [context.workspaceId, tz],
  );

  const row = result.rows[0];

  return NextResponse.json({
    report: {
      date: new Date().toLocaleDateString("ko-KR", { timeZone: tz, year: "numeric", month: "long", day: "numeric", weekday: "short" }),
      today: {
        total: row.today_total,
        done: row.today_done,
        open: row.today_open,
        urgent: row.today_urgent,
        new: row.today_new,
        drafted: row.today_drafted,
        pending: row.today_pending,
        escalated: row.today_escalated,
      },
      all: {
        open: row.total_open,
        done: row.total_done,
      },
      topCategories: row.top_categories as { category: string; cnt: number }[],
      repeatCustomers: row.repeat_customers as { name: string; cnt: number }[],
    },
  });
}
