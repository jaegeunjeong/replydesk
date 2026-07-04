import { NextRequest, NextResponse } from "next/server";

import { verifyPassword } from "@/lib/auth";
import { createSession, DEFAULT_WORKSPACE_ID, pool, setSessionCookie } from "@/lib/db";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { email?: string; password?: string };
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const userResult = await pool.query(
    `
    select id, name, email, password_hash as "passwordHash"
    from app_users
    where email = $1
    limit 1
    `,
    [email],
  );
  const user = userResult.rows[0];

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const workspaceResult = await pool.query(
    `
    select workspace_id as "workspaceId"
    from workspace_members
    where user_id = $1
    order by created_at
    limit 1
    `,
    [user.id],
  );
  const workspaceId = workspaceResult.rows[0]?.workspaceId || DEFAULT_WORKSPACE_ID;

  const token = await createSession(user.id, workspaceId);
  const response = NextResponse.json({ ok: true, user: { id: user.id, name: user.name, email: user.email }, workspaceId });
  setSessionCookie(response, token);
  return response;
}
