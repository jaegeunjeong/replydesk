import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { hashPassword } from "@/lib/auth";
import { pool } from "@/lib/db";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { name?: string; email?: string; password?: string; workspaceName?: string };
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const name = String(body.name || "").trim() || email.split("@")[0];
  const workspaceName = String(body.workspaceName || "").trim() || `${name} 워크스페이스`;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const userId = getStableId("user", email);
  const workspaceId = getStableId("workspace", `${email}:${workspaceName}`);
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query(
      `
      insert into app_users (id, name, email, password_hash, updated_at)
      values ($1, $2, $3, $4, now())
      `,
      [userId, name, email, hashPassword(password)],
    );
    await client.query(
      `
      insert into workspaces (id, name, profile, updated_at)
      values ($1, $2, 'tattoo', now())
      `,
      [workspaceId, workspaceName],
    );
    await client.query(
      `
      insert into workspace_members (workspace_id, user_id, role)
      values ($1, $2, 'owner')
      `,
      [workspaceId, userId],
    );
    await client.query(
      `
      insert into workspace_settings (
        workspace_id,
        business_profile,
        tone_profile,
        response_window,
        channels,
        intake_fields,
        welcome_message,
        updated_at
      )
      values ($1, 'tattoo', 'warm', 'fast', $2, $3, $4, now())
      `,
      [
        workspaceId,
        ["인스타 DM", "카카오톡"],
        ["시술 부위", "크기", "스타일"],
        "문의 주셔서 감사합니다. 시술 관련 내용 확인 후 빠르게 안내드리겠습니다.",
      ],
    );
    await client.query("commit");

    const response = NextResponse.json({ ok: true, user: { id: userId, name, email }, workspaceId });
    setSessionCookies(response, userId, workspaceId);
    return response;
  } catch (error) {
    await client.query("rollback");
    const message = error instanceof Error && error.message.includes("duplicate") ? "Email already exists" : "Failed to create account";
    return NextResponse.json({ error: message }, { status: 400 });
  } finally {
    client.release();
  }
}

function getStableId(prefix: string, value: string) {
  return `${prefix}_${createHash("sha256").update(value).digest("hex").slice(0, 18)}`;
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
