import { NextRequest, NextResponse } from "next/server";

import { getWorkspaceContext, requireWorkspacePermission, WorkspaceAccessError, WorkspacePermissionError } from "@/lib/db";
import { deleteInquiryImage, getInquiryImageData } from "@/lib/inquiryImages";

type RouteContext = {
  params: Promise<{ id: string; imageId: string }>;
};

// 이미지 바이너리 스트리밍. 워크스페이스 게이트를 통과한 요청만 원본을 받는다.
export async function GET(request: NextRequest, context: RouteContext) {
  const workspaceContext = await getWorkspaceContext(request).catch((error) => {
    if (error instanceof WorkspaceAccessError) return null;
    throw error;
  });
  if (!workspaceContext) return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });

  const { id, imageId } = await context.params;
  const image = await getInquiryImageData(workspaceContext.workspaceId, id, imageId);
  if (!image) return NextResponse.json({ error: "Image not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(image.data), {
    status: 200,
    headers: {
      "Content-Type": image.mime,
      "Content-Length": String(image.data.byteLength),
      // 워크스페이스 전용 자료이므로 공유 캐시에 남기지 않는다.
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const workspaceContext = await getWorkspaceContext(request).catch((error) => {
    if (error instanceof WorkspaceAccessError) return null;
    throw error;
  });
  if (!workspaceContext) return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });
  try {
    requireWorkspacePermission(workspaceContext, "inquiry.update");
  } catch (error) {
    if (error instanceof WorkspacePermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const { id, imageId } = await context.params;
  const deleted = await deleteInquiryImage(workspaceContext.workspaceId, id, imageId);
  if (!deleted) return NextResponse.json({ error: "Image not found" }, { status: 404 });

  return NextResponse.json({ ok: true, id: imageId });
}
