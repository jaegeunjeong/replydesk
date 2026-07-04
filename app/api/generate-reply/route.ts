import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_AI_MODEL } from "@/lib/constants";
import { getWorkspaceContext, pool, WorkspaceAccessError } from "@/lib/db";

const DEFAULT_AI_DAILY_LIMIT = 200;

type GenerateReplyPayload = {
  model?: string;
  businessLabel?: string;
  toneLabel?: string;
  responseWindow?: string;
  customer?: string;
  channel?: string;
  categoryLabel?: string;
  priority?: string;
  message?: string;
  currentReply?: string;
  prices?: string;
  faq?: string;
  tattooArea?: string;
  tattooSize?: string;
  tattooStyle?: string;
  isCoverup?: boolean;
  sessionCount?: number;
  preferredDate?: string;
  missingInfo?: string[];
  includeDeposit?: boolean;
  includeAftercare?: boolean;
};

export async function POST(request: NextRequest) {
  // 다른 데이터 라우트와 동일하게 세션/워크스페이스 검증을 거친다.
  // (인증 없이 열려 있으면 OpenAI 비용이 그대로 남용될 수 있다.)
  const context = await getWorkspaceContext(request).catch((error) => {
    if (error instanceof WorkspaceAccessError) return null;
    throw error;
  });
  if (!context) {
    return NextResponse.json({ error: "Workspace access denied" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY 환경 변수를 설정한 뒤 서버를 다시 실행하세요." },
      { status: 400 },
    );
  }

  // 워크스페이스별 일일 호출 한도 확인 (비용 상한).
  const dailyLimit = Number(process.env.AI_DAILY_LIMIT) || DEFAULT_AI_DAILY_LIMIT;
  const usageToday = await pool.query(
    `select count(*)::int as count from ai_usage_log where workspace_id = $1 and created_at >= date_trunc('day', now())`,
    [context.workspaceId],
  );
  if ((usageToday.rows[0]?.count ?? 0) >= dailyLimit) {
    return NextResponse.json(
      { error: `오늘의 AI 초안 생성 한도(${dailyLimit}건)를 초과했습니다. 내일 다시 시도하거나 관리자에게 문의하세요.` },
      { status: 429 },
    );
  }

  const body = (await request.json()) as GenerateReplyPayload;
  const model = body.model || process.env.OPENAI_MODEL || DEFAULT_AI_MODEL;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "You write concise Korean consultation reply drafts for tattoo studios. Do not invent prices, policies, or availability. Use only the provided business context. When discussing tattoo procedures, never claim there is no pain or no side effects.",
        },
        {
          role: "user",
          content: buildPrompt(body),
        },
      ],
    }),
  });

  const data = await response.json();

  await logAiUsage(context, model, response.ok ? "ok" : "error");

  if (!response.ok) {
    return NextResponse.json(
      { error: data.error?.message || "OpenAI API request failed" },
      { status: response.status },
    );
  }

  return NextResponse.json({ reply: extractOutputText(data), model });
}

async function logAiUsage(
  context: { workspaceId: string; userId: string },
  model: string,
  status: string,
) {
  try {
    await pool.query(
      `insert into ai_usage_log (workspace_id, user_id, model, status) values ($1, $2, $3, $4)`,
      [context.workspaceId, context.userId, model, status],
    );
  } catch {
    // 사용량 로깅 실패가 답변 생성 자체를 막지 않도록 무시한다.
  }
}

function buildPrompt(body: GenerateReplyPayload) {
  const lines = [
    `업종: 타투 스튜디오`,
    `응대 톤: ${body.toneLabel || ""}`,
    `예상 응답 시간: ${body.responseWindow || ""}`,
    `고객명: ${body.customer || ""}`,
    `채널: ${body.channel || ""}`,
    `문의 유형: ${body.categoryLabel || ""}`,
    `우선순위: ${body.priority || ""}`,
    `고객 문의: ${body.message || ""}`,
  ];

  if (body.tattooArea) lines.push(`시술 부위: ${body.tattooArea}`);
  if (body.tattooSize) lines.push(`크기: ${body.tattooSize}`);
  if (body.tattooStyle) lines.push(`스타일: ${body.tattooStyle}`);
  if (body.isCoverup) lines.push(`커버업 여부: 예`);
  if (body.sessionCount) lines.push(`예상 세션: ${body.sessionCount}회`);
  if (body.preferredDate) lines.push(`희망 시술일: ${body.preferredDate}`);

  lines.push(
    "",
    "현재 규칙 기반 초안:",
    body.currentReply || "",
    "",
    "가격표:",
    body.prices || "없음",
    "",
    "FAQ:",
    body.faq || "없음",
  );

  if (body.missingInfo && body.missingInfo.length > 0) {
    lines.push("", `아직 확인되지 않은 상담 정보: ${body.missingInfo.join(", ")}. 답변에서 이 정보를 자연스럽게 질문하세요.`);
  }
  if (body.includeDeposit) {
    lines.push("", "요청: 예약금과 취소/변경 정책 안내를 답변에 포함하세요. 컨텍스트에 정책이 없으면 지어내지 말고 정책 확인 후 안내드리겠다고 쓰세요.");
  }
  if (body.includeAftercare) {
    lines.push("", "요청: 시술 후 관리(애프터케어) 안내를 답변에 포함하세요. 컨텍스트에 없는 관리법은 지어내지 마세요.");
  }

  lines.push(
    "",
    "요청: 위 정보만 사용해서 고객에게 바로 보낼 수 있는 한국어 답변 초안을 작성하세요. 추가 확인이 필요한 정보는 자연스럽게 질문하세요.",
  );

  return lines.join("\n");
}

function extractOutputText(data: { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const chunks: string[] = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join("\n").trim();
}
