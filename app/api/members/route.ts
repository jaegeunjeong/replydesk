import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { hashPassword } from "@/lib/auth";
import { getWorkspaceContext, pool, requireWorkspacePermission, WorkspaceAccessError, WorkspaceContext, WorkspacePermissionError } from "@/lib/db";
import { isWorkspaceRole, roleLabels, WorkspaceRole } from "@/lib/permissions";

const INVITABLE_ROLES: WorkspaceRole[] = ["member"];

export async function GET(request: NextRequest) {
  const context = await getWorkspaceContext(request).catch((error) => {
    if (error instanceof WorkspaceAccessError) return null;
    throw error;
  });
  if (!context) return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });

  const result = await pool.query(
    `
    select
      app_users.id,
      app_users.name,
      app_users.email,
      workspace_members.role,
      workspace_members.created_at as "joinedAt"
    from workspace_members
    join app_users on app_users.id = workspace_members.user_id
    where workspace_members.workspace_id = $1
    order by
      case workspace_members.role
        when 'owner' then 1
        when 'member' then 2
        else 3
      end,
      app_users.name
    `,
    [context.workspaceId],
  );

  return NextResponse.json({ members: result.rows });
}

export async function POST(request: NextRequest) {
  const context = await getWorkspaceContext(request).catch((error) => {
    if (error instanceof WorkspaceAccessError) return null;
    throw error;
  });
  if (!context) return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });

  const permissionError = requireMemberManage(context);
  if (permissionError) return permissionError;

  const body = (await request.json()) as { email?: string; name?: string; role?: string };
  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim() || email.split("@")[0] || "새 멤버";
  const role = body.role || "member";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }
  if (!isWorkspaceRole(role) || !INVITABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const userId = getUserId(email);
  const client = await pool.connect();

  try {
    await client.query("begin");

    // 신규 계정이거나 비밀번호가 아직 없는 계정에만 임시 비밀번호를 발급한다.
    // (이미 비밀번호를 설정한 기존 멤버를 재초대해도 비밀번호를 덮어쓰지 않는다.)
    const existing = await client.query(
      "select id, password_hash as \"passwordHash\" from app_users where email = $1 limit 1",
      [email],
    );
    let resolvedUserId = existing.rows[0]?.id || userId;
    let tempPassword = null;

    if (!existing.rows[0]) {
      tempPassword = generateTempPassword();
      await client.query(
        "insert into app_users (id, name, email, password_hash, updated_at) values ($1, $2, $3, $4, now())",
        [userId, name, email, hashPassword(tempPassword)],
      );
      resolvedUserId = userId;
    } else if (!existing.rows[0].passwordHash) {
      tempPassword = generateTempPassword();
      await client.query(
        "update app_users set name = $2, password_hash = $3, updated_at = now() where id = $1",
        [resolvedUserId, name, hashPassword(tempPassword)],
      );
    } else {
      await client.query("update app_users set name = $2, updated_at = now() where id = $1", [resolvedUserId, name]);
    }

    const member = await client.query(
      `
      insert into workspace_members (workspace_id, user_id, role)
      values ($1, $2, $3)
      on conflict (workspace_id, user_id) do update set
        role = excluded.role
      returning user_id as id, role
      `,
      [context.workspaceId, resolvedUserId, role],
    );

    await client.query("commit");

    return NextResponse.json({
      member: {
        id: member.rows[0].id,
        name,
        email,
        role,
        roleLabel: roleLabels[role],
      },
      tempPassword,
    });
  } catch (error) {
    await client.query("rollback");
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to invite member" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}

function requireMemberManage(context: WorkspaceContext) {
  try {
    requireWorkspacePermission(context, "member.manage");
    return null;
  } catch (error) {
    if (error instanceof WorkspacePermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
}

function getUserId(email: string) {
  const hash = createHash("sha256").update(email).digest("hex").slice(0, 18);
  return `user_${hash}`;
}

function generateTempPassword() {
  // 12자 랜덤 문자열(base64url). 최소 비밀번호 길이(8) 정책을 충족한다.
  return randomBytes(9).toString("base64url");
}
