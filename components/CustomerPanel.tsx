"use client";

import { useEffect, useState } from "react";
import type { Customer, Inquiry } from "@/types";
import { customerStatusLabels } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { parseTagDraft } from "@/lib/utils";
import { categoryLabels, statusLabels, tattooStyleLabels } from "@/lib/constants";
import { getCustomerTattooSummary } from "@/lib/inquiry";
import { Metric, PermissionNotice } from "@/components/shared";

export function CustomerPanel({
  customers,
  selectedCustomer,
  selectedCustomerInquiries,
  onSelect,
  onUpdate,
  canUpdate,
  lockMessage,
}: {
  customers: Customer[];
  selectedCustomer: Customer | null;
  selectedCustomerInquiries: Inquiry[];
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Pick<Customer, "status" | "tags" | "note" | "skinNotes">>) => void;
  canUpdate: boolean;
  lockMessage?: { title: string; body: string };
}) {
  const [tagDraft, setTagDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [skinNotesDraft, setSkinNotesDraft] = useState("");

  useEffect(() => {
    setTagDraft((selectedCustomer?.tags ?? []).join(", "));
    setNoteDraft(selectedCustomer?.note ?? "");
    setSkinNotesDraft(selectedCustomer?.skinNotes ?? "");
  }, [selectedCustomer?.id, selectedCustomer?.note, selectedCustomer?.tags, selectedCustomer?.skinNotes]);

  const repeatCustomers = customers.filter((c) => c.inquiryCount >= 2).length;
  const bookedCustomers = customers.filter((c) => c.status === "booked").length;

  if (customers.length === 0) {
    return (
      <section className="customer-panel empty-state">
        문의가 등록되면 고객 프로필이 자동으로 만들어집니다.
      </section>
    );
  }

  return (
    <section className="customer-panel">
      {lockMessage && <PermissionNotice title={lockMessage.title} body={lockMessage.body} />}
      <div className="customer-summary">
        <Metric label="전체 고객" value={customers.length} />
        <Metric label="재문의 고객" value={repeatCustomers} />
        <Metric label="예약 확정" value={bookedCustomers} />
        <Metric label="선택 고객 이력" value={selectedCustomerInquiries.length} />
      </div>

      <div className="customer-layout">
        <div className="customer-list-panel">
          <strong style={{fontSize:'14px',fontWeight:800}}>고객 목록 <span style={{color:'#9aa19d',fontWeight:600}}>{customers.length}명</span></strong>
          <div className="customer-list">
            {customers.map((customer) => (
              <button
                type="button"
                key={customer.id}
                className={`customer-card ${selectedCustomer?.id === customer.id ? "selected" : ""}`}
                onClick={() => onSelect(customer.id)}
                style={{display:'flex',alignItems:'center',gap:'10px'}}
              >
                <span className="avatar-md" style={{background:'#eef2f0',color:'#0d7369'}}>{customer.name.charAt(0)}</span>
                <div style={{display:'flex',flexDirection:'column',gap:'2px',flex:1,minWidth:0}}>
                  <strong style={{fontSize:'13.5px'}}>{customer.name}</strong>
                  <span style={{fontSize:'11.5px'}}>{customer.channel}</span>
                </div>
                <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'4px'}}>
                  <span className={`badge customer-status-${customer.status ?? "new"}`}>
                    {customerStatusLabels[customer.status ?? "new"]}
                  </span>
                  <span style={{fontSize:'11px',color:'#9aa19d'}}>{customer.inquiryCount}건</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="customer-detail-panel">
          {selectedCustomer ? (
            <>
              <div className="customer-profile-head" style={{flexDirection:'column',alignItems:'flex-start',gap:'8px'}}>
                <p className="eyebrow" style={{margin:0}}>Customer profile</p>
                <div style={{display:'flex',alignItems:'center',gap:'11px'}}>
                  <span className="avatar-lg">{selectedCustomer.name.charAt(0)}</span>
                  <div>
                    <h3>{selectedCustomer.name}</h3>
                    <div style={{display:'flex',alignItems:'center',gap:'8px',marginTop:'3px'}}>
                      <span style={{fontSize:'12.5px',color:'#6b7572'}}>{selectedCustomer.contact || selectedCustomer.channel}</span>
                      <span className={`badge customer-status-${selectedCustomer.status ?? "new"}`}>
                        {customerStatusLabels[selectedCustomer.status ?? "new"]}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="customer-tattoo-summary">
                <div className="section-title-row">
                  <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    <span style={{width:'6px',height:'6px',borderRadius:'999px',background:'#0d7369',flexShrink:0}}></span>
                    <h4 style={{margin:0,fontSize:'14px',fontWeight:800}}>시술 요약</h4>
                  </div>
                </div>
                {(() => {
                  const summary = getCustomerTattooSummary(selectedCustomerInquiries);
                  return (
                    <>
                      <div className="tattoo-summary-metrics">
                        <Metric label="예약 확정" value={summary.bookedCount} />
                        <Metric label="시술 완료" value={summary.completedCount} />
                        <Metric label="리터치·관리" value={summary.retouchCareCount} />
                      </div>
                      <div className="customer-profile-grid">
                        <div className="meta-item"><span>최근 작업 부위</span><strong>{summary.recentArea ?? "기록 없음"}</strong></div>
                        <div className="meta-item"><span>선호 스타일</span><strong>{summary.preferredStyle ?? "기록 없음"}</strong></div>
                        <div className="meta-item"><span>최근 견적가</span><strong>{summary.latestQuote ?? "미정"}</strong></div>
                        <div className="meta-item"><span>주의 메모</span><strong>{selectedCustomer.skinNotes?.trim() ? "있음" : "없음"}</strong></div>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="customer-profile-grid">
                <div className="meta-item"><span>대표 채널</span><strong>{selectedCustomer.channel}</strong></div>
                <div className="meta-item"><span>문의 수</span><strong>{selectedCustomer.inquiryCount}건</strong></div>
                <div className="meta-item"><span>최근 문의</span><strong>{selectedCustomer.lastInquiryAt ? formatDateTime(selectedCustomer.lastInquiryAt) : "없음"}</strong></div>
                <div className="meta-item"><span>고객 ID</span><strong>{selectedCustomer.id}</strong></div>
              </div>

              <div className="customer-edit-grid">
                <label>
                  고객 상태
                  <select
                    value={selectedCustomer.status ?? "new"}
                    disabled={!canUpdate}
                    onChange={(e) => onUpdate(selectedCustomer.id, { status: e.target.value as Customer["status"] })}
                  >
                    {Object.entries(customerStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  태그
                  <div className="tag-row">
                    {(selectedCustomer.tags ?? []).length === 0 ? (
                      <span className="tag-empty">태그 없음</span>
                    ) : (
                      selectedCustomer.tags?.map((tag) => (
                        <span className="tag" key={tag}>{tag}</span>
                      ))
                    )}
                  </div>
                  <input
                    value={tagDraft}
                    disabled={!canUpdate}
                    placeholder="예: 단골, 가격문의, 예약중"
                    onChange={(e) => setTagDraft(e.target.value)}
                  />
                </label>
              </div>

              <label className="customer-note">
                고객 메모
                <textarea
                  value={noteDraft}
                  readOnly={!canUpdate}
                  placeholder="응대 시 참고할 고객 특이사항을 남기세요."
                  onChange={(e) => setNoteDraft(e.target.value)}
                />
              </label>
              <label className="customer-note">
                피부 특이사항
                <textarea
                  value={skinNotesDraft}
                  readOnly={!canUpdate}
                  placeholder="켈로이드 체질, 민감성 피부, 알레르기 등 시술 시 참고할 피부 정보를 남기세요."
                  onChange={(e) => setSkinNotesDraft(e.target.value)}
                />
              </label>
              <div className="note-actions">
                <button
                  className="secondary"
                  disabled={
                    !canUpdate ||
                    (tagDraft === (selectedCustomer.tags ?? []).join(", ") &&
                      noteDraft === (selectedCustomer.note ?? "") &&
                      skinNotesDraft === (selectedCustomer.skinNotes ?? ""))
                  }
                  onClick={() => onUpdate(selectedCustomer.id, { tags: parseTagDraft(tagDraft), note: noteDraft, skinNotes: skinNotesDraft })}
                >
                  프로필 저장
                </button>
              </div>

              <div className="customer-history-section">
                <h4>문의 이력</h4>
                <div className="history-list">
                  {selectedCustomerInquiries.map((inquiry) => (
                    <div className="history-item" key={inquiry.id}>
                      <div className="history-top">
                        <span>{formatDateTime(inquiry.createdAt)}</span>
                        <span>
                          {categoryLabels[inquiry.category]} · {statusLabels[inquiry.status]}
                        </span>
                      </div>
                      <p className="history-message">{inquiry.message}</p>
                      {(inquiry.tattooArea || inquiry.tattooSize || inquiry.tattooStyle || inquiry.quotedPrice) && (
                        <div className="history-meta-row">
                          {inquiry.tattooArea && <span className="history-meta">{inquiry.tattooArea}</span>}
                          {inquiry.tattooSize && <span className="history-meta">{inquiry.tattooSize}</span>}
                          {inquiry.tattooStyle && <span className="history-meta">{tattooStyleLabels[inquiry.tattooStyle] ?? inquiry.tattooStyle}</span>}
                          {inquiry.quotedPrice && <span className="history-meta">{inquiry.quotedPrice}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="detail-empty">고객을 선택하면 프로필이 표시됩니다.</div>
          )}
        </div>
      </div>
    </section>
  );
}
