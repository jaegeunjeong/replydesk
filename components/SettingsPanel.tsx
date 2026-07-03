"use client";

import type { Settings, DemoWorkspace, BusinessProfileKey, ToneKey, ResponseWindowKey } from "@/types";
import { businessProfiles, toneProfiles, responseWindows, channelOptions, intakeFieldOptions, defaultSettings } from "@/lib/constants";
import { toggleValue } from "@/lib/utils";
import { roleLabels } from "@/lib/permissions";
import { SelectField, PermissionNotice } from "@/components/shared";

export function SettingsPanel({
  settings,
  workspace,
  canWrite,
  canReset,
  lockMessage,
  resetLockMessage,
  onChange,
  onReset,
}: {
  settings: Settings;
  workspace: DemoWorkspace | null;
  canWrite: boolean;
  canReset: boolean;
  lockMessage?: { title: string; body: string };
  resetLockMessage?: { title: string; body: string };
  onChange: (settings: Settings) => void;
  onReset: () => void;
}) {
  const selectedChannels = settings.channels.length > 0 ? settings.channels : defaultSettings.channels;
  const selectedFields = settings.intakeFields.length > 0 ? settings.intakeFields : defaultSettings.intakeFields;

  return (
    <section className="settings-workflow">
      {lockMessage && <PermissionNotice title={lockMessage.title} body={lockMessage.body} />}

      {workspace && (
        <div style={{display:'flex',justifyContent:'flex-end'}}>
          <div className="settings-context-pill">
            <span>현재 적용 대상</span>
            <span>{workspace.name} · {businessProfiles[workspace.profile].label} · {roleLabels[workspace.role as keyof typeof roleLabels] ?? workspace.role}</span>
          </div>
        </div>
      )}

      <div className="settings-grid">
        <section className="settings-card">
          <strong className="settings-card-title">기본 응대 스타일</strong>
          <div className="settings-field-list">
            <SelectField
              label="업종"
              value={settings.businessProfile}
              disabled={!canWrite}
              onChange={(value) => onChange({ ...settings, businessProfile: value as BusinessProfileKey })}
              options={Object.entries(businessProfiles).map(([value, profile]) => ({ value, label: profile.label }))}
            />
            <SelectField
              label="응대 톤"
              value={settings.toneProfile}
              disabled={!canWrite}
              onChange={(value) => onChange({ ...settings, toneProfile: value as ToneKey })}
              options={Object.entries(toneProfiles).map(([value, tone]) => ({ value, label: tone.label }))}
            />
            <SelectField
              label="응답 시간 안내"
              value={settings.responseWindow}
              disabled={!canWrite}
              onChange={(value) => onChange({ ...settings, responseWindow: value as ResponseWindowKey })}
              options={Object.entries(responseWindows).map(([value, label]) => ({ value, label }))}
            />
          </div>
        </section>

        <section className="settings-card">
          <strong className="settings-card-title">운영 채널</strong>
          <div className="choice-grid" style={{marginTop:'16px'}}>
            {channelOptions.map((channel) => (
              <label className="choice-check" key={channel}>
                <input
                  type="checkbox"
                  checked={selectedChannels.includes(channel)}
                  disabled={!canWrite}
                  onChange={() => onChange({ ...settings, channels: toggleValue(selectedChannels, channel) })}
                />
                <span>{channel}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="settings-card">
          <strong className="settings-card-title">문의 접수 항목</strong>
          <div className="choice-grid" style={{marginTop:'16px'}}>
            {intakeFieldOptions.map((field) => (
              <label className="choice-check" key={field}>
                <input
                  type="checkbox"
                  checked={selectedFields.includes(field)}
                  disabled={!canWrite}
                  onChange={() => onChange({ ...settings, intakeFields: toggleValue(selectedFields, field) })}
                />
                <span>{field}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="settings-card">
          <strong className="settings-card-title">첫 응대 문구</strong>
          <textarea
            className="settings-welcome-textarea"
            value={settings.welcomeMessage}
            readOnly={!canWrite}
            onChange={(e) => onChange({ ...settings, welcomeMessage: e.target.value })}
          />
        </section>
      </div>

      <div className="workspace-default-row">
        <div>
          <strong>워크스페이스 기본값 복원</strong>
          <p>현재 업종 기준으로 응대 정책과 가격표/FAQ를 다시 불러옵니다.</p>
          {!canReset && resetLockMessage && <em>{resetLockMessage.body}</em>}
        </div>
        <button className="settings-reset-btn" disabled={!canReset} onClick={onReset}>
          기본값 복원
        </button>
      </div>
    </section>
  );
}
