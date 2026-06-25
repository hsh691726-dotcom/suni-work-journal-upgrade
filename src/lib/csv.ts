import type { WorkEntry } from "../types";
import { dateKey } from "./date";

const HEADERS = ["업무일자", "시간", "업무명", "업무유형", "진행상태", "중요도", "금액", "거래처", "매월반복", "반복일", "알림방식", "메모"];

export function downloadCsv(entries: WorkEntry[]) {
  const rows = entries.map((entry) => [
    entry.workDate,
    entry.workTime,
    entry.title,
    entry.category,
    entry.status,
    entry.priority,
    String(entry.amount || ""),
    entry.vendor,
    entry.repeatMonthly,
    String(entry.repeatDay || ""),
    entry.alarmMode,
    entry.memo,
  ]);
  const csv = [HEADERS, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `work-journal-${dateKey(new Date())}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
