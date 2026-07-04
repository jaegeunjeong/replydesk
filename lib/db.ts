import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { NextRequest, NextResponse } from "next/server";
import { hasPermission, Permission } from "@/lib/permissions";

declare global {
  // eslint-disable-next-line no-var
  var replydeskPgPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}

export const pool =
  globalThis.replydeskPgPool ??
  new Pool({
    connectionString,
    ssl: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.replydeskPgPool = pool;
}

export const DEFAULT_WORKSPACE_ID = "default-workspace";
export const DEFAULT_USER_ID = "demo-owner";

export async function ensureDefaultWorkspace() {
  await pool.query(
    `
    insert into workspaces (id, name, profile)
    values ($1, $2, $3)
    on conflict (id) do update set
      name = excluded.name,
      profile = excluded.profile,
      updated_at = now()
    `,
    [DEFAULT_WORKSPACE_ID, "타투 스튜디오 데모", "tattoo"],
  );
}

export type WorkspaceContext = {
  userId: string;
  workspaceId: string;
  role: string;
};

// --- 세션 토큰 ---
// 세션은 서명 없는 사용자 ID 쿠키가 아니라, 추측 불가능한 랜덤 토큰으로 관리한다.
// 토큰은 sessions 테이블에 저장되며 서버가 언제든 무효화(로그아웃)할 수 있다.

export const SESSION_COOKIE = "replydesk_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export type SessionRecord = {
  token: string;
  userId: string;
  workspaceId: string | null;
};

export async function createSession(userId: string, workspaceId: string | null): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await pool.query(
    `
    insert into sessions (token, user_id, workspace_id, expires_at)
    values ($1, $2, $3, now() + ($4 || ' seconds')::interval)
    `,
    [token, userId, workspaceId, String(SESSION_TTL_SECONDS)],
  );
  return token;
}

export async function resolveSession(token: string | undefined | null): Promise<SessionRecord | null> {
  if (!token) return null;
  const result = await pool.query(
    `
    select token, user_id as "userId", workspace_id as "workspaceId"
    from sessions
    where token = $1
      and expires_at > now()
    limit 1
    `,
    [token],
  );
  return result.rows[0] ?? null;
}

export async function updateSessionWorkspace(token: string, workspaceId: string): Promise<void> {
  await pool.query(`update sessions set workspace_id = $2 where token = $1`, [token, workspaceId]);
}

export async function deleteSession(token: string | undefined | null): Promise<void> {
  if (!token) return;
  await pool.query(`delete from sessions where token = $1`, [token]);
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.delete(SESSION_COOKIE);
}

export async function getWorkspaceContext(request: NextRequest): Promise<WorkspaceContext> {
  await ensureDefaultWorkspace();

  const session = await resolveSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session || !session.workspaceId) {
    throw new WorkspaceAccessError();
  }

  const membership = await pool.query(
    `
    select role
    from workspace_members
    where user_id = $1
      and workspace_id = $2
    limit 1
    `,
    [session.userId, session.workspaceId],
  );

  if (!membership.rows[0]) {
    throw new WorkspaceAccessError();
  }

  return { userId: session.userId, workspaceId: session.workspaceId, role: membership.rows[0].role };
}

export function requireWorkspacePermission(context: WorkspaceContext, permission: Permission) {
  if (!hasPermission(context.role, permission)) {
    throw new WorkspacePermissionError(permission);
  }
}

export class WorkspaceAccessError extends Error {
  constructor() {
    super("Workspace access denied");
  }
}

export class WorkspacePermissionError extends Error {
  constructor(public permission: Permission) {
    super(`Permission required: ${permission}`);
  }
}
