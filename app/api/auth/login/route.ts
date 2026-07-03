import { NextRequest, NextResponse } from "next/server";

import { hashPassword, verifyPassword } from "@/lib/auth";
import { DEFAULT_WORKSPACE_ID, pool } from "@/lib/db";

const LEGACY_DEMO_PASSWORD = "admin1234";

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

  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const legacyDemoLogin = !user.passwordHash && password === LEGACY_DEMO_PASSWORD;
  if (!legacyDemoLogin && !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  if (legacyDemoLogin) {
    await pool.query("update app_users set password_hash = $2, updated_at = now() where id = $1", [user.id, hashPassword(password)]);
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

  const response = NextResponse.json({ ok: true, user: { id: user.id, name: user.name, email: user.email }, workspaceId });
  setSessionCookies(response, user.id, workspaceId);
  return response;
}

function setSessionCookies(response: NextResponse, userId: string, workspaceId: string) {
  response.cookies.set("replydesk_user", userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  response.cookies.set("replydesk_workspace", workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
