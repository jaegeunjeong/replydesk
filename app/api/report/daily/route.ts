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
          tattoo_area,
          tattoo_size,
          tattoo_style,
          preferred_date,
          has_reference_image,
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
      (select count(*) from today)::int                                            as today_total,
      (select count(*) from today where status in ('booked','completed'))::int     as today_converted,
      (select count(*) from today where status in ('new','info_requested','quoted','deposit_pending','aftercare'))::int as today_open,
      (select count(*) from today where priority = '긴급')::int                    as today_urgent,
      (select count(*) from today where status = 'new')::int                       as today_new,
      (select count(*) from today where status = 'info_requested')::int            as today_info_requested,
      (select count(*) from today where status = 'quoted')::int                    as today_quoted,
      (select count(*) from today where status = 'deposit_pending')::int           as today_deposit_pending,
      (select count(*) from today where status = 'booked')::int                    as today_booked,
      (select count(*) from today where status = 'completed')::int                 as today_completed,
      (select count(*) from today where status = 'aftercare')::int                 as today_aftercare,
      (select count(*) from today where status = 'closed')::int                    as today_closed,
      (select count(*) from today where
          coalesce(tattoo_area, '') = ''
          or coalesce(tattoo_size, '') = ''
          or coalesce(tattoo_style, '') = ''
          or coalesce(preferred_date, '') = ''
          or (category in ('quote','booking','coverup','retouch') and has_reference_image = false)
      )::int                                                                        as today_info_gap,
      (select count(*) from all_inquiries where status in ('new','info_requested','quoted','deposit_pending','aftercare'))::int as total_open,
      (select count(*) from all_inquiries where status = 'booked')::int            as total_booked,
      (select count(*) from all_inquiries where status = 'completed')::int         as total_completed,
      (select count(*) from all_inquiries where status = 'closed')::int            as total_closed,
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
        converted: row.today_converted,
        open: row.today_open,
        urgent: row.today_urgent,
        new: row.today_new,
        infoRequested: row.today_info_requested,
        quoted: row.today_quoted,
        depositPending: row.today_deposit_pending,
        booked: row.today_booked,
        completed: row.today_completed,
        aftercare: row.today_aftercare,
        closed: row.today_closed,
        infoGap: row.today_info_gap,
      },
      all: {
        open: row.total_open,
        booked: row.total_booked,
        completed: row.total_completed,
        closed: row.total_closed,
      },
      topCategories: row.top_categories as { category: string; cnt: number }[],
      repeatCustomers: row.repeat_customers as { name: string; cnt: number }[],
    },
  });
}
