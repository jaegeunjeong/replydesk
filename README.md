# InkDesk

**타투이스트를 위한 상담 CRM.** 인스타 DM, 카카오톡, 전화로 흩어지는 타투 상담 문의를 한 곳에 모아, 견적에 필요한 정보를 빠르게 확인하고, AI 답변 초안과 함께 예약 확정까지의 흐름을 관리합니다.

## 누구를 위한 제품인가

- 1인 타투이스트
- 소규모(2~10인) 타투 스튜디오

## 핵심 흐름

```text
문의 접수 → 상담 정보 확인 → 견적 안내 → 예약금 대기 → 예약 확정 → 시술/리터치 관리
```

문의 상태가 위 파이프라인을 그대로 따라가며, 문의 상태가 진행되면 고객 카드 상태(신규 문의 → 상담 완료 → 예약 확정 → 시술 완료)도 자동으로 따라 움직입니다.

## 구현된 기능

- **상담 접수**: 세 가지 입력 방식 — 빠른 붙여넣기(고객명·채널 + DM/카톡 원문 그대로, 여러 줄도 하나의 상담 카드로), 구조화된 상담 접수 폼(시술 부위·크기·스타일·커버업·희망 시술일), 한 줄에 하나씩 일괄 붙여넣기. 자동 분류(견적/예약/커버업/리터치/관리)와 우선순위 판단
- **상담 정보 체크리스트**: 견적에 필요한 정보(부위·크기·스타일·희망일·참고 이미지) 중 확인된 것과 부족한 것을 표시하고, 부족한 정보를 묻는 추천 질문을 자동 생성해 답변에 한 번에 추가
- **참고 이미지 첨부·갤러리**: 레퍼런스/도안/기존 타투 사진을 상담 카드에 직접 업로드(문의당 최대 8장, 업로드 시 브라우저에서 자동 리사이즈, 썸네일 갤러리·원본 보기·삭제). 수신 여부와 메모·링크도 함께 기록하며, 견적/예약/커버업/리터치 유형은 체크리스트에서 필수 항목으로 추적. 이미지는 별도 스토리지 없이 PostgreSQL에 저장(스토리지 계층을 캡슐화해 이후 오브젝트 스토리지로 교체 가능)
- **예약금·예약 확정**: 예약금 금액·입금자·예약 일시·노쇼/환불 정책 동의를 기록하고, 입금 확인 버튼으로 입금 시각을 남기며 예약 대기 → 예약 확정으로 전환
- **AI 답변 초안**: OpenAI 기반 초안 생성(예약금 안내/애프터케어 안내 포함 옵션), 문의 유형에 맞는 지식베이스 섹션만 컨텍스트로 사용, 참고한 소스·비어 있는 소스를 함께 표시해 지식베이스를 채울 이유를 보여줌, 금지 표현·품질 점검
- **예약 전환 파이프라인**: 신규 문의 → 정보 요청 → 견적 안내 → 예약금 대기 → 예약 확정 → 시술 완료 → 리터치/관리 → 상담 종료
- **고객 관리**: 고객 상세 상단 시술 요약(예약 확정·시술 완료·리터치/관리 건수, 최근 작업 부위·선호 스타일·최근 견적가), 부위/크기/스타일/견적가가 함께 보이는 상담 이력, 고객 상태, 태그·메모, 피부 특이사항(켈로이드·알레르기 등)
- **지식베이스**: 견적 기준 + 7개 정책 섹션(예약금/취소, 작업 조건, 커버업, 시술 전 주의, 관리법, 리터치, 기타)
- **팀 권한**: 대표/팀원 2단계 권한, 워크스페이스 분리
- **일일 리포트**: 예약 전환 퍼널(접수→견적 안내→예약금→예약 확정 누적 전환율), 정보 부족 문의 비율, 상태별/유형별 분포, 재문의 고객
- CSV 가져오기/내보내기

## 아직 없는 기능 (로드맵)

- 참고 이미지 **오브젝트 스토리지 이전**(현재는 PostgreSQL 저장, 대용량·고트래픽 시 R2/S3로 이전)
- 인스타 DM·카카오톡 채널 실연동 (현재는 수동 입력/붙여넣기)
- 예약 캘린더 뷰와 예약금 입금 자동 대사(현재는 수동 입금 확인)
- 초대 메일 발송, 비밀번호 재설정, 만료 세션 정리(cron)
- 워크스페이스별 과금과 AI 사용량 대시보드

## 다음 작업 (이어서 진행할 것)

작업을 일시 중단한 지점 기록. 재개 시 여기서부터.

### 모바일 반응형 (진행 중)

같은 코드베이스에서 반응형으로 확장하는 방식. `≥768px`는 기존 데스크톱 2-pane 그대로, `<768px`는 모바일 셸. 새 라우트/페이지 없이 기존 `selectedId`·`activeView` 상태와 `InquiryList`·`DetailPanel` 컴포넌트를 재사용.

- **완료 (P1)** — 모바일 하단 탭 바(`activeView` 연동), 상담함 목록↔상세 화면 전환(`selectedId` 기반, 뒤로가기 포함). `<768px` 반응형 폰 셸.
- **완료 (P2)** — 상세 화면을 `답변·정보·이력` 세그먼트 탭으로 분리 + 다음 행동 CTA.
- **남음 (P3)** — 새 문의 접수를 FAB + 바텀시트로 전환, 터치 타깃(최소 44px)·폰트 크기 정리, 실기기(iOS Safari/Android Chrome) 검증.

### 서비스 오픈 전 보완 (별도 메모 참고)

공개 유료 서비스 전환 전 검증이 필요한 항목(AI 실제 생성 검증, 계정·운영 보안, 이미지 오브젝트 스토리지 이전, 개인정보·민감 이미지 정책, 결제·과금·사용량, 실사용 UX). 상세는 리포지토리 로컬 메모(`codex_claude_modify.md`, 미추적) 참고. 현 단계 판정: 내부 시연·비공개 베타는 가능, 공개 유료 서비스는 이르다.

## 기술 스택

- **프레임워크**: Next.js 15 (App Router) + React 19
- **언어**: TypeScript (strict)
- **데이터베이스**: PostgreSQL (`pg`)
- **AI**: OpenAI Responses API (답변 초안 생성)

## 빠른 시작

### 1. 요구사항

- Node.js 18+
- 로컬 PostgreSQL (기본 포트 5432)

### 2. 의존성 설치

```powershell
npm install
```

### 3. 환경 변수 설정

`.env.example`를 복사해 `.env.local`을 만들고 값을 채웁니다.

```powershell
DATABASE_URL="postgresql://replydesk_app:admin1234@127.0.0.1:5432/replydesk_lite"
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.5
```

`OPENAI_API_KEY`가 없으면 **AI 답변 생성만 비활성**으로 동작하고, 나머지 기능과 E2E 검증은 그대로 사용할 수 있습니다.

### 4. DB 스키마 적용

```powershell
npm run db:schema
```

스키마는 반복 실행해도 안전하며(idempotent), 구버전 상태값(drafted/pending/escalated/done)을 새 파이프라인 상태로 자동 마이그레이션합니다.

### 5. 개발 서버 실행

```powershell
npm run dev -- --hostname 127.0.0.1 --port 4183
```

브라우저에서 `http://127.0.0.1:4183/`을 엽니다.

## 데모 계정

비밀번호는 `admin1234`입니다.

| 계정 | 역할 |
|------|------|
| `owner@example.local` | 대표 (모든 권한) |
| `member@example.local` | 팀원 (상담 처리·고객 관리·지식베이스 수정) |

## API 엔드포인트

모든 데이터 API는 세션 쿠키로 해석된 워크스페이스 컨텍스트 기준으로 동작합니다.

| 영역 | 메서드 · 경로 |
|------|------|
| 인증 | `POST /api/auth/login` · `POST /api/auth/register` · `POST /api/auth/logout` |
| 세션 | `GET /api/session` · `POST /api/session/select` |
| 문의 | `GET·POST·DELETE /api/inquiries` · `PATCH·DELETE /api/inquiries/[id]` |
| 참고 이미지 | `GET·POST /api/inquiries/[id]/images` · `GET·DELETE /api/inquiries/[id]/images/[imageId]` |
| 고객 | `GET /api/customers` · `PATCH /api/customers/[id]` |
| 지식베이스 | `GET·PUT /api/knowledge` |
| 설정 | `GET·PUT /api/settings` |
| 멤버 | `GET·POST /api/members` · `PATCH·DELETE /api/members/[userId]` |
| 리포트 | `GET /api/report/daily` |
| AI | `POST /api/generate-reply` |
| 상태 | `GET /api/db/health` |

## 프로젝트 구조

```text
app/
  layout.tsx           루트 레이아웃 / 메타데이터
  page.tsx             클라이언트 앱 조립 지점 (상태·뷰 오케스트레이션)
  globals.css          전역 스타일
  api/                 Next.js Route Handlers (위 'API 엔드포인트' 참고)
components/            화면 단위 UI 컴포넌트
                       (AuthScreen, InquiryList, DetailPanel, CustomerPanel,
                        KnowledgePanel, SettingsPanel, MemberPanel, SetupWizard,
                        DailyReport, ConfirmDialog, shared)
lib/
  auth.ts              비밀번호 해시/검증
  constants.ts         상태·카테고리·지식베이스 섹션 등 앱 상수
  db.ts                PostgreSQL 연결과 워크스페이스 컨텍스트
  inquiry.ts           문의 분석/체크리스트/지식 섹션/고객 상태 연동 헬퍼
  inquiryImages.ts     참고 이미지 저장 계층(현재 Postgres bytea, 교체 가능)
  clientImage.ts       업로드 전 브라우저 이미지 리사이즈
  permissions.ts       대표/팀원 권한 정책
  utils.ts             CSV 가져오기/내보내기 유틸
db/
  schema.sql           PostgreSQL 스키마 + 상태 마이그레이션 + 데모 데이터
scripts/
  apply-schema.mjs     DB 스키마 적용 (npm run db:schema)
  e2e-smoke.mjs        API 기반 smoke test (npm run test:e2e)
types/
  index.ts             공용 타입
```

## 검증

```powershell
npm run typecheck   # 타입 검사 (tsc --noEmit)
npm run build       # 프로덕션 빌드
npm run test:e2e    # API 기반 E2E smoke test (34 checks)
```

> ⚠️ `next dev`가 실행 중일 때 `npm run build`를 같은 `.next`에 돌리면 캐시가 깨질 수 있습니다. 빌드는 dev 서버를 끈 상태에서 실행하세요.

E2E는 기본적으로 `http://127.0.0.1:4183`을 대상으로 합니다. 다른 주소를 쓰려면 `TEST_BASE_URL`을 지정합니다.

```powershell
$env:TEST_BASE_URL="http://127.0.0.1:3000"
npm run test:e2e
```

## 보안

### 해결됨

- **세션 토큰화** — 세션은 서명 없는 사용자 ID 쿠키가 아니라 서버에 저장된 랜덤 토큰(`sessions` 테이블)으로 관리됩니다. 위조 불가능하며 로그아웃 시 서버에서 즉시 무효화됩니다. 구 `x-replydesk-user-id` / `x-replydesk-workspace-id` 헤더 폴백은 제거됐습니다.
- **`/api/generate-reply` 인증 게이팅** — 다른 데이터 라우트와 동일하게 `getWorkspaceContext`로 세션/워크스페이스를 검증합니다. 비인증 호출은 401.
- **AI 사용량 로깅·비용 상한** — 모든 호출을 `ai_usage_log`에 기록하고, 워크스페이스별 하루 한도(`AI_DAILY_LIMIT`, 기본 200)를 초과하면 429를 반환합니다.
- **백도어 제거** — 비밀번호 미설정 계정을 `admin1234`로 통과시키던 로직을 삭제했습니다. 로그인은 저장된 해시 검증만 통과합니다. 멤버 초대 시에는 임시 비밀번호가 1회 발급되어 초대자에게 전달됩니다.

> ⚠️ 데모 계정(`owner@example.local` / `member@example.local`)의 비밀번호 `admin1234`는 문서화된 데모 자격 증명입니다. **운영 배포 시 반드시 변경**하세요.

### 남은 과제 (로드맵)

- 초대 메일 발송과 비밀번호 재설정 흐름 (현재 임시 비밀번호는 화면에 표시되어 초대자가 수동 전달)
- 만료된 세션 주기적 정리(cron), 세션 목록/강제 로그아웃 UI
- 워크스페이스별 AI 사용량 대시보드와 요금제 연동
