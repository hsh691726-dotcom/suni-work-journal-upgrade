import type { WorkEntry } from "../types";

const HEADERS = ["업무일자", "업무명", "업무유형", "진행상태", "중요도", "금액", "거래처", "매월반복", "반복일", "메모"];

export function downloadCsv(entries: WorkEntry[]) {
  const rows = entries.map((entry) => [
    entry.workDate,
    entry.title,
    entry.category,
    entry.status,
    entry.priority,
    String(entry.amount || ""),
    entry.vendor,
    entry.repeatMonthly,
    String(entry.repeatDay || ""),
    entry.memo,
  ]);
  const csv = [HEADERS, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `work-journal-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
