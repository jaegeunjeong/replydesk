"use client";

import type { AuthDraft } from "@/types";

export function AuthScreen({
  draft,
  status,
  isLoading,
  onDraftChange,
  onSubmit,
}: {
  draft: AuthDraft;
  status: string;
  isLoading: boolean;
  onDraftChange: (draft: AuthDraft) => void;
  onSubmit: () => void;
}) {
  const isRegister = draft.mode === "register";

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand auth-brand">
          <div className="brand-mark">I</div>
          <div>
            <h1>InkDesk</h1>
            <p>타투 상담 자동화</p>
          </div>
        </div>
        <div>
          <p className="eyebrow">Account</p>
          <h2>{isRegister ? "새 워크스페이스 만들기" : "로그인"}</h2>
          <p className="auth-copy">
            {isRegister
              ? "계정과 워크스페이스를 만들고 온보딩을 시작합니다."
              : "데모 계정은 owner@example.local / admin1234 입니다."}
          </p>
        </div>
        <div className="auth-tabs">
          <button className={draft.mode === "login" ? "active" : ""} onClick={() => onDraftChange({ ...draft, mode: "login" })}>
            로그인
          </button>
          <button className={draft.mode === "register" ? "active" : ""} onClick={() => onDraftChange({ ...draft, mode: "register" })}>
            회원가입
          </button>
        </div>
        <div className="auth-form">
          {isRegister && (
            <>
              <label>
                이름
                <input value={draft.name} onChange={(e) => onDraftChange({ ...draft, name: e.target.value })} />
              </label>
              <label>
                워크스페이스 이름
                <input value={draft.workspaceName} onChange={(e) => onDraftChange({ ...draft, workspaceName: e.target.value })} />
              </label>
            </>
          )}
          <label>
            이메일
            <input value={draft.email} type="email" onChange={(e) => onDraftChange({ ...draft, email: e.target.value })} />
          </label>
          <label>
            비밀번호
            <input value={draft.password} type="password" onChange={(e) => onDraftChange({ ...draft, password: e.target.value })} />
          </label>
          <button className="primary" disabled={isLoading} onClick={onSubmit}>
            {isRegister ? "계정 만들기" : "로그인"}
          </button>
        </div>
        <div className={`db-banner ${isLoading ? "loading" : ""}`}>{status}</div>
      </section>
    </main>
  );
}
