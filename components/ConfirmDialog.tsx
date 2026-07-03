"use client";

import type { ConfirmAction } from "@/types";

export function ConfirmDialog({
  action,
  onCancel,
  onConfirm,
}: {
  action: ConfirmAction;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="confirm-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmTitle"
        aria-describedby="confirmMessage"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={`confirm-icon ${action.tone === "danger" ? "danger" : ""}`} aria-hidden="true">
          !
        </div>
        <div className="confirm-copy">
          <p className="eyebrow">Confirm action</p>
          <h2 id="confirmTitle">{action.title}</h2>
          <p id="confirmMessage">{action.message}</p>
        </div>
        <div className="confirm-actions">
          <button className="secondary" onClick={onCancel}>
            취소
          </button>
          <button className={action.tone === "danger" ? "danger" : "primary"} onClick={onConfirm}>
            {action.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
