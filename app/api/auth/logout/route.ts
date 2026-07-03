import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("replydesk_user");
  response.cookies.delete("replydesk_workspace");
  return response;
}
