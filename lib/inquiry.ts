import type { Inquiry, Category, AiQualityReport, InquiryTimelineItem, Settings, Knowledge, TattooStyle, Status, CustomerStatus } from "@/types";
import {
  businessProfiles,
  toneProfiles,
  responseWindows,
  categoryLabels,
  forbiddenReplyWords,
  tattooStyleLabels,
  knowledgeSections,
  type KnowledgeSectionKey,
} from "@/lib/constants";
import { normalizeCustomerValue } from "@/lib/utils";

export type TattooFields = {
  tattooArea?: string | null;
  tattooSize?: string | null;
  tattooStyle?: TattooStyle | null;
  isCoverup?: boolean;
  sessionCount?: number | null;
  quotedPrice?: string | null;
  preferredDate?: string | null;
  hasReferenceImage?: boolean;
  referenceImageNote?: string | null;
};

// 응대가 필요한(아직 예약 전환 전이거나 관리 문의인) 상태
export const openInquiryStatuses: Status[] = ["new", "info_requested", "quoted", "deposit_pending", "aftercare"];

export function isOpenInquiryStatus(status: Status) {
  return openInquiryStatuses.includes(status);
}

// faq 텍스트를 "[섹션 라벨]" 헤더 기준으로 나눈다. 헤더 없는 내용(구버전 데이터)은 기타 안내로 들어간다.
export function parseFaqSections(value: string): Record<KnowledgeSectionKey, string> {
  const buckets = Object.fromEntries(knowledgeSections.map((s) => [s.key, [] as string[]])) as Record<
    KnowledgeSectionKey,
    string[]
  >;
  const labelToKey = new Map<string, KnowledgeSectionKey>(knowledgeSections.map((s) => [s.label, s.key]));
  let current: KnowledgeSectionKey = "other";

  for (const raw of value.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const header = line.match(/^\[(.+)\]$/);
    if (header) {
      current = labelToKey.get(header[1].trim()) ?? "other";
      continue;
    }
    buckets[current].push(line);
  }

  return Object.fromEntries(
    knowledgeSections.map((s) => [s.key, buckets[s.key].join("\n")]),
  ) as Record<KnowledgeSectionKey, string>;
}

export function serializeFaqSections(sections: Record<KnowledgeSectionKey, string>): string {
  return knowledgeSections
    .map(({ key, label }) => {
      const content = (sections[key] ?? "").trim();
      return content ? `[${label}]\n${content}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

// AI 초안에 넘길 섹션을 문의 유형과 생성 옵션 기준으로 고른다.
export function getRelevantFaqSectionKeys(
  category: Category,
  options?: { includeDeposit?: boolean; includeAftercare?: boolean },
): KnowledgeSectionKey[] {
  const byCategory: Record<Category, KnowledgeSectionKey[]> = {
    quote: ["conditions", "deposit"],
    booking: ["deposit", "before"],
    coverup: ["coverup", "conditions", "deposit"],
    retouch: ["retouch", "deposit"],
    aftercare: ["aftercare", "retouch"],
    general: ["deposit"],
  };
  const keys = new Set<KnowledgeSectionKey>([...byCategory[category], "other"]);
  if (options?.includeDeposit) keys.add("deposit");
  if (options?.includeAftercare) keys.add("aftercare");
  return knowledgeSections.map((s) => s.key).filter((key) => keys.has(key));
}

export type KnowledgeSourceUsage = {
  used: { key: string; label: string }[];
  missing: { key: string; label: string }[];
};

// AI 초안이 참고할 지식베이스 소스를 문의 유형/옵션 기준으로 분류한다.
// 내용이 있으면 '참고한 소스', 비어 있으면 '비어 있는 소스'로 나눠
// 사용자가 왜 지식베이스를 채워야 하는지(=답변 품질이 왜 달라지는지) 보이게 한다.
export function getKnowledgeSourceUsage(
  category: Category,
  knowledge: { prices: string; faq: string },
  options?: { includeDeposit?: boolean; includeAftercare?: boolean },
): KnowledgeSourceUsage {
  const sections = parseFaqSections(knowledge.faq);
  const used: { key: string; label: string }[] = [];
  const missing: { key: string; label: string }[] = [];

  // 가격표(견적 기준)는 견적/예약/커버업/리터치에서 핵심 참고 자료다.
  const priceRelevant: Category[] = ["quote", "booking", "coverup", "retouch"];
  if (priceRelevant.includes(category)) {
    if (parsePriceBook(knowledge.prices).length > 0) used.push({ key: "prices", label: "견적 기준" });
    else missing.push({ key: "prices", label: "견적 기준" });
  }

  for (const key of getRelevantFaqSectionKeys(category, options)) {
    if (key === "other") continue; // '기타 안내'는 소스 표기에서 생략
    const label = knowledgeSections.find((s) => s.key === key)?.label ?? key;
    if (sections[key]?.trim()) used.push({ key, label });
    else missing.push({ key, label });
  }

  return { used, missing };
}

export type CustomerTattooSummary = {
  recentArea: string | null;
  preferredStyle: string | null;
  latestQuote: string | null;
  bookedCount: number;
  completedCount: number;
  retouchCareCount: number;
};

// 고객 상세 상단 '시술 요약'용 집계. inquiries는 최신순 정렬 가정(getCustomerInquiries).
export function getCustomerTattooSummary(inquiries: Inquiry[]): CustomerTattooSummary {
  const recentArea = inquiries.find((i) => i.tattooArea?.trim())?.tattooArea?.trim() ?? null;
  const latestQuote = inquiries.find((i) => i.quotedPrice?.trim())?.quotedPrice?.trim() ?? null;

  const styleCounts = new Map<TattooStyle, number>();
  inquiries.forEach((i) => {
    if (i.tattooStyle) styleCounts.set(i.tattooStyle, (styleCounts.get(i.tattooStyle) ?? 0) + 1);
  });
  const topStyle = Array.from(styleCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    recentArea,
    preferredStyle: topStyle ? (tattooStyleLabels[topStyle] ?? topStyle) : null,
    latestQuote,
    bookedCount: inquiries.filter((i) => i.status === "booked").length,
    completedCount: inquiries.filter((i) => i.status === "completed" || i.status === "aftercare").length,
    retouchCareCount: inquiries.filter((i) => i.category === "retouch" || i.category === "aftercare").length,
  };
}

export type ConsultChecklist = {
  confirmed: { label: string; value: string }[];
  missing: string[];
  nextQuestion: string | null;
};

// 견적을 내기 위해 확인해야 할 정보를 현재 문의 필드 기준으로 계산한다.
export function getConsultChecklist(inquiry: Inquiry): ConsultChecklist {
  const confirmed: { label: string; value: string }[] = [];
  const missing: string[] = [];

  if (inquiry.tattooArea) confirmed.push({ label: "시술 부위", value: inquiry.tattooArea });
  else missing.push("시술 부위");

  if (inquiry.tattooSize) confirmed.push({ label: "크기", value: inquiry.tattooSize });
  else missing.push("크기");

  if (inquiry.tattooStyle) confirmed.push({ label: "스타일", value: tattooStyleLabels[inquiry.tattooStyle] ?? inquiry.tattooStyle });
  else missing.push("스타일");

  if (inquiry.preferredDate) confirmed.push({ label: "희망 시술일", value: inquiry.preferredDate });
  else missing.push("희망 시술일");

  // 참고 이미지는 견적/예약/커버업/리터치에서 사실상 필수 자료라 별도로 추적한다.
  const imageRelevant: Category[] = ["quote", "booking", "coverup", "retouch"];
  if (imageRelevant.includes(inquiry.category)) {
    if (inquiry.hasReferenceImage) {
      confirmed.push({ label: "참고 이미지", value: inquiry.referenceImageNote?.trim() || "받음" });
    } else {
      missing.push("참고 이미지");
    }
  }

  if (inquiry.isCoverup) confirmed.push({ label: "커버업", value: "예" });
  if (inquiry.quotedPrice) confirmed.push({ label: "견적가", value: inquiry.quotedPrice });

  const nextQuestion =
    missing.length === 0
      ? null
      : `정확한 견적 안내를 위해 ${missing.join(", ")} 정보를 알려주실 수 있을까요? 참고 이미지가 있다면 함께 보내주시면 더 좋아요.`;

  return { confirmed, missing, nextQuestion };
}

// 문의 상태가 파이프라인을 진행할 때 고객 상태를 함께 끌어올린다.
export function customerStatusForInquiryStatus(status: Status): CustomerStatus | null {
  switch (status) {
    case "quoted":
    case "deposit_pending":
      return "consulted";
    case "booked":
      return "booked";
    case "completed":
    case "aftercare":
      return "completed";
    default:
      return null;
  }
}

export function createInquiry(line: string, settings: Settings, knowledge: Knowledge, tattoo?: TattooFields): Inquiry {
  const parts = line.split("|").map((part) => part.trim());
  const hasStructuredInput = parts.length >= 3;
  const customer = hasStructuredInput ? parts[0] : "\uC774\uB984 \uBBF8\uC0C1";
  const channel = hasStructuredInput ? parts[1] : "\uC9C1\uC811 \uC785\uB825";
  const message = hasStructuredInput ? parts.slice(2).join(" | ") : line;
  const analysis = analyzeMessage(message);
  const base = { customer, channel, message, ...analysis };
  const reply = buildReply(base, settings, knowledge);

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "new",
    profile: settings.businessProfile,
    tone: settings.toneProfile,
    responseWindow: settings.responseWindow,
    aiDraft: reply,
    aiQuality: analyzeAiQuality(reply, reply, message),
    replyRevisionLog: [],
    assigneeId: null,
    internalNote: "",
    timeline: [
      {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        actor: "InkDesk",
        label: "\uBB38\uC758 \uC811\uC218 \uBC0F \uCD08\uC548 \uC0DD\uC131",
      },
    ],
    reply,
    tattooArea: tattoo?.tattooArea ?? null,
    tattooSize: tattoo?.tattooSize ?? null,
    tattooStyle: tattoo?.tattooStyle ?? null,
    isCoverup: tattoo?.isCoverup ?? false,
    sessionCount: tattoo?.sessionCount ?? null,
    quotedPrice: tattoo?.quotedPrice ?? null,
    preferredDate: tattoo?.preferredDate ?? null,
    hasReferenceImage: tattoo?.hasReferenceImage ?? false,
    referenceImageNote: tattoo?.referenceImageNote ?? null,
    ...base,
  };
}

export function analyzeMessage(message: string): { category: Category; priority: "\uAE34\uAE09" | "\uBCF4\uD1B5"; keywords: string[] } {
  const text = message.toLowerCase();
  const rules: { category: Category; keywords: string[] }[] = [
    { category: "coverup", keywords: ["\uCEE4\uBC84\uC5C5", "\uCEE4\uBC84", "\uC218\uC815", "\uB36E\uAE30", "\uAE30\uC874 \uD0C0\uD22C", "\uB36E\uC5B4"] },
    { category: "retouch", keywords: ["\uB9AC\uD130\uCE58", "\uD130\uCE58\uC5C5", "\uBCF4\uC815", "\uC0C9 \uBE60\uC9D0", "\uC0C9\uC774 \uBE60\uC84C", "\uBC88\uC9D0"] },
    { category: "aftercare", keywords: ["\uAD00\uB9AC", "\uBCF4\uC2B5", "\uC0E4\uC6CC", "\uC6B4\uB3D9", "\uD587\uBE5B", "\uC560\uD504\uD130\uCF00\uC5B4", "\uC218\uC601", "\uC0AC\uC6B0\uB098"] },
    { category: "quote", keywords: ["\uACAC\uC801", "\uAC00\uACA9", "\uC5BC\uB9C8", "\uBE44\uC6A9", "\uC694\uAE08", "\uD06C\uAE30", "\uC0AC\uC774\uC988"] },
    { category: "booking", keywords: ["\uC608\uC57D", "\uC77C\uC815", "\uC5B8\uC81C", "\uAC00\uB2A5", "\uB0A0\uC9DC", "\uB2E4\uC74C\uC8FC", "\uC624\uD6C4", "\uC624\uC804", "\uD1A0\uC694\uC77C"] },
  ];
  const matched = rules
    .map((rule) => ({ ...rule, score: rule.keywords.filter((keyword) => text.includes(keyword)).length }))
    .filter((rule) => rule.score > 0)
    .sort((a, b) => b.score - a.score)[0];
  const urgentWords = ["\uC624\uB298", "\uC9C0\uAE08", "\uAE09", "\uBC14\uB85C", "\uB0B4\uC77C", "\uCDE8\uC18C"];

  return {
    category: matched?.category ?? "general",
    priority: urgentWords.some((word) => text.includes(word)) ? "\uAE34\uAE09" : "\uBCF4\uD1B5",
    keywords: rules
      .flatMap((rule) => rule.keywords)
      .filter((keyword) => text.includes(keyword))
      .slice(0, 5),
  };
}

export function buildReply(
  inquiry: { customer: string; message: string; category: Category; priority: "\uAE34\uAE09" | "\uBCF4\uD1B5" },
  settings: Settings,
  knowledge: Knowledge,
) {
  const name = inquiry.customer === "\uC774\uB984 \uBBF8\uC0C1" ? "\uACE0\uAC1D\uB2D8" : `${inquiry.customer}\uB2D8`;
  const profile = businessProfiles[settings.businessProfile];
  const tone = toneProfiles[settings.toneProfile];
  const matchedKnowledge = matchKnowledge(inquiry.message, knowledge[settings.businessProfile]);
  const bodies: Record<Category, string> = {
    quote: `\uBB38\uC758\uD558\uC2E0 \uB0B4\uC6A9 \uAE30\uC900\uC73C\uB85C \uACAC\uC801\uC744 \uC548\uB0B4\uB4DC\uB9AC\uACA0\uC2B5\uB2C8\uB2E4. ${profile.quoteAsk}`,
    booking: `\uB9D0\uC500\uD558\uC2E0 \uC77C\uC815 \uD655\uC778 \uD6C4 \uC608\uC57D \uAC00\uB2A5 \uC5EC\uBD80\uB97C \uC548\uB0B4\uB4DC\uB9AC\uACA0\uC2B5\uB2C8\uB2E4. ${profile.bookingAsk}`,
    coverup: `\uCEE4\uBC84\uC5C5 \uC0C1\uB2F4\uC744 \uB3C4\uC640\uB4DC\uB9AC\uACA0\uC2B5\uB2C8\uB2E4. ${profile.coverupAsk}`,
    retouch: `\uB9AC\uD130\uCE58 \uBB38\uC758 \uD655\uC778\uD588\uC2B5\uB2C8\uB2E4. ${profile.retouchAsk}`,
    aftercare: `\uC2DC\uC220 \uD6C4 \uAD00\uB9AC \uC548\uB0B4\uB4DC\uB9AC\uACA0\uC2B5\uB2C8\uB2E4. ${profile.aftercareAsk}`,
    general: `\uBB38\uC758\uD558\uC2E0 \uB0B4\uC6A9\uC744 \uD655\uC778\uD588\uC2B5\uB2C8\uB2E4. ${profile.signature}`,
  };
  const knowledgeLines = [
    matchedKnowledge.prices.length > 0 ? `\uCC38\uACE0 \uACAC\uC801: ${matchedKnowledge.prices.join(" / ")}` : "",
    matchedKnowledge.faq.length > 0 ? `\uCC38\uACE0 \uC548\uB0B4: ${matchedKnowledge.faq.join(" / ")}` : "",
  ].filter(Boolean);
  const closer =
    inquiry.priority === "\uAE34\uAE09"
      ? `\uAE09\uD55C \uBB38\uC758\uB85C \uBCF4\uC5EC \uC6B0\uC120 \uD655\uC778\uD558\uACA0\uC2B5\uB2C8\uB2E4. \uC608\uC0C1 \uB2F5\uBCC0 \uC2DC\uAC04\uC740 ${responseWindows[settings.responseWindow]}\uC785\uB2C8\uB2E4.`
      : `${tone.closer} \uC608\uC0C1 \uB2F5\uBCC0 \uC2DC\uAC04\uC740 ${responseWindows[settings.responseWindow]}\uC785\uB2C8\uB2E4.`;

  return `${name}, ${tone.opener}\n\n${bodies[inquiry.category]}${knowledgeLines.length ? `\n\n${knowledgeLines.join("\n")}` : ""}\n\n${closer}\n\n-${profile.label}`;
}

export function matchKnowledge(message: string, source: { prices: string; faq: string }) {
  const text = message.toLowerCase();
  const prices = parsePriceBook(source.prices)
    .filter((entry) => entry.keywords.some((keyword) => text.includes(keyword)))
    .map((entry) => `${entry.item} ${entry.price}${entry.note ? ` (${entry.note})` : ""}`)
    .slice(0, 2);
  const faq = parseFaq(source.faq)
    .filter((entry) => entry.keywords.some((keyword) => text.includes(keyword)))
    .map((entry) => entry.answer)
    .slice(0, 2);
  return { prices, faq };
}

export function parsePriceBook(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [item = "", price = "", note = ""] = line.split("|").map((part) => part.trim());
      return { item, price, note, keywords: normalizeKeywords([item, note]) };
    })
    .filter((entry) => entry.item && entry.price);
}

export function parseFaq(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [trigger = "", answer = ""] = line.split("|").map((part) => part.trim());
      return { trigger, answer, keywords: normalizeKeywords([trigger, answer]) };
    })
    .filter((entry) => entry.trigger && entry.answer);
}

export function normalizeKeywords(values: string[]) {
  return values
    .join(" ")
    .toLowerCase()
    .split(/[\s,./()]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2);
}

export function getCounts(inquiries: Inquiry[]) {
  const byStatus = (status: Status) => inquiries.filter((i) => i.status === status).length;
  return {
    new: byStatus("new"),
    info_requested: byStatus("info_requested"),
    quoted: byStatus("quoted"),
    deposit_pending: byStatus("deposit_pending"),
    booked: byStatus("booked"),
    completed: byStatus("completed"),
    aftercare: byStatus("aftercare"),
    closed: byStatus("closed"),
    open: inquiries.filter((i) => isOpenInquiryStatus(i.status)).length,
    quote: inquiries.filter((i) => i.category === "quote").length,
    booking: inquiries.filter((i) => i.category === "booking").length,
    urgent: inquiries.filter((i) => i.priority === "\uAE34\uAE09").length,
  };
}

export function getSummary(inquiries: Inquiry[], settings: Settings) {
  if (inquiries.length === 0) return "\uBB38\uC758 \uB370\uC774\uD130\uB97C \uB123\uC73C\uBA74 \uC694\uC57D\uC774 \uD45C\uC2DC\uB429\uB2C8\uB2E4.";
  const topCategory = Object.entries(categoryLabels)
    .map(([key, label]) => ({ label, count: inquiries.filter((i) => i.category === key).length }))
    .sort((a, b) => b.count - a.count)[0];
  const openCount = inquiries.filter((i) => isOpenInquiryStatus(i.status)).length;
  const bookedCount = inquiries.filter((i) => i.status === "booked").length;
  const urgentCount = inquiries.filter((i) => i.priority === "\uAE34\uAE09").length;
  const repeatCount = getCustomerGroups(inquiries).filter((group) => group.items.length >= 2).length;
  return [
    `\uC751\uB300 \uD544\uC694 \uBB38\uC758 ${openCount}\uAC74`,
    `\uC608\uC57D \uD655\uC815 ${bookedCount}\uAC74`,
    `\uAC00\uC7A5 \uB9CE\uC740 \uC720\uD615: ${topCategory.label} ${topCategory.count}\uAC74`,
    `\uAE34\uAE09 \uBB38\uC758 ${urgentCount}\uAC74`,
    `\uC7AC\uBB38\uC758 \uACE0\uAC1D ${repeatCount}\uBA85`,
    `\uD604\uC7AC \uD15C\uD50C\uB9BF: ${businessProfiles[settings.businessProfile].label}`,
  ].join("\n");
}

export function getCustomerGroups(inquiries: Inquiry[]) {
  const groups = new Map<string, { key: string; label: string; items: Inquiry[] }>();
  inquiries.forEach((inquiry) => {
    const key = getCustomerKey(inquiry);
    if (!groups.has(key)) groups.set(key, { key, label: getCustomerLabel(inquiry), items: [] });
    groups.get(key)!.items.push(inquiry);
  });
  return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label, "ko"));
}

export function getCustomerHistory(selected: Inquiry, inquiries: Inquiry[]) {
  const key = getCustomerKey(selected);
  return inquiries
    .filter((i) => i.id !== selected.id && getCustomerKey(i) === key)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);
}

export function getCustomerInquiries(customer: { id: string; normalizedKey?: string | null }, inquiries: Inquiry[]) {
  return inquiries
    .filter((i) => i.customerId === customer.id || getCustomerKey(i) === customer.normalizedKey)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function appendTimeline(inquiry: Inquiry, actor: string, label: string): InquiryTimelineItem[] {
  return [
    { id: crypto.randomUUID(), at: new Date().toISOString(), actor, label },
    ...(inquiry.timeline ?? []),
  ].slice(0, 20);
}

export function analyzeAiQuality(aiDraft: string, finalReply: string, message: string): AiQualityReport {
  const forbiddenHits = forbiddenReplyWords.filter((word) => finalReply.includes(word));
  const missingSignals = [
    { label: "\uACE0\uAC1D \uBB38\uC758 \uB0B4\uC6A9 \uC5B8\uAE09", ok: hasSharedKeyword(message, finalReply) },
    { label: "\uCD94\uAC00 \uD655\uC778 \uC548\uB0B4", ok: /\uD655\uC778|\uC54C\uB824|\uB9D0\uC500|\uC548\uB0B4/.test(finalReply) },
    { label: "\uC751\uB300 \uB9C8\uBB34\uB9AC", ok: /\uAC10\uC0AC|\uB4DC\uB9AC\uACA0\uC2B5\uB2C8\uB2E4|\uC548\uB0B4/.test(finalReply) },
  ]
    .filter((item) => !item.ok)
    .map((item) => item.label);
  const changedChars = getChangedCharacterCount(aiDraft, finalReply);
  const changedRatio = aiDraft.length === 0 ? 0 : Math.min(1, changedChars / Math.max(aiDraft.length, finalReply.length, 1));
  const score = Math.max(0, Math.round(100 - forbiddenHits.length * 20 - missingSignals.length * 10 - changedRatio * 20));

  return { score, changedChars, changedRatio, forbiddenHits, missingSignals, checkedAt: new Date().toISOString() };
}

export function normalizeAiQuality(
  value: AiQualityReport | null | undefined,
  aiDraft: string,
  finalReply: string,
  message: string,
) {
  if (value && typeof value.score === "number" && Array.isArray(value.forbiddenHits) && Array.isArray(value.missingSignals)) {
    return value;
  }
  return analyzeAiQuality(aiDraft, finalReply, message);
}

export function summarizeReplyRevision(aiDraft: string, finalReply: string) {
  const changedChars = getChangedCharacterCount(aiDraft, finalReply);
  if (changedChars === 0) return "AI \uCD08\uC548\uACFC \uB3D9\uC77C\uD558\uAC8C \uC800\uC7A5";
  if (changedChars < 30) return "\uD45C\uD604 \uC77C\uBD80 \uC218\uC815";
  if (changedChars < 100) return "\uBB38\uC7A5 \uAD6C\uC870\uC640 \uC548\uB0B4 \uB0B4\uC6A9 \uC218\uC815";
  return "\uB2F5\uBCC0\uC744 \uD06C\uAC8C \uC7AC\uC791\uC131";
}

export function getChangedCharacterCount(a: string, b: string) {
  const maxLength = Math.max(a.length, b.length);
  let changed = Math.abs(a.length - b.length);
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    if (a[index] !== b[index]) changed += 1;
  }
  return Math.min(maxLength, changed);
}

export function getInquiryTimeline(inquiry: Inquiry): InquiryTimelineItem[] {
  const existing = inquiry.timeline ?? [];
  if (existing.length > 0) return existing;
  return [{ id: `${inquiry.id}-created`, at: inquiry.createdAt, actor: "InkDesk", label: "\uBB38\uC758 \uC811\uC218" }];
}

export function getCustomerKey(inquiry: Inquiry) {
  const customer = normalizeCustomerValue(inquiry.customer);
  if (customer && customer !== normalizeCustomerValue("\uC774\uB984 \uBBF8\uC0C1")) return `customer:${customer}`;
  return `channel:${normalizeCustomerValue(inquiry.channel || "unknown")}`;
}

export function getCustomerLabel(inquiry: Inquiry) {
  if (inquiry.customer.trim() && inquiry.customer !== "\uC774\uB984 \uBBF8\uC0C1") return inquiry.customer;
  return `${inquiry.channel || "\uCC44\uB110 \uBBF8\uC0C1"} \uACE0\uAC1D`;
}

function hasSharedKeyword(message: string, reply: string) {
  const words = message
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2);
  return words.some((word) => reply.includes(word));
}
