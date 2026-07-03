import { NextResponse } from "next/server";

import { pool } from "@/lib/db";

export async function GET() {
  const result = await pool.query<{ now: string }>("select now() as now");

  return NextResponse.json({
    ok: true,
    now: result.rows[0]?.now,
  });
}
