"use client";

import type { Inquiry, Status } from "@/types";
import { categoryLabels, statusLabels, tattooStyleLabels } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";

export function InquiryList({
  inquiries,
  selectedId,
  onSelect,
  onStatusChange,
  canUpdate,
  lockMessage,
}: {
  inquiries: Inquiry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onStatusChange: (id: string, status: Status) => void;
  canUpdate: boolean;
  lockMessage?: string;
}) {
  if (inquiries.length === 0) {
    return <div className="inquiry-list empty-state">조건에 맞는 문의가 없습니다.</div>;
  }

  return (
    <div className="inquiry-list">
      {lockMessage && <div className="list-lock-note">{lockMessage}</div>}
      {inquiries.map((inquiry) => (
        <article
          key={inquiry.id}
          className={`inquiry-card ${inquiry.id === selectedId ? "selected" : ""}`}
          onClick={() => onSelect(inquiry.id)}
        >
          <div className="card-top">
            <div style={{display:'flex',alignItems:'center',gap:'8px',minWidth:0}}>
              <span className="avatar-sm">{inquiry.customer.charAt(0)}</span>
              <strong className="customer">{inquiry.customer}</strong>
              <small style={{fontSize:'11px',color:'#9aa19d',flexShrink:0}}>{formatDateTime(inquiry.createdAt)}</small>
            </div>
            <select
              className="status-select"
              value={inquiry.status}
              disabled={!canUpdate}
              title={!canUpdate ? "수정 권한 필요" : undefined}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onStatusChange(inquiry.id, e.target.value as Status)}
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <p className="message">{inquiry.message}</p>
          <div className="card-meta">
            <div className="badge-row">
              <span className="badge category">{categoryLabels[inquiry.category]}</span>
              <span className={`badge ${inquiry.priority === "긴급" ? "urgent" : ""}`}>{inquiry.priority}</span>
              {inquiry.tattooStyle && <span className="badge">{tattooStyleLabels[inquiry.tattooStyle] ?? inquiry.tattooStyle}</span>}
              {inquiry.tattooArea && <span className="badge">{inquiry.tattooArea}</span>}
              {inquiry.isCoverup && <span className="badge urgent">커버업</span>}
            </div>
            <span className="badge">{inquiry.channel}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
