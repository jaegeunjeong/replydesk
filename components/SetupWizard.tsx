"use client";

import type { OnboardingDraft, ToneKey, ResponseWindowKey } from "@/types";
import type { WorkspaceRole } from "@/lib/permissions";
import {
  businessProfiles,
  toneProfiles,
  responseWindows,
  channelOptions,
  intakeFieldOptions,
  manageableRoles,
  roleDescriptions,
} from "@/lib/constants";
import { roleLabels } from "@/lib/permissions";
import { toggleValue } from "@/lib/utils";
import { SelectField } from "@/components/shared";

export function SetupWizard({
  step,
  draft,
  onDraftChange,
  onClose,
  onBack,
  onNext,
}: {
  step: number;
  draft: OnboardingDraft;
  onDraftChange: (draft: OnboardingDraft) => void;
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const selectedProfile = businessProfiles[draft.businessProfile];
  const wizardSteps = ["업종", "접수", "지식", "팀", "확인"];
  const priceLineCount = draft.prices.split(/\r?\n/).filter((line) => line.trim()).length;
  const faqLineCount = draft.faq.split(/\r?\n/).filter((line) => line.trim()).length;
  const inviteEmail = draft.inviteEmail.trim();
  const inviteEmailIsValid = inviteEmail.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail);
  const canContinue =
    step === 2
      ? draft.channels.length > 0 && draft.intakeFields.length > 0
      : step === 3
        ? !draft.loadDefaults || (draft.prices.trim().length > 0 && draft.faq.trim().length > 0)
        : step === 4
          ? inviteEmailIsValid
          : true;
  const nextHint =
    step === 2 && !canContinue
      ? "채널과 접수 항목을 각각 1개 이상 선택해야 합니다."
      : step === 3 && !canContinue
        ? "저장할 가격표와 FAQ를 입력하거나 지식베이스 저장을 끄세요."
        : step === 4 && !canContinue
          ? "초대 이메일 형식을 확인하세요."
          : "";

  return (
    <div className="wizard-backdrop" role="dialog" aria-modal="true" aria-labelledby="wizardTitle">
      <section className="wizard">
        <div className="wizard-head">
          <div>
            <p className="eyebrow">Workspace onboarding</p>
            <h2 id="wizardTitle">처음 운영 세팅</h2>
          </div>
          <button className="icon-button" aria-label="초기 세팅 닫기" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="wizard-steps" aria-label="초기 세팅 단계">
          {wizardSteps.map((label, index) => {
            const value = index + 1;
            return (
              <span key={value} className={`wizard-step ${step === value ? "active" : ""}`}>
                <strong>{value}</strong>
                <small>{label}</small>
              </span>
            );
          })}
        </div>
        <div className="wizard-progress" aria-hidden="true">
          <span style={{ width: `${(step / wizardSteps.length) * 100}%` }} />
        </div>

        {step === 1 && (
          <div className="wizard-page active">
            <h3>응대 기준을 정하세요</h3>
            <p>답변 말투와 응답 속도는 AI 초안 생성과 고객 안내에 반영됩니다.</p>
            <div className="wizard-guide">
              <strong>InkDesk는 타투 스튜디오 전용입니다</strong>
              <span>견적, 예약, 커버업, 리터치, 애프터케어 상담에 맞춰진 답변과 분류를 제공합니다.</span>
            </div>
            <div className="wizard-insight" style={{ marginBottom: "12px" }}>
              <span>업종</span>
              <strong>{selectedProfile.label} — {selectedProfile.description}</strong>
            </div>
            <div className="wizard-form">
              <SelectField
                label="응대 톤"
                value={draft.toneProfile}
                onChange={(value) => onDraftChange({ ...draft, toneProfile: value as ToneKey })}
                options={Object.entries(toneProfiles).map(([value, tone]) => ({ value, label: tone.label }))}
              />
              <SelectField
                label="예상 응답"
                value={draft.responseWindow}
                onChange={(value) => onDraftChange({ ...draft, responseWindow: value as ResponseWindowKey })}
                options={Object.entries(responseWindows).map(([value, label]) => ({ value, label }))}
              />
            </div>
            <div className="wizard-insight">
              <span>현재 기준</span>
              <strong>
                {selectedProfile.label} · {toneProfiles[draft.toneProfile].label} · {responseWindows[draft.responseWindow]}
              </strong>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="wizard-page active">
            <h3>문의가 들어오는 채널을 고르세요</h3>
            <p>채널과 필수 수집 항목을 정해두면 이후 문의 입력과 자동 분류 기준이 선명해집니다.</p>
            <div className="wizard-guide">
              <strong>사용자에게 필요한 첫 화면을 결정합니다</strong>
              <span>체크한 채널과 접수 항목은 설정 화면에도 저장되어 이후 문의 운영 기준으로 사용됩니다.</span>
            </div>
            <div className="wizard-pick-grid">
              <div>
                <h4>운영 채널</h4>
                {channelOptions.map((channel) => (
                  <label className="wizard-check" key={channel}>
                    <input
                      type="checkbox"
                      checked={draft.channels.includes(channel)}
                      onChange={() => onDraftChange({ ...draft, channels: toggleValue(draft.channels, channel) })}
                    />
                    <span>{channel}</span>
                  </label>
                ))}
              </div>
              <div>
                <h4>문의 접수 시 받을 정보</h4>
                {intakeFieldOptions.map((field) => (
                  <label className="wizard-check" key={field}>
                    <input
                      type="checkbox"
                      checked={draft.intakeFields.includes(field)}
                      onChange={() => onDraftChange({ ...draft, intakeFields: toggleValue(draft.intakeFields, field) })}
                    />
                    <span>{field}</span>
                  </label>
                ))}
              </div>
            </div>
            <label className="wizard-field">
              첫 응대 문구
              <textarea value={draft.welcomeMessage} onChange={(e) => onDraftChange({ ...draft, welcomeMessage: e.target.value })} />
            </label>
            <div className="wizard-insight">
              <span>선택 상태</span>
              <strong>
                채널 {draft.channels.length}개 · 접수 항목 {draft.intakeFields.length}개
              </strong>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="wizard-page active">
            <h3>가격표와 FAQ를 준비하세요</h3>
            <p>AI 초안이 참고할 핵심 운영 정보를 온보딩에서 바로 정리합니다.</p>
            <div className="wizard-guide">
              <strong>좋은 답변 초안의 재료입니다</strong>
              <span>가격, 환불, 예약, 위치처럼 반복해서 묻는 내용을 한 줄씩 넣어두면 문의 답변에 바로 반영됩니다.</span>
            </div>
            <label className="wizard-check">
              <input
                type="checkbox"
                checked={draft.loadDefaults}
                onChange={(e) => onDraftChange({ ...draft, loadDefaults: e.target.checked })}
              />
              <span>이 정보를 지식베이스에 저장</span>
            </label>
            <div className="wizard-form">
              <label>
                가격표
                <textarea value={draft.prices} onChange={(e) => onDraftChange({ ...draft, prices: e.target.value })} />
              </label>
              <label>
                FAQ
                <textarea value={draft.faq} onChange={(e) => onDraftChange({ ...draft, faq: e.target.value })} />
              </label>
            </div>
            <div className="wizard-insight">
              <span>지식베이스 준비도</span>
              <strong>
                가격 항목 {priceLineCount}개 · FAQ 항목 {faqLineCount}개
              </strong>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="wizard-page active">
            <h3>같이 응대할 멤버가 있나요?</h3>
            <p>지금 초대하지 않아도 멤버 화면에서 언제든 추가할 수 있습니다.</p>
            <div className="wizard-guide">
              <strong>권한은 작게 시작하는 편이 좋습니다</strong>
              <span>팀원은 상담 처리와 지식베이스 수정, 대표는 설정과 멤버 관리를 맡기는 구성이 현실적입니다.</span>
            </div>
            <div className="wizard-form">
              <label>
                이름
                <input value={draft.inviteName} placeholder="상담 담당자" onChange={(e) => onDraftChange({ ...draft, inviteName: e.target.value })} />
              </label>
              <label>
                이메일
                <input value={draft.inviteEmail} placeholder="member@example.com" onChange={(e) => onDraftChange({ ...draft, inviteEmail: e.target.value })} />
              </label>
              <SelectField
                label="역할"
                value={draft.inviteRole}
                onChange={(value) => onDraftChange({ ...draft, inviteRole: value as WorkspaceRole })}
                options={manageableRoles.map((role) => ({ value: role, label: roleLabels[role] }))}
              />
            </div>
            <div className="wizard-role-note">
              <strong>{roleLabels[draft.inviteRole]}</strong>
              <span>{roleDescriptions[draft.inviteRole]}</span>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="wizard-page active">
            <h3>세팅 내용을 확인하세요</h3>
            <p>완료하면 워크스페이스 설정, 지식베이스, 선택한 멤버 초대가 저장됩니다.</p>
            <div className="wizard-preview-list">
              <div>
                <span>응대 기준</span>
                <strong>
                  {selectedProfile.label} · {toneProfiles[draft.toneProfile].label} · {responseWindows[draft.responseWindow]}
                </strong>
              </div>
              <div>
                <span>접수 채널</span>
                <strong>{draft.channels.length > 0 ? draft.channels.join(", ") : "미지정"}</strong>
              </div>
              <div>
                <span>수집 항목</span>
                <strong>{draft.intakeFields.length > 0 ? draft.intakeFields.join(", ") : "미지정"}</strong>
              </div>
              <div>
                <span>지식베이스</span>
                <strong>{draft.loadDefaults ? `가격 ${priceLineCount}개 · FAQ ${faqLineCount}개 저장` : "이번에는 저장하지 않음"}</strong>
              </div>
              <div>
                <span>팀 초대</span>
                <strong>{inviteEmail ? `${inviteEmail} · ${roleLabels[draft.inviteRole]}` : "나중에 초대"}</strong>
              </div>
            </div>
            <div className="wizard-guide">
              <strong>완료 후 바로 할 일</strong>
              <span>문의 화면에서 샘플 문의를 넣어 답변 품질을 확인하고, 지식베이스 화면에서 실제 가격/FAQ로 교체하세요.</span>
            </div>
          </div>
        )}

        <div className="wizard-actions">
          {nextHint && <span className="wizard-warning">{nextHint}</span>}
          <button className="secondary" style={{ visibility: step === 1 ? "hidden" : "visible" }} onClick={onBack}>
            이전
          </button>
          <button className="primary" disabled={!canContinue} title={nextHint || undefined} onClick={onNext}>
            {step === 5 ? "온보딩 완료" : "다음"}
          </button>
        </div>
      </section>
    </div>
  );
}
