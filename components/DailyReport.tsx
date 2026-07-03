"use client";

import { useEffect, useState } from "react";
import { categoryLabels } from "@/lib/constants";
import type { Category } from "@/types";

type DailyReportData = {
  date: string;
  today: {
    total: number;
    done: number;
    open: number;
    urgent: number;
    new: number;
    drafted: number;
    pending: number;
    escalated: number;
  };
  all: {
    open: number;
    done: number;
  };
  topCategories: { category: string; cnt: number }[];
  repeatCustomers: { name: string; cnt: number }[];
};

const STATUS_ROWS: { key: keyof DailyReportData["today"]; label: string; bar: string }[] = [
  { key: "new",       label: "새 문의",    bar: "new" },
  { key: "drafted",   label: "초안 완료",  bar: "drafted" },
  { key: "pending",   label: "보류",       bar: "pending" },
  { key: "escalated", label: "상위 확인",  bar: "escalated" },
  { key: "done",      label: "처리 완료",  bar: "done" },
];

export function DailyReport() {
  const [report, setReport] = useState<DailyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch(`/api/report/daily?tz=${encodeURIComponent(tz)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.report) setReport(data.report);
        else setError("리포트를 불러올 수 없습니다.");
      })
      .catch(() => setError("리포트 로딩 중 오류가 발생했습니다."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="report-loading">리포트 집계 중…</div>;
  if (error || !report) return <div className="report-error">{error || "리포트 없음"}</div>;

  const doneRate = report.today.total > 0 ? Math.round((report.today.done / report.today.total) * 100) : 0;
  const maxCat = report.topCategories[0]?.cnt ?? 1;

  return (
    <section className="daily-report">
      {/* 핵심 지표 4개 */}
      <div className="report-hero">
        <div className="report-hero-stat">
          <div className="stat-label">오늘 접수</div>
          <div className="stat-value">{report.today.total}<span className="stat-unit">건</span></div>
        </div>
        <div className="report-hero-stat done">
          <div className="stat-label">처리 완료</div>
          <div className="stat-value" style={{color:'#1d8f4e'}}>{report.today.done}<span className="stat-unit">건</span></div>
        </div>
        <div className="report-hero-stat warn">
          <div className="stat-label">미처리</div>
          <div className="stat-value" style={{color:'#b87d14'}}>{report.today.open}<span className="stat-unit">건</span></div>
        </div>
        <div className="report-hero-stat urgent">
          <div className="stat-label">긴급</div>
          <div className="stat-value" style={{color:'#c03a3a'}}>{report.today.urgent}<span className="stat-unit">건</span></div>
        </div>
      </div>

      {/* 처리율 바 */}
      <section className="report-rate-card">
        <div className="report-rate-header">
          <strong>오늘 처리율</strong>
          <span className="report-rate-pct">{doneRate}%</span>
        </div>
        <div className="report-bar-track">
          <div className="report-bar-fill" style={{ width: `${doneRate}%` }} />
        </div>
        <div className="report-rate-sub">
          <span>완료 <strong style={{color:'#1d8f4e'}}>{report.today.done}건</strong></span>
          <span>미처리 <strong style={{color:'#b87d14'}}>{report.today.open}건</strong></span>
          {report.today.urgent > 0 && <span>긴급 <strong style={{color:'#c03a3a'}}>{report.today.urgent}건</strong></span>}
        </div>
      </section>

      {/* 하단 카드 그리드 */}
      <div className="report-grid">
        {/* 상태별 */}
        <div className="report-card">
          <strong className="report-card-title">오늘 상태별</strong>
          {report.today.total === 0 ? (
            <p className="report-empty">오늘 접수된 문의가 없습니다.</p>
          ) : (
            <div className="report-breakdown-list">
              {STATUS_ROWS.filter((r) => (report.today[r.key] as number) > 0).map((r) => {
                const count = report.today[r.key] as number;
                const pct = Math.round((count / report.today.total) * 100);
                return (
                  <div key={r.key}>
                    <div className="breakdown-meta">
                      <span>{r.label}</span>
                      <strong>{count}</strong>
                    </div>
                    <div className="breakdown-bar-track">
                      <div className={`row-bar ${r.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 유형별 */}
        <div className="report-card">
          <strong className="report-card-title">오늘 유형별</strong>
          {report.topCategories.length === 0 ? (
            <p className="report-empty">오늘 문의 데이터가 없습니다.</p>
          ) : (
            <div className="report-breakdown-list">
              {report.topCategories.map((item) => (
                <div key={item.category}>
                  <div className="breakdown-meta">
                    <span>{categoryLabels[item.category as Category] ?? item.category}</span>
                    <strong>{item.cnt}</strong>
                  </div>
                  <div className="breakdown-bar-track">
                    <div className="row-bar done" style={{ width: `${Math.round((item.cnt / maxCat) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 재문의 */}
        <div className="report-card">
          <strong className="report-card-title">오늘 재문의</strong>
          {report.repeatCustomers.length === 0 ? (
            <p className="report-empty">오늘 재문의 고객이 없습니다.</p>
          ) : (
            <div className="report-customer-list">
              {report.repeatCustomers.map((c) => (
                <div key={c.name} className="report-customer-row">
                  <div className="report-customer-avatar">{c.name.slice(0, 1)}</div>
                  <div>
                    <strong style={{fontSize:'12.5px',fontWeight:700}}>{c.name}</strong>
                    <div style={{fontSize:'11px',color:'#9aa19d'}}>오늘 {c.cnt}건</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 전체 누적 */}
        <div className="report-card">
          <strong className="report-card-title">전체 누적</strong>
          <div className="report-total-list">
            <div className="report-total-row">
              <span>미처리</span>
              <strong style={{color:'#b87d14'}}>{report.all.open}건</strong>
            </div>
            <div className="report-total-row">
              <span>완료</span>
              <strong style={{color:'#1d8f4e'}}>{report.all.done}건</strong>
            </div>
            <div className="report-total-row divider">
              <span>누적</span>
              <strong>{report.all.open + report.all.done}건</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 미처리 액션 힌트 */}
      {report.today.open > 0 && (
        <section className="report-action-hint">
          <span className="report-action-hint-icon">!</span>
          <div>
            <strong>미처리 {report.today.open}건이 남아 있습니다</strong>
            <p>문의 탭에서 미처리 필터로 바로 확인하세요.</p>
          </div>
        </section>
      )}
    </section>
  );
}
