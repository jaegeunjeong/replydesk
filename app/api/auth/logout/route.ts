import { NextRequest, NextResponse } from "next/server";

import { clearSessionCookie, deleteSession, SESSION_COOKIE } from "@/lib/db";

export async function POST(request: NextRequest) {
  await deleteSession(request.cookies.get(SESSION_COOKIE)?.value);
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
