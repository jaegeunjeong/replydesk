import { randomUUID } from "crypto";
import { pool } from "@/lib/db";
import { MAX_REFERENCE_IMAGES } from "@/lib/constants";

// 참고 이미지 저장 계층. 현재는 Postgres bytea에 보관한다.
// 오브젝트 스토리지(R2/S3)로 옮길 때 이 파일의 read/write만 교체하면 라우트·UI는 그대로 둘 수 있다.

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 장당 2MB (클라이언트 리사이즈 후 기준)
export const MAX_IMAGES_PER_INQUIRY = MAX_REFERENCE_IMAGES;
export const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME)[number];

export type InquiryImageMeta = {
  id: string;
  inquiryId: string;
  filename: string;
  mime: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  createdAt: string;
};

// 확장자·헤더를 믿지 않고 실제 바이트(매직 넘버)로 이미지 형식을 판별한다.
export function sniffImageMime(buf: Buffer): AllowedImageMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

const META_COLUMNS = `
  id,
  inquiry_id as "inquiryId",
  filename,
  mime,
  byte_size as "byteSize",
  width,
  height,
  created_at as "createdAt"
`;

// 이미지 첨부 전, 해당 문의가 이 워크스페이스에 실제로 존재하는지 확인한다.
export async function inquiryExists(workspaceId: string, inquiryId: string): Promise<boolean> {
  const result = await pool.query(`select 1 from inquiries where id = $1 and workspace_id = $2`, [inquiryId, workspaceId]);
  return result.rowCount !== null && result.rowCount > 0;
}

export async function countInquiryImages(workspaceId: string, inquiryId: string): Promise<number> {
  const result = await pool.query(
    `select count(*)::int as count from inquiry_images where inquiry_id = $1 and workspace_id = $2`,
    [inquiryId, workspaceId],
  );
  return result.rows[0]?.count ?? 0;
}

export async function listInquiryImages(workspaceId: string, inquiryId: string): Promise<InquiryImageMeta[]> {
  const result = await pool.query(
    `select ${META_COLUMNS} from inquiry_images where inquiry_id = $1 and workspace_id = $2 order by created_at asc`,
    [inquiryId, workspaceId],
  );
  return result.rows as InquiryImageMeta[];
}

export async function insertInquiryImage(params: {
  workspaceId: string;
  inquiryId: string;
  filename: string;
  mime: AllowedImageMime;
  data: Buffer;
  width?: number | null;
  height?: number | null;
}): Promise<InquiryImageMeta> {
  const id = `img_${randomUUID().replace(/-/g, "")}`;
  const result = await pool.query(
    `
    insert into inquiry_images (id, inquiry_id, workspace_id, filename, mime, byte_size, width, height, data)
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    returning ${META_COLUMNS}
    `,
    [
      id,
      params.inquiryId,
      params.workspaceId,
      params.filename,
      params.mime,
      params.data.byteLength,
      params.width ?? null,
      params.height ?? null,
      params.data,
    ],
  );
  return result.rows[0] as InquiryImageMeta;
}

export async function getInquiryImageData(
  workspaceId: string,
  inquiryId: string,
  imageId: string,
): Promise<{ mime: string; data: Buffer } | null> {
  const result = await pool.query(
    `select mime, data from inquiry_images where id = $1 and inquiry_id = $2 and workspace_id = $3`,
    [imageId, inquiryId, workspaceId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { mime: row.mime as string, data: row.data as Buffer };
}

export async function deleteInquiryImage(workspaceId: string, inquiryId: string, imageId: string): Promise<boolean> {
  const result = await pool.query(
    `delete from inquiry_images where id = $1 and inquiry_id = $2 and workspace_id = $3 returning id`,
    [imageId, inquiryId, workspaceId],
  );
  return result.rowCount !== null && result.rowCount > 0;
}
