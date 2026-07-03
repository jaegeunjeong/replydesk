// 타투 예약 전환 파이프라인 흐름을 보여주는 데모 데이터 시드.
// 재실행해도 안전합니다 (id가 demo-seed-* 인 문의만 갱신하고, 다른 데이터는 건드리지 않음).
// 실행: npm run db:seed
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import pg from "pg";

const WORKSPACE_ID = "default-workspace";

const envText = await readFile(resolve(".env.local"), "utf8");
const databaseUrl = readEnvValue(envText, "DATABASE_URL");
if (!databaseUrl) throw new Error("DATABASE_URL is missing in .env.local");

// 파이프라인 순서대로 한 명씩: 신규 → 정보 요청 → 견적 안내 → 예약금 대기 → 예약 확정 → 시술 완료 → 리터치/관리 → 상담 종료
const seeds = [
  {
    id: "demo-seed-1",
    customer: "김서연",
    channel: "인스타 DM",
    message: "손목 안쪽에 레터링 타투 견적 문의드려요. 문구는 'amor fati'로 생각 중이에요.",
    category: "quote",
    priority: "보통",
    keywords: ["견적", "크기"],
    status: "new",
    customerStatus: "new",
    tattoo: { area: "손목 안쪽", size: null, style: "lettering", coverup: false, sessions: null, price: null, preferredDate: null },
    reply: "김서연님, 문의 주셔서 감사합니다.\n\n문의하신 내용 기준으로 견적을 안내드리겠습니다. 시술 부위, 크기(cm), 스타일, 커버업 여부, 레퍼런스 이미지를 함께 알려주세요.\n\n확인 후 편하게 결정하실 수 있도록 안내드리겠습니다.",
    agoDays: 0,
    timeline: [["문의 접수 및 초안 생성", "InkDesk", 0]],
  },
  {
    id: "demo-seed-2",
    customer: "박준호",
    channel: "카카오톡",
    message: "팔 안쪽에 있는 옛날 타투 커버업 가능한가요? 10년 전에 한 거라 색이 많이 빠졌어요.",
    category: "coverup",
    priority: "보통",
    keywords: ["커버업", "기존 타투"],
    status: "info_requested",
    customerStatus: "new",
    skinNotes: "켈로이드 체질(본인 진술) — 시술 전 패치 확인 필요",
    tattoo: { area: "팔 안쪽", size: null, style: null, coverup: true, sessions: null, price: null, preferredDate: null },
    reply: "박준호님, 문의 주셔서 감사합니다.\n\n커버업 상담을 도와드리겠습니다. 기존 타투의 사진, 크기, 색상, 원하시는 커버 방향을 알려주세요. 상태 확인 후 견적을 안내드리겠습니다.",
    agoDays: 0,
    timeline: [
      ["상태 변경: 정보 요청 (기존 타투 사진 요청)", "원장님", 0],
      ["문의 접수 및 초안 생성", "InkDesk", 0],
    ],
  },
  {
    id: "demo-seed-3",
    customer: "이하나",
    channel: "인스타 DM",
    message: "등에 수채화 스타일로 꽃 타투 하고 싶어요. 15cm 정도 생각하고 있는데 견적 알려주세요.",
    category: "quote",
    priority: "보통",
    keywords: ["견적", "크기"],
    status: "quoted",
    customerStatus: "consulted",
    tattoo: { area: "등", size: "15cm", style: "watercolor", coverup: false, sessions: 1, price: "450,000원", preferredDate: "7월 중순" },
    reply: "이하나님, 문의 주셔서 감사합니다.\n\n등 부위 수채화 꽃 타투 15cm 기준으로 450,000원부터 안내드립니다. 디자인 복잡도에 따라 변동될 수 있어요.\n\n희망하시는 날짜를 알려주시면 예약금 안내와 함께 일정을 잡아드리겠습니다.",
    agoDays: 0,
    timeline: [
      ["상태 변경: 견적 안내", "원장님", 0],
      ["시술 정보 수정", "원장님", 0],
      ["문의 접수 및 초안 생성", "InkDesk", 0],
    ],
  },
  {
    id: "demo-seed-4",
    customer: "최도윤",
    channel: "전화",
    message: "다음주 토요일에 블랙워크 반팔 예약 가능한가요? 도안은 대략 정해뒀습니다.",
    category: "booking",
    priority: "긴급",
    keywords: ["예약", "다음주", "토요일"],
    status: "deposit_pending",
    customerStatus: "consulted",
    tattoo: { area: "팔 전체(반팔)", size: "반팔", style: "blackwork", coverup: false, sessions: 2, price: "800,000원 (2세션)", preferredDate: "7/11 토요일 오후" },
    reply: "최도윤님, 문의 주셔서 감사합니다.\n\n블랙워크 반팔은 2~3세션 기준 800,000원부터입니다. 7/11 토요일 오후 시간 비어 있습니다.\n\n견적의 30%인 240,000원을 예약금으로 입금해 주시면 예약이 확정됩니다. 계좌 안내드릴게요.",
    agoDays: 0,
    timeline: [
      ["상태 변경: 예약금 대기 (240,000원 안내)", "원장님", 0],
      ["상태 변경: 견적 안내", "원장님", 0],
      ["문의 접수 및 초안 생성", "InkDesk", 0],
    ],
  },
  {
    id: "demo-seed-5",
    customer: "정하린",
    channel: "상담 신청 폼",
    message: "갈비뼈 쪽에 라인워크로 작은 달 모양 타투 하고 싶어요. 7cm 정도요.",
    category: "quote",
    priority: "보통",
    keywords: ["견적", "크기"],
    status: "booked",
    customerStatus: "booked",
    tattoo: { area: "갈비뼈", size: "7cm", style: "linework", coverup: false, sessions: 1, price: "250,000원", preferredDate: "7/8 오후 2시" },
    reply: "정하린님, 예약이 확정되었습니다.\n\n7/8(수) 오후 2시, 갈비뼈 라인워크 7cm 기준 250,000원입니다. 예약금 75,000원 입금 확인했습니다.\n\n시술 24시간 전 음주를 삼가고, 충분한 수면과 수분 섭취를 부탁드려요. 갈비뼈 부위는 통증이 있는 편이니 컨디션 관리해 주세요.",
    agoDays: 1,
    timeline: [
      ["상태 변경: 예약 확정 (예약금 입금 확인)", "원장님", 1],
      ["상태 변경: 예약금 대기", "원장님", 1],
      ["상태 변경: 견적 안내", "원장님", 1],
      ["문의 접수 및 초안 생성", "InkDesk", 1],
    ],
  },
  {
    id: "demo-seed-6",
    customer: "한지우",
    channel: "카카오톡",
    message: "발목에 컬러로 나비 타투 하고 싶어요. 6cm 정도로 생각하고 있어요.",
    category: "quote",
    priority: "보통",
    keywords: ["견적", "크기"],
    status: "completed",
    customerStatus: "completed",
    skinNotes: "민감성 피부 — 시술 후 진정 크림 권장",
    tattoo: { area: "발목", size: "6cm", style: "color", coverup: false, sessions: 1, price: "300,000원", preferredDate: "6/29 오후" },
    reply: "한지우님, 오늘 시술 고생 많으셨습니다.\n\n2주간 보습제를 얇게 발라주시고, 직사광선과 공중목욕(수영장·사우나)은 피해주세요. 가려움이 있어도 긁지 말고 두드려 주세요.\n\n궁금한 점 있으면 언제든 연락 주세요.",
    agoDays: 5,
    timeline: [
      ["상태 변경: 시술 완료", "원장님", 5],
      ["상태 변경: 예약 확정", "원장님", 6],
      ["문의 접수 및 초안 생성", "InkDesk", 7],
    ],
  },
  {
    id: "demo-seed-7",
    customer: "한지우",
    channel: "카카오톡",
    message: "지난주에 받은 나비 타투요, 샤워는 언제부터 가능한가요? 살짝 가려운데 정상인가요?",
    category: "aftercare",
    priority: "보통",
    keywords: ["관리", "샤워"],
    status: "aftercare",
    customerStatus: "completed",
    tattoo: { area: "발목", size: "6cm", style: "color", coverup: false, sessions: null, price: null, preferredDate: null },
    reply: "한지우님, 문의 확인했습니다.\n\n가벼운 샤워는 시술 다음날부터 가능하지만, 시술 부위를 문지르지 말고 물기는 두드려 말려주세요. 회복 과정에서 가려움은 자연스러운 증상이니 긁지 말고 보습제를 발라주세요.\n\n진물이 계속되거나 붓기가 심해지면 사진과 함께 연락 주세요.",
    agoDays: 2,
    timeline: [
      ["상태 변경: 리터치/관리", "원장님", 2],
      ["문의 접수 및 초안 생성", "InkDesk", 2],
    ],
  },
  {
    id: "demo-seed-8",
    customer: "강민재",
    channel: "문자",
    message: "작년에 다른 샵에서 한 타투 색이 빠졌는데 리터치 비용이 어떻게 되나요?",
    category: "retouch",
    priority: "보통",
    keywords: ["리터치", "색 빠짐"],
    status: "closed",
    customerStatus: "consulted",
    tattoo: { area: "어깨", size: "10cm", style: null, coverup: false, sessions: null, price: "80,000원~", preferredDate: null },
    reply: "강민재님, 문의 주셔서 감사합니다.\n\n타샵 작업 리터치는 상태 확인 후 80,000원부터 안내드리고 있습니다. 사진을 보내주시면 정확한 견적을 드릴게요.",
    agoDays: 6,
    timeline: [
      ["상태 변경: 상담 종료 (고객 보류)", "원장님", 4],
      ["상태 변경: 견적 안내", "원장님", 6],
      ["문의 접수 및 초안 생성", "InkDesk", 6],
    ],
  },
];

const client = new pg.Client({ connectionString: databaseUrl, ssl: false });
await client.connect();

try {
  await client.query("begin");

  for (const seed of seeds) {
    const customerKey = getCustomerKey(seed.customer, seed.channel);
    const customerId = getCustomerId(WORKSPACE_ID, customerKey);

    await client.query(
      `
      insert into customers (id, workspace_id, normalized_key, name, channel, status, skin_notes, created_at, updated_at)
      values ($1, $2, $3, $4, $5, $6, $7, now() - make_interval(days => $8), now())
      on conflict (workspace_id, normalized_key) do update set
        name = excluded.name,
        channel = excluded.channel,
        status = excluded.status,
        skin_notes = coalesce(excluded.skin_notes, customers.skin_notes),
        updated_at = now()
      `,
      [customerId, WORKSPACE_ID, customerKey, seed.customer, seed.channel, seed.customerStatus, seed.skinNotes ?? null, seed.agoDays],
    );

    const timeline = seed.timeline.map(([label, actor, days], index) => ({
      id: `${seed.id}-tl-${index}`,
      at: isoDaysAgo(days, index),
      actor,
      label,
    }));

    await client.query(
      `
      insert into inquiries (
        id, workspace_id, customer_id, customer_name, channel, message, category, priority, keywords,
        reply, status, profile, tone, response_window, timeline,
        tattoo_area, tattoo_size, tattoo_style, is_coverup, session_count, quoted_price, preferred_date,
        created_at, updated_at
      )
      values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, 'tattoo', 'warm', 'same-day', $12::jsonb,
        $13, $14, $15, $16, $17, $18, $19,
        now() - make_interval(days => $20), now()
      )
      on conflict (id) do update set
        customer_id = excluded.customer_id,
        message = excluded.message,
        category = excluded.category,
        priority = excluded.priority,
        keywords = excluded.keywords,
        reply = excluded.reply,
        status = excluded.status,
        timeline = excluded.timeline,
        tattoo_area = excluded.tattoo_area,
        tattoo_size = excluded.tattoo_size,
        tattoo_style = excluded.tattoo_style,
        is_coverup = excluded.is_coverup,
        session_count = excluded.session_count,
        quoted_price = excluded.quoted_price,
        preferred_date = excluded.preferred_date,
        created_at = excluded.created_at,
        updated_at = now()
      `,
      [
        seed.id,
        WORKSPACE_ID,
        customerId,
        seed.customer,
        seed.channel,
        seed.message,
        seed.category,
        seed.priority,
        seed.keywords,
        seed.reply,
        seed.status,
        JSON.stringify(timeline),
        seed.tattoo.area,
        seed.tattoo.size,
        seed.tattoo.style,
        seed.tattoo.coverup,
        seed.tattoo.sessions,
        seed.tattoo.price,
        seed.tattoo.preferredDate,
        seed.agoDays,
      ],
    );
  }

  await client.query("commit");
  console.log(`Seeded ${seeds.length} demo inquiries into ${WORKSPACE_ID} (ids: demo-seed-1..${seeds.length}).`);

  const summary = await client.query(
    "select status, count(*)::int as cnt from inquiries where workspace_id = $1 and id like 'demo-seed-%' group by status order by min(id)",
    [WORKSPACE_ID],
  );
  for (const row of summary.rows) console.log(`  ${row.status}: ${row.cnt}`);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}

function isoDaysAgo(days, hoursBack = 0) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000 - hoursBack * 60 * 60 * 1000).toISOString();
}

function readEnvValue(text, key) {
  const line = text
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${key}=`));
  if (!line) return "";
  return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
}

function getCustomerKey(customer, channel) {
  const normalizedCustomer = normalizeCustomerValue(customer);
  if (normalizedCustomer && normalizedCustomer !== normalizeCustomerValue("이름 미상")) {
    return `customer:${normalizedCustomer}`;
  }
  return `channel:${normalizeCustomerValue(channel || "unknown")}`;
}

function getCustomerId(workspaceId, customerKey) {
  const hash = createHash("sha256").update(`${workspaceId}:${customerKey}`).digest("hex").slice(0, 24);
  return `cust_${hash}`;
}

function normalizeCustomerValue(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}
