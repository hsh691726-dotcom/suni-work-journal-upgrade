import { createClient } from "@supabase/supabase-js";
import type { EntryDraft, WorkEntry } from "../types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);
export const supabase = isSupabaseConfigured ? createClient(url!, anonKey!) : null;

export function toDb(entry: EntryDraft | WorkEntry) {
  return {
    work_date: entry.workDate,
    title: entry.title,
    category: entry.category,
    status: entry.status,
    priority: entry.priority,
    amount: entry.amount,
    vendor: entry.vendor,
    repeat_monthly: entry.repeatMonthly,
    repeat_day: entry.repeatDay,
    memo: entry.memo,
  };
}

export function fromDb(row: Record<string, unknown>): WorkEntry {
  return {
    id: String(row.id),
    workDate: String(row.work_date),
    title: String(row.title ?? ""),
    category: String(row.category ?? "기타"),
    status: String(row.status ?? "예정") as WorkEntry["status"],
    priority: String(row.priority ?? "보통") as WorkEntry["priority"],
    amount: Number(row.amount ?? 0),
    vendor: String(row.vendor ?? ""),
    repeatMonthly: String(row.repeat_monthly ?? "아니오") as WorkEntry["repeatMonthly"],
    repeatDay: row.repeat_day ? Number(row.repeat_day) : null,
    memo: String(row.memo ?? ""),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}
