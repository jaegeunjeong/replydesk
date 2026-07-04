import { NextRequest, NextResponse } from "next/server";

import { getWorkspaceContext, pool, requireWorkspacePermission, WorkspaceAccessError, WorkspacePermissionError } from "@/lib/db";
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_INQUIRY,
  countInquiryImages,
  inquiryExists,
  insertInquiryImage,
  listInquiryImages,
  sniffImageMime,
} from "@/lib/inquiryImages";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// 참고 이미지 목록(메타데이터만) — 바이너리는 [imageId] 스트리밍 라우트에서 받는다.
export async function GET(request: NextRequest, context: RouteContext) {
  const workspaceContext = await getWorkspaceContext(request).catch((error) => {
    if (error instanceof WorkspaceAccessError) return null;
    throw error;
  });
  if (!workspaceContext) return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });

  const { id } = await context.params;
  const images = await listInquiryImages(workspaceContext.workspaceId, id);
  return NextResponse.json({ images });
}

// 참고 이미지 업로드. 클라이언트는 리사이즈 후 한 번에 한 장씩 보내는 것을 권장(요청 본문 크기 제한 회피).
export async function POST(request: NextRequest, context: RouteContext) {
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

  const { id } = await context.params;
  if (!(await inquiryExists(workspaceContext.workspaceId, id))) {
    return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "업로드할 이미지가 없습니다." }, { status: 400 });
  }

  const existingCount = await countInquiryImages(workspaceContext.workspaceId, id);
  if (existingCount + files.length > MAX_IMAGES_PER_INQUIRY) {
    return NextResponse.json(
      { error: `참고 이미지는 문의당 최대 ${MAX_IMAGES_PER_INQUIRY}장까지 첨부할 수 있습니다.` },
      { status: 400 },
    );
  }

  // 저장 전에 전부 검증한다 (한 장이라도 문제면 부분 저장 없이 거부).
  const prepared: { filename: string; mime: ReturnType<typeof sniffImageMime>; data: Buffer }[] = [];
  for (const file of files) {
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: `이미지 한 장은 최대 ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB까지 가능합니다.` },
        { status: 413 },
      );
    }
    const data = Buffer.from(await file.arrayBuffer());
    const mime = sniffImageMime(data);
    if (!mime) {
      return NextResponse.json(
        { error: "지원하지 않는 이미지 형식입니다. (JPEG·PNG·WEBP만 가능)" },
        { status: 415 },
      );
    }
    prepared.push({ filename: file.name || "reference", mime, data });
  }

  const saved = [];
  for (const item of prepared) {
    saved.push(
      await insertInquiryImage({
        workspaceId: workspaceContext.workspaceId,
        inquiryId: id,
        filename: item.filename,
        mime: item.mime!,
        data: item.data,
      }),
    );
  }

  // 참고 이미지가 하나라도 저장되면 '참고 이미지 받음'을 자동으로 켠다.
  await pool.query(
    `update inquiries set has_reference_image = true, updated_at = now() where id = $1 and workspace_id = $2`,
    [id, workspaceContext.workspaceId],
  );

  return NextResponse.json({ images: saved });
}
