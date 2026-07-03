"use client";

import { useEffect, useMemo, useState } from "react";
import type { BusinessProfileKey } from "@/types";
import { businessProfiles } from "@/lib/constants";
import { PermissionNotice } from "@/components/shared";

type PriceItem = {
  id: string;
  name: string;
  price: string;
  note: string;
};

type FaqItem = {
  id: string;
  keyword: string;
  answer: string;
};

export function KnowledgePanel({
  profile,
  knowledge,
  onSave,
  onLoadDefault,
  readOnly,
  lockMessage,
}: {
  profile: BusinessProfileKey;
  knowledge: { prices: string; faq: string };
  onSave: (prices: string, faq: string) => void;
  onLoadDefault: () => void;
  readOnly: boolean;
  lockMessage?: { title: string; body: string };
}) {
  const [priceItems, setPriceItems] = useState<PriceItem[]>(() => parsePriceItems(knowledge.prices));
  const [faqItems, setFaqItems] = useState<FaqItem[]>(() => parseFaqItems(knowledge.faq));
  const [status, setStatus] = useState(`${businessProfiles[profile].label} 매장 정보를 편집 중입니다.`);

  useEffect(() => {
    setPriceItems(parsePriceItems(knowledge.prices));
    setFaqItems(parseFaqItems(knowledge.faq));
    setStatus(`${businessProfiles[profile].label} 스튜디오 정보를 편집 중입니다.`);
  }, [knowledge.faq, knowledge.prices, profile]);

  const serializedPrices = useMemo(() => serializePriceItems(priceItems), [priceItems]);
  const serializedFaq = useMemo(() => serializeFaqItems(faqItems), [faqItems]);
  const validPriceItems = priceItems.filter((item) => item.name.trim() || item.price.trim() || item.note.trim());
  const validFaqItems = faqItems.filter((item) => item.keyword.trim() || item.answer.trim());
  const previewLines = [
    validPriceItems[0] ? formatPriceLine(validPriceItems[0]) : "",
    validFaqItems[0] ? `${validFaqItems[0].keyword} | ${validFaqItems[0].answer}` : "",
  ].filter(Boolean);

  function updatePriceItem(id: string, patch: Partial<PriceItem>) {
    setPriceItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function updateFaqItem(id: string, patch: Partial<FaqItem>) {
    setFaqItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removePriceItem(id: string) {
    setPriceItems((current) => ensurePriceRows(current.filter((item) => item.id !== id)));
  }

  function removeFaqItem(id: string) {
    setFaqItems((current) => ensureFaqRows(current.filter((item) => item.id !== id)));
  }

  function saveKnowledge() {
    onSave(serializedPrices, serializedFaq);
    setStatus("답변 소스를 저장했습니다. 다음 문의부터 AI 초안에 반영됩니다.");
  }

  return (
    <section className="knowledge-workflow">
      {lockMessage && <PermissionNotice title={lockMessage.title} body={lockMessage.body} />}

      <div className="source-scoreboard">
        <div className="source-stat-card">
          <div className="source-stat-label">가격/서비스</div>
          <div className="source-stat-value">{validPriceItems.length}</div>
        </div>
        <div className="source-stat-card">
          <div className="source-stat-label">안내 문구</div>
          <div className="source-stat-value">{validFaqItems.length}</div>
        </div>
        <div className="source-stat-card">
          <div className="source-stat-label">답변 소스</div>
          <div className="source-stat-value" style={{color:'#0d7369'}}>{validPriceItems.length + validFaqItems.length}</div>
        </div>
      </div>

      <section className="knowledge-builder-card">
        <div className="section-title-row">
          <strong>가격/서비스 항목</strong>
          <button
            className="kb-add-btn"
            disabled={readOnly}
            onClick={() => setPriceItems((current) => [...current, createPriceItem()])}
          >
            + 항목 추가
          </button>
        </div>
        <div className="knowledge-item-list">
          <div className="knowledge-col-header price-row">
            <span />
            <span>항목명</span>
            <span>가격</span>
            <span>메모</span>
            <span />
          </div>
          {priceItems.map((item, index) => (
            <div className="knowledge-item-row price-row" key={item.id}>
              <span className="row-index">{index + 1}</span>
              <input
                value={item.name}
                readOnly={readOnly}
                placeholder="예: 레터링 타투"
                onChange={(event) => updatePriceItem(item.id, { name: event.target.value })}
              />
              <input
                value={item.price}
                readOnly={readOnly}
                placeholder="예: 80,000원~"
                onChange={(event) => updatePriceItem(item.id, { price: event.target.value })}
              />
              <input
                value={item.note}
                readOnly={readOnly}
                placeholder="예: 크기/디테일에 따라 변동"
                onChange={(event) => updatePriceItem(item.id, { note: event.target.value })}
              />
              <button className="kb-delete-btn" disabled={readOnly || priceItems.length <= 1} onClick={() => removePriceItem(item.id)}>
                삭제
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="knowledge-builder-card">
        <div className="section-title-row">
          <strong>자주 쓰는 안내 문구</strong>
          <button
            className="kb-add-btn"
            disabled={readOnly}
            onClick={() => setFaqItems((current) => [...current, createFaqItem()])}
          >
            + 문구 추가
          </button>
        </div>
        <div className="knowledge-item-list">
          {faqItems.map((item, index) => (
            <div className="knowledge-item-row faq-row" key={item.id}>
              <span className="row-index" style={{marginTop:'5px'}}>{index + 1}</span>
              <input
                value={item.keyword}
                readOnly={readOnly}
                placeholder="키워드"
                onChange={(event) => updateFaqItem(item.id, { keyword: event.target.value })}
              />
              <textarea
                value={item.answer}
                readOnly={readOnly}
                placeholder="안내 문장"
                onChange={(event) => updateFaqItem(item.id, { answer: event.target.value })}
              />
              <button className="kb-delete-btn" disabled={readOnly || faqItems.length <= 1} onClick={() => removeFaqItem(item.id)}>
                삭제
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="knowledge-preview">
        <div>
          <strong>답변에 이렇게 반영됩니다</strong>
          <p>{previewLines.length > 0 ? previewLines.join(" · ") : "항목을 입력하면 AI 초안에 참고할 매장 정보가 붙습니다."}</p>
        </div>
        <span>{businessProfiles[profile].label}</span>
      </div>

      <div className="knowledge-actions" style={{display:'flex',justifyContent:'flex-end',gap:'8px'}}>
        <button className="secondary" disabled={readOnly} onClick={onLoadDefault}>업종 기본값</button>
        <button className="primary" disabled={readOnly} onClick={saveKnowledge}>저장</button>
      </div>
    </section>
  );
}

function parsePriceItems(value: string): PriceItem[] {
  const rows = value
    .split(/\r?\n/)
    .map((line, index) => {
      const [name = "", price = "", ...notes] = line.split("|").map((part) => part.trim());
      return { id: `price-${index}-${name || "row"}`, name, price, note: notes.join(" | ") };
    })
    .filter((item) => item.name || item.price || item.note);
  return ensurePriceRows(rows);
}

function parseFaqItems(value: string): FaqItem[] {
  const rows = value
    .split(/\r?\n/)
    .map((line, index) => {
      const [keyword = "", ...answers] = line.split("|").map((part) => part.trim());
      return { id: `faq-${index}-${keyword || "row"}`, keyword, answer: answers.join(" | ") };
    })
    .filter((item) => item.keyword || item.answer);
  return ensureFaqRows(rows);
}

function serializePriceItems(items: PriceItem[]) {
  return items
    .map((item) => formatPriceLine(item))
    .filter(Boolean)
    .join("\n");
}

function serializeFaqItems(items: FaqItem[]) {
  return items
    .map((item) => [item.keyword, item.answer].map((part) => part.trim()).filter(Boolean).join(" | "))
    .filter(Boolean)
    .join("\n");
}

function formatPriceLine(item: PriceItem) {
  return [item.name, item.price, item.note].map((part) => part.trim()).filter(Boolean).join(" | ");
}

function ensurePriceRows(items: PriceItem[]) {
  return items.length > 0 ? items : [createPriceItem()];
}

function ensureFaqRows(items: FaqItem[]) {
  return items.length > 0 ? items : [createFaqItem()];
}

function createPriceItem(): PriceItem {
  return { id: `price-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: "", price: "", note: "" };
}

function createFaqItem(): FaqItem {
  return { id: `faq-${Date.now()}-${Math.random().toString(36).slice(2)}`, keyword: "", answer: "" };
}
