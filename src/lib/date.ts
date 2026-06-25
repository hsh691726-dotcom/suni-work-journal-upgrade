import type { WorkEntry } from "../types";

export function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatKoreanDate(key: string) {
  const date = parseDateKey(key);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export function monthMatrix(anchor: Date) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - startOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    return current;
  });
}

export function materializeEntriesForMonth(entries: WorkEntry[], anchor: Date): WorkEntry[] {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const rows: WorkEntry[] = [];

  for (const entry of entries) {
    const entryDate = parseDateKey(entry.workDate);
    if (entryDate.getFullYear() === year && entryDate.getMonth() === month) {
      rows.push(entry);
      continue;
    }
    if (entry.repeatMonthly === "예" && entry.repeatDay) {
      const day = Math.min(entry.repeatDay, lastDate);
      rows.push({
        ...entry,
        id: `${entry.id}::${year}-${month + 1}`,
        workDate: dateKey(new Date(year, month, day)),
      });
    }
  }
  return rows;
}

export function entriesForDate(entries: WorkEntry[], date: string) {
  const anchor = parseDateKey(date);
  return materializeEntriesForMonth(entries, anchor)
    .filter((entry) => entry.workDate === date)
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.title.localeCompare(b.title, "ko"));
}

export function priorityRank(priority: string) {
  return priority === "높음" ? 0 : priority === "보통" ? 1 : 2;
}

export function isThisWeek(key: string, today = new Date()) {
  const date = parseDateKey(key);
  const start = new Date(today);
  const offset = (today.getDay() + 6) % 7;
  start.setDate(today.getDate() - offset);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return date >= start && date <= end;
}
