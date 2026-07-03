import type { ChangeEvent } from "react";
import type { Inquiry, Settings, Knowledge } from "@/types";
import { createInquiry } from "@/lib/inquiry";

export function parseTagDraft(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ).slice(0, 8);
}

export function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function normalizeCustomerValue(value: string) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "날짜 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function exportCsv(inquiries: Inquiry[]) {
  const header = ["customer", "channel", "category", "priority", "status", "message", "reply"];
  const rows = inquiries.map((inquiry) =>
    header.map((key) => csvCell(String(inquiry[key as keyof Inquiry] ?? ""))).join(","),
  );
  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `inkdesk-inquiries-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function importCsv(
  event: ChangeEvent<HTMLInputElement>,
  settings: Settings,
  knowledge: Knowledge,
  onImport: (inquiries: Inquiry[]) => void,
) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const lines = String(reader.result)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const imported = lines
      .slice(lines[0]?.toLowerCase().includes("customer") ? 1 : 0)
      .map((line) => line.split(",").map((part) => part.replace(/^"|"$/g, "").replace(/""/g, '"')))
      .map((parts) =>
        createInquiry(
          `${parts[0] || "이름 미상"} | ${parts[1] || "CSV"} | ${parts[5] || parts[2] || parts.join(" ")}`,
          settings,
          knowledge,
        ),
      );
    onImport(imported);
  };
  reader.readAsText(file, "utf-8");
  event.target.value = "";
}

function csvCell(value: string) {
  return `"${String(value).replace(/"/g, '""')}"`;
}
