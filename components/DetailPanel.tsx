"use client";

import { useEffect, useState } from "react";
import type { Inquiry, WorkspaceMember, Status, TattooStyle, InquiryImage } from "@/types";
import { categoryLabels, statusLabels, toneProfiles, tattooStyleLabels, MAX_REFERENCE_IMAGES } from "@/lib/constants";
import { getCustomerHistory, getInquiryTimeline, normalizeAiQuality, getConsultChecklist, getKnowledgeSourceUsage } from "@/lib/inquiry";
import { formatDateTime } from "@/lib/utils";
import { Meta, PermissionNotice } from "@/components/shared";

export function DetailPanel({
  selected,
  inquiries,
  members,
  onCopy,
  onSaveReply,
  onUpdateOperations,
  onGenerateAi,
  aiStatus,
  knowledgeReadiness,
  knowledgeSource,
  images,
  imageStatus,
  onUploadImages,
  onDeleteImage,
  onDelete,
  canUpdate,
  canDelete,
  updateLock,
  deleteLock,
}: {
  selected: Inquiry | null;
  inquiries: Inquiry[];
  members: WorkspaceMember[];
  onCopy: () => void;
  onSaveReply: (id: string, reply: string) => void;
  onUpdateOperations: (
    id: string,
    patch: Partial<Pick<Inquiry, "status" | "priority" | "assigneeId" | "internalNote" | "tattooArea" | "tattooSize" | "tattooStyle" | "isCoverup" | "sessionCount" | "quotedPrice" | "preferredDate" | "hasReferenceImage" | "referenceImageNote" | "depositAmount" | "depositPayerName" | "depositPaidAt" | "appointmentAt" | "policyConfirmed">>,
    label: string,
  ) => void;
  onGenerateAi: (options: { includeDeposit: boolean; includeAftercare: boolean }) => void;
  aiStatus: string;
  knowledgeReadiness: { deposit: boolean; aftercare: boolean };
  knowledgeSource: { prices: string; faq: string };
  images: InquiryImage[];
  imageStatus: string;
  onUploadImages: (files: File[]) => void;
  onDeleteImage: (imageId: string) => void;
  onDelete: (id: string) => void;
  canUpdate: boolean;
  canDelete: boolean;
  updateLock: { title: string; body: string };
  deleteLock: { title: string; body: string };
}) {
  const [replyDraft, setReplyDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [aiOptions, setAiOptions] = useState({ includeDeposit: false, includeAftercare: false });
  const [tattooDraft, setTattooDraft] = useState({
    tattooArea: "",
    tattooSize: "",
    tattooStyle: "" as string,
    quotedPrice: "",
    sessionCount: null as number | null,
    isCoverup: false,
    preferredDate: "",
    hasReferenceImage: false,
    referenceImageNote: "",
  });
  const [depositDraft, setDepositDraft] = useState({
    depositAmount: "",
    depositPayerName: "",
    appointmentAt: "",
    policyConfirmed: false,
  });

  useEffect(() => {
    setReplyDraft(selected?.reply ?? "");
    setNoteDraft(selected?.internalNote ?? "");
    setTattooDraft({
      tattooArea: selected?.tattooArea ?? "",
      tattooSize: selected?.tattooSize ?? "",
      tattooStyle: selected?.tattooStyle ?? "",
      quotedPrice: selected?.quotedPrice ?? "",
      sessionCount: selected?.sessionCount ?? null,
      isCoverup: selected?.isCoverup ?? false,
      preferredDate: selected?.preferredDate ?? "",
      hasReferenceImage: selected?.hasReferenceImage ?? false,
      referenceImageNote: selected?.referenceImageNote ?? "",
    });
    setDepositDraft({
      depositAmount: selected?.depositAmount ?? "",
      depositPayerName: selected?.depositPayerName ?? "",
      appointmentAt: selected?.appointmentAt ?? "",
      policyConfirmed: selected?.policyConfirmed ?? false,
    });
  }, [selected?.id, selected?.reply, selected?.internalNote, selected?.tattooArea, selected?.tattooSize, selected?.tattooStyle, selected?.quotedPrice, selected?.sessionCount, selected?.isCoverup, selected?.preferredDate, selected?.hasReferenceImage, selected?.referenceImageNote, selected?.depositAmount, selected?.depositPayerName, selected?.appointmentAt, selected?.policyConfirmed]);

  if (!selected) {
    return (
      <div className="detail-panel reply-workspace">
        <div className="empty-workflow">
          <p className="eyebrow">Reply workflow</p>
          <h3>문의를 선택하세요</h3>
          <p>왼쪽 목록에서 문의를 선택하면 답변 초안, 분류 정보, 처리 이력이 여기에 표시됩니다.</p>
        </div>
      </div>
    );
  }

  const history = getCustomerHistory(selected, inquiries);
  const timeline = getInquiryTimeline(selected);
  const checklist = getConsultChecklist(selected);
  const assignee = members.find((m) => m.id === selected.assigneeId) ?? null;
  const aiQuality = normalizeAiQuality(selected.aiQuality, selected.aiDraft || selected.reply, replyDraft, selected.message);
  const aiDraft = selected.aiDraft || selected.reply;
  const replyChanged = replyDraft !== selected.reply;
  // AI 초안이 어떤 지식베이스 소스를 참고했는지/무엇이 비었는지 (생성 옵션에 따라 달라짐).
  const sourceUsage = getKnowledgeSourceUsage(selected.category, knowledgeSource, aiOptions);

  // 현재 상태와 부족 정보를 바탕으로 "지금 눌러야 할" 단일 주요 행동을 결정한다.
  const primaryAction = getPrimaryAction();
  function getPrimaryAction(): { label: string; hint: string; run: () => void } | null {
    if (!selected || !canUpdate) return null;
    const id = selected.id;
    const missingCount = checklist.missing.length;
    switch (selected.status) {
      case "new":
      case "info_requested":
        if (missingCount > 0 && checklist.nextQuestion) {
          return {
            label: "부족한 정보 요청하기",
            hint: `견적에 필요한 정보가 ${missingCount}개 부족합니다. 확인 질문을 답변 초안에 넣고 정보 요청 상태로 옮깁니다.`,
            run: () => {
              setReplyDraft((draft) => (draft.trim() ? `${draft}\n\n${checklist.nextQuestion}` : checklist.nextQuestion ?? ""));
              onUpdateOperations(id, { status: "info_requested" }, "정보 요청");
            },
          };
        }
        return {
          label: "견적 안내로 넘기기",
          hint: "필요한 정보가 모였습니다. 견적을 안내하고 상태를 견적 안내로 옮깁니다.",
          run: () => onUpdateOperations(id, { status: "quoted" }, "견적 안내"),
        };
      case "quoted":
        return {
          label: "예약금 안내하기",
          hint: "견적을 전달했다면 예약금을 안내하고 입금을 기다립니다.",
          run: () => onUpdateOperations(id, { status: "deposit_pending" }, "예약금 대기"),
        };
      case "deposit_pending":
        return {
          label: "입금 확인 → 예약 확정",
          hint: "예약금이 입금되면 입금 시각을 기록하고 예약을 확정합니다.",
          run: () =>
            onUpdateOperations(
              id,
              { depositPaidAt: selected.depositPaidAt ?? new Date().toISOString(), status: "booked" },
              "예약금 입금 확인",
            ),
        };
      case "booked":
        return {
          label: "시술 완료로 변경",
          hint: "예약이 확정된 상담입니다. 시술이 끝나면 완료로 바꿉니다.",
          run: () => onUpdateOperations(id, { status: "completed" }, "시술 완료"),
        };
      case "completed":
        return {
          label: "리터치/관리로 전환",
          hint: "시술이 끝났습니다. 리터치·관리 안내 단계로 옮깁니다.",
          run: () => onUpdateOperations(id, { status: "aftercare" }, "리터치/관리"),
        };
      case "aftercare":
        return {
          label: "상담 종료 처리",
          hint: "관리까지 마쳤다면 상담을 종료합니다.",
          run: () => onUpdateOperations(id, { status: "closed" }, "상담 종료"),
        };
      case "closed":
      default:
        return null;
    }
  }
  const nextStepFallbackHint = !canUpdate
    ? "보기 전용입니다. 처리 권한이 있어야 다음 단계를 진행할 수 있습니다."
    : "상담이 종료된 문의입니다.";

  return (
    <div className="detail-panel reply-workspace">
      {!canUpdate && <PermissionNotice title={updateLock.title} body={updateLock.body} />}
      <div className="reply-hero">
        <div>
          <p className="eyebrow">Selected inquiry</p>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <span className="avatar-md">{selected.customer.charAt(0)}</span>
            <h3>{selected.customer}</h3>
          </div>
          <p>{selected.message}</p>
        </div>
        <div className="reply-status-stack">
          <span className={`badge ${selected.priority === "긴급" ? "urgent" : ""}`}>{selected.priority}</span>
          <span className="badge category">{categoryLabels[selected.category]}</span>
          <span className="badge">{statusLabels[selected.status]}</span>
        </div>
      </div>

      <section className="consult-check-card">
        <div className="section-title-row">
          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
            <span style={{width:'6px',height:'6px',borderRadius:'999px',background:'#b87d14',flexShrink:0}}></span>
            <h4>상담 정보 체크</h4>
          </div>
          <span className={checklist.missing.length === 0 ? "check-complete" : "check-missing"}>
            {checklist.missing.length === 0 ? "견적에 필요한 정보 확인 완료" : `부족한 정보 ${checklist.missing.length}개`}
          </span>
        </div>
        <div className="consult-check-groups">
          <div>
            <strong>확인됨</strong>
            <div className="check-badge-row">
              {checklist.confirmed.length === 0 ? (
                <span className="check-empty">아직 확인된 시술 정보가 없습니다.</span>
              ) : (
                checklist.confirmed.map((item) => (
                  <span className="badge check-ok" key={item.label}>
                    {item.label}: {item.value}
                  </span>
                ))
              )}
            </div>
          </div>
          <div>
            <strong>부족함</strong>
            <div className="check-badge-row">
              {checklist.missing.length === 0 ? (
                <span className="check-empty">없음 — 견적과 예약금 안내를 보낼 수 있습니다.</span>
              ) : (
                checklist.missing.map((item) => (
                  <span className="badge check-gap" key={item}>
                    {item}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
        {checklist.nextQuestion && (
          <div className="next-question-row">
            <div>
              <strong>다음 질문</strong>
              <p>{checklist.nextQuestion}</p>
            </div>
            <button
              className="secondary"
              disabled={!canUpdate}
              title={!canUpdate ? "수정 권한 필요" : undefined}
              onClick={() => setReplyDraft((draft) => (draft.trim() ? `${draft}\n\n${checklist.nextQuestion}` : checklist.nextQuestion ?? ""))}
            >
              답변에 추가
            </button>
          </div>
        )}
      </section>

      <section className="reply-card">
        <div className="section-title-row">
          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
            <span style={{width:'6px',height:'6px',borderRadius:'999px',background:'#0d7369',flexShrink:0}}></span>
            <h4>추천 답변</h4>
            <small style={{fontSize:'11px',color:'#6b7572'}}>지식베이스 기반 자동 초안</small>
          </div>
          <span>{selected.aiModel ? selected.aiModel : "규칙 기반 초안"}</span>
        </div>
        <textarea
          className="reply-editor primary-reply-editor"
          value={replyDraft}
          readOnly={!canUpdate}
          onChange={(e) => setReplyDraft(e.target.value)}
        />
        <div className="ai-generate-row">
          <button className="secondary" disabled={!canUpdate} onClick={() => onGenerateAi(aiOptions)}>
            {selected.aiGeneratedAt ? "AI 초안 다시 생성" : "AI 초안 생성"}
          </button>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={aiOptions.includeDeposit}
              onChange={(e) => setAiOptions({ ...aiOptions, includeDeposit: e.target.checked })}
            />
            예약금 안내 포함
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={aiOptions.includeAftercare}
              onChange={(e) => setAiOptions({ ...aiOptions, includeAftercare: e.target.checked })}
            />
            애프터케어 안내 포함
          </label>
        </div>
        {aiOptions.includeDeposit && !knowledgeReadiness.deposit && (
          <p className="knowledge-gap-note">예약금/취소 정책이 지식베이스에 없어 안내가 일반적으로 작성됩니다. 견적/안내 화면에서 정책을 추가하면 답변 품질이 좋아집니다.</p>
        )}
        {aiOptions.includeAftercare && !knowledgeReadiness.aftercare && (
          <p className="knowledge-gap-note">애프터케어 안내가 지식베이스에 없어 일반적인 내용으로 작성됩니다. 견적/안내 화면에서 관리법을 추가하세요.</p>
        )}
        <div className="ai-source-usage">
          <div className="ai-source-group">
            <span className="ai-source-label">참고한 답변 소스</span>
            <div className="check-badge-row">
              {sourceUsage.used.length === 0 ? (
                <span className="check-empty">이 유형에 연결된 지식베이스 내용이 아직 없습니다.</span>
              ) : (
                sourceUsage.used.map((s) => (
                  <span className="badge check-ok" key={s.key}>{s.label}</span>
                ))
              )}
            </div>
          </div>
          {sourceUsage.missing.length > 0 && (
            <div className="ai-source-group">
              <span className="ai-source-label">비어 있는 소스</span>
              <div className="check-badge-row">
                {sourceUsage.missing.map((s) => (
                  <span className="badge check-gap" key={s.key}>{s.label}</span>
                ))}
              </div>
              <small className="ai-source-hint">지식베이스에서 이 항목을 채우면 AI 답변이 더 정확해집니다.</small>
            </div>
          )}
        </div>
        <p className="ai-status-note">{aiStatus}</p>
        <div className="reply-primary-actions">
          <button className="primary" onClick={onCopy}>
            답변 복사
          </button>
          <button
            className="secondary"
            onClick={() => onSaveReply(selected.id, replyDraft)}
            disabled={!canUpdate || !replyChanged}
            title={!canUpdate ? "수정 권한 필요" : undefined}
          >
            수정 저장
          </button>
        </div>
      </section>

      <section className="next-step-card">
        <div className="next-step-copy">
          <strong>다음 행동</strong>
          <span>{primaryAction ? primaryAction.hint : nextStepFallbackHint}</span>
        </div>
        <div className="next-step-actions">
          {primaryAction && (
            <button className="primary next-step-primary" onClick={primaryAction.run}>
              {primaryAction.label}
            </button>
          )}
          <button
            className="next-step-delete"
            disabled={!canDelete}
            title={!canDelete ? "삭제 권한 필요" : undefined}
            onClick={() => onDelete(selected.id)}
          >
            문의 삭제
          </button>
        </div>
      </section>
      {!canDelete && <div className="delete-lock-note">{deleteLock.body}</div>}

      <div className="support-drawer">
        <details open>
          <summary>처리 정보</summary>
          <div className="ops-grid">
            <label>
              상태
              <select
                value={selected.status}
                disabled={!canUpdate}
                onChange={(e) =>
                  onUpdateOperations(
                    selected.id,
                    { status: e.target.value as Status },
                    `상태 변경: ${statusLabels[e.target.value as Status]}`,
                  )
                }
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              우선순위
              <select
                value={selected.priority}
                disabled={!canUpdate}
                onChange={(e) =>
                  onUpdateOperations(
                    selected.id,
                    { priority: e.target.value as Inquiry["priority"] },
                    `우선순위 변경: ${e.target.value}`,
                  )
                }
              >
                <option value="보통">보통</option>
                <option value="긴급">긴급</option>
              </select>
            </label>
            <label>
              담당자
              <select
                value={selected.assigneeId ?? ""}
                disabled={!canUpdate}
                onChange={(e) => {
                  const assigneeId = e.target.value || null;
                  const nextAssignee = members.find((m) => m.id === assigneeId);
                  onUpdateOperations(selected.id, { assigneeId }, `담당자 변경: ${nextAssignee?.name ?? "미지정"}`);
                }}
              >
                <option value="">미지정</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} · {member.role}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="internal-note">
            내부 메모
            <textarea
              value={noteDraft}
              readOnly={!canUpdate}
              placeholder="고객에게 보이지 않는 처리 메모를 남기세요."
              onChange={(e) => setNoteDraft(e.target.value)}
            />
          </label>
          <div className="note-actions">
            <button
              className="secondary"
              disabled={!canUpdate || noteDraft === (selected.internalNote ?? "")}
              onClick={() => onUpdateOperations(selected.id, { internalNote: noteDraft }, "내부 메모 수정")}
            >
              메모 저장
            </button>
          </div>
        </details>

        <details open>
          <summary>시술 정보</summary>
          <div className="ops-grid">
            <label>
              시술 부위
              <input
                value={tattooDraft.tattooArea}
                readOnly={!canUpdate}
                placeholder="예: 팔 안쪽, 손목"
                onChange={(e) => setTattooDraft({ ...tattooDraft, tattooArea: e.target.value })}
              />
            </label>
            <label>
              크기
              <input
                value={tattooDraft.tattooSize}
                readOnly={!canUpdate}
                placeholder="예: 5x5cm"
                onChange={(e) => setTattooDraft({ ...tattooDraft, tattooSize: e.target.value })}
              />
            </label>
            <label>
              스타일
              <select
                value={tattooDraft.tattooStyle}
                disabled={!canUpdate}
                onChange={(e) => setTattooDraft({ ...tattooDraft, tattooStyle: e.target.value })}
              >
                <option value="">미지정</option>
                {Object.entries(tattooStyleLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              견적가
              <input
                value={tattooDraft.quotedPrice}
                readOnly={!canUpdate}
                placeholder="예: 200,000원"
                onChange={(e) => setTattooDraft({ ...tattooDraft, quotedPrice: e.target.value })}
              />
            </label>
            <label>
              희망 시술일
              <input
                value={tattooDraft.preferredDate}
                readOnly={!canUpdate}
                placeholder="예: 7/20 오후, 다음주 토요일"
                onChange={(e) => setTattooDraft({ ...tattooDraft, preferredDate: e.target.value })}
              />
            </label>
            <label>
              세션 수
              <input
                type="number"
                min={1}
                max={20}
                value={tattooDraft.sessionCount ?? ""}
                readOnly={!canUpdate}
                placeholder="예: 2"
                onChange={(e) => setTattooDraft({ ...tattooDraft, sessionCount: e.target.value ? parseInt(e.target.value, 10) : null })}
              />
            </label>
            <label className="checkbox-label" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={tattooDraft.isCoverup}
                disabled={!canUpdate}
                onChange={(e) => setTattooDraft({ ...tattooDraft, isCoverup: e.target.checked })}
              />
              커버업 여부
            </label>
            <label className="checkbox-label" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={tattooDraft.hasReferenceImage}
                disabled={!canUpdate}
                onChange={(e) => setTattooDraft({ ...tattooDraft, hasReferenceImage: e.target.checked })}
              />
              참고 이미지 받음
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              참고 이미지 메모 / 링크
              <input
                value={tattooDraft.referenceImageNote}
                readOnly={!canUpdate}
                placeholder="예: 인스타 DM 3장 · 기존 타투 손목 사진, 도안 링크"
                onChange={(e) => setTattooDraft({ ...tattooDraft, referenceImageNote: e.target.value })}
              />
            </label>

            <div className="reference-gallery" style={{ gridColumn: "1 / -1" }}>
              <div className="reference-gallery-head">
                <span>참고 이미지 {images.length > 0 ? `${images.length}/${MAX_REFERENCE_IMAGES}` : ""}</span>
                <label
                  className={`reference-upload-btn ${!canUpdate || images.length >= MAX_REFERENCE_IMAGES ? "disabled" : ""}`}
                  title={!canUpdate ? "수정 권한 필요" : images.length >= MAX_REFERENCE_IMAGES ? "최대 장수 도달" : undefined}
                >
                  이미지 첨부
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    disabled={!canUpdate || images.length >= MAX_REFERENCE_IMAGES}
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      if (files.length > 0) onUploadImages(files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {images.length === 0 ? (
                <p className="reference-gallery-empty">
                  첨부된 참고 이미지가 없습니다. 커버업·리터치·도안 상담은 이미지를 받으면 견적이 정확해집니다.
                </p>
              ) : (
                <div className="reference-thumb-grid">
                  {images.map((img) => {
                    const src = `/api/inquiries/${selected.id}/images/${img.id}`;
                    return (
                      <div className="reference-thumb" key={img.id}>
                        <a href={src} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt={img.filename} loading="lazy" />
                        </a>
                        {canUpdate && (
                          <button
                            type="button"
                            className="reference-thumb-delete"
                            title="이미지 삭제"
                            onClick={() => onDeleteImage(img.id)}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {imageStatus && <p className="reference-gallery-status">{imageStatus}</p>}
            </div>
          </div>
          <div className="note-actions">
            <button
              className="secondary"
              disabled={
                !canUpdate ||
                (tattooDraft.tattooArea === (selected.tattooArea ?? "") &&
                  tattooDraft.tattooSize === (selected.tattooSize ?? "") &&
                  tattooDraft.tattooStyle === (selected.tattooStyle ?? "") &&
                  tattooDraft.quotedPrice === (selected.quotedPrice ?? "") &&
                  tattooDraft.sessionCount === (selected.sessionCount ?? null) &&
                  tattooDraft.isCoverup === (selected.isCoverup ?? false) &&
                  tattooDraft.preferredDate === (selected.preferredDate ?? "") &&
                  tattooDraft.hasReferenceImage === (selected.hasReferenceImage ?? false) &&
                  tattooDraft.referenceImageNote === (selected.referenceImageNote ?? ""))
              }
              onClick={() =>
                onUpdateOperations(
                  selected.id,
                  {
                    tattooArea: tattooDraft.tattooArea || null,
                    tattooSize: tattooDraft.tattooSize || null,
                    tattooStyle: (tattooDraft.tattooStyle || null) as TattooStyle | null,
                    quotedPrice: tattooDraft.quotedPrice || null,
                    sessionCount: tattooDraft.sessionCount,
                    isCoverup: tattooDraft.isCoverup,
                    preferredDate: tattooDraft.preferredDate || null,
                    hasReferenceImage: tattooDraft.hasReferenceImage,
                    referenceImageNote: tattooDraft.referenceImageNote || null,
                  },
                  "시술 정보 수정",
                )
              }
            >
              시술 정보 저장
            </button>
          </div>
        </details>

        <details open={selected.status === "deposit_pending" || selected.status === "booked"}>
          <summary>예약금 · 예약 확정</summary>
          <div className="deposit-status-row">
            {selected.depositPaidAt ? (
              <span className="badge check-ok">입금 확인됨 · {formatDateTime(selected.depositPaidAt)}</span>
            ) : (
              <span className="badge check-gap">입금 미확인</span>
            )}
            {selected.appointmentAt && <span className="badge">예약 일시: {selected.appointmentAt}</span>}
          </div>
          <div className="ops-grid">
            <label>
              예약금 금액
              <input
                value={depositDraft.depositAmount}
                readOnly={!canUpdate}
                placeholder="예: 50,000원"
                onChange={(e) => setDepositDraft({ ...depositDraft, depositAmount: e.target.value })}
              />
            </label>
            <label>
              입금자명
              <input
                value={depositDraft.depositPayerName}
                readOnly={!canUpdate}
                placeholder="예: 김서연"
                onChange={(e) => setDepositDraft({ ...depositDraft, depositPayerName: e.target.value })}
              />
            </label>
            <label>
              예약 일시
              <input
                value={depositDraft.appointmentAt}
                readOnly={!canUpdate}
                placeholder="예: 7/20(토) 오후 2시"
                onChange={(e) => setDepositDraft({ ...depositDraft, appointmentAt: e.target.value })}
              />
            </label>
            <label className="checkbox-label" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={depositDraft.policyConfirmed}
                disabled={!canUpdate}
                onChange={(e) => setDepositDraft({ ...depositDraft, policyConfirmed: e.target.checked })}
              />
              노쇼/환불 정책 안내·동의
            </label>
          </div>
          <div className="note-actions">
            <button
              className="secondary"
              disabled={
                !canUpdate ||
                (depositDraft.depositAmount === (selected.depositAmount ?? "") &&
                  depositDraft.depositPayerName === (selected.depositPayerName ?? "") &&
                  depositDraft.appointmentAt === (selected.appointmentAt ?? "") &&
                  depositDraft.policyConfirmed === (selected.policyConfirmed ?? false))
              }
              onClick={() =>
                onUpdateOperations(
                  selected.id,
                  {
                    depositAmount: depositDraft.depositAmount || null,
                    depositPayerName: depositDraft.depositPayerName || null,
                    appointmentAt: depositDraft.appointmentAt || null,
                    policyConfirmed: depositDraft.policyConfirmed,
                  },
                  "예약금 정보 수정",
                )
              }
            >
              예약금 정보 저장
            </button>
            {!selected.depositPaidAt && (
              <button
                className="primary"
                disabled={!canUpdate}
                title={!canUpdate ? "수정 권한 필요" : undefined}
                onClick={() =>
                  onUpdateOperations(
                    selected.id,
                    {
                      depositPaidAt: new Date().toISOString(),
                      ...(selected.status === "deposit_pending" ? { status: "booked" as Status } : {}),
                    },
                    "예약금 입금 확인",
                  )
                }
              >
                입금 확인{selected.status === "deposit_pending" ? " → 예약 확정" : ""}
              </button>
            )}
          </div>
        </details>

        <details>
          <summary>분류와 품질</summary>
          <div className="meta-grid">
            <Meta label="채널" value={selected.channel} />
            <Meta label="유형" value={categoryLabels[selected.category]} />
            <Meta label="담당자" value={assignee?.name ?? "미지정"} />
            <Meta label="톤" value={toneProfiles[selected.tone].label} />
          </div>
          <div className="quality-grid">
            <Meta label="품질 점수" value={`${aiQuality.score}점`} />
            <Meta label="수정량" value={`${aiQuality.changedChars}자 · ${Math.round(aiQuality.changedRatio * 100)}%`} />
            <Meta label="금지 표현" value={aiQuality.forbiddenHits.length > 0 ? `${aiQuality.forbiddenHits.length}개` : "없음"} />
            <Meta label="누락 신호" value={aiQuality.missingSignals.length > 0 ? `${aiQuality.missingSignals.length}개` : "없음"} />
          </div>
          {(aiQuality.forbiddenHits.length > 0 || aiQuality.missingSignals.length > 0) && (
            <div className="quality-alerts">
              {aiQuality.forbiddenHits.map((word) => (
                <span className="quality-alert danger" key={word}>
                  금지 표현: {word}
                </span>
              ))}
              {aiQuality.missingSignals.map((signal) => (
                <span className="quality-alert" key={signal}>
                  확인 필요: {signal}
                </span>
              ))}
            </div>
          )}
          <div className="ai-compare-grid">
            <label>
              AI 원본 초안
              <textarea value={aiDraft} readOnly />
            </label>
            <label>
              현재 최종 답변
              <textarea value={replyDraft} readOnly />
            </label>
          </div>
        </details>

        <details>
          <summary>이력</summary>
          <div className="timeline-list">
            {timeline.map((item) => (
              <div className="timeline-item" key={item.id}>
                <span>{formatDateTime(item.at)}</span>
                <strong>{item.label}</strong>
                <em>{item.actor}</em>
              </div>
            ))}
          </div>
          <div className="revision-log">
            {(selected.replyRevisionLog ?? []).length === 0 ? (
              <p>아직 사람이 저장한 수정 이력이 없습니다.</p>
            ) : (
              selected.replyRevisionLog?.map((item) => (
                <div className="revision-item" key={item.id}>
                  <span>{formatDateTime(item.at)}</span>
                  <strong>{item.summary}</strong>
                  <em>{item.changedChars}자 수정</em>
                </div>
              ))
            )}
          </div>
          <div className="history-list">
            {history.length === 0 ? (
              <div className="history-item">같은 고객의 이전 문의가 없습니다.</div>
            ) : (
              history.map((item) => (
                <div className="history-item" key={item.id}>
                  <div className="history-top">
                    <span>{formatDateTime(item.createdAt)}</span>
                    <strong>{categoryLabels[item.category]}</strong>
                  </div>
                  <p className="history-message">{item.message}</p>
                </div>
              ))
            )}
          </div>
        </details>
      </div>
    </div>
  );
}
