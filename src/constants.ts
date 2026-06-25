import type { AlarmMode, EntryDraft, EntryKind, Priority, RepeatMonthly, TaskStatus, WorkEntry } from "./types";
import { dateKey, parseDateKey } from "./lib/date";

export const APP_TITLE = "경영지원팀 업무일지";
export const STORAGE_KEY = "suni-work-journal-upgrade";

export const CATEGORIES = ["회계", "총무", "세무", "인사", "계약", "결제", "입출금", "증빙", "보고", "기타"];
export const STATUSES: TaskStatus[] = ["예정", "진행중", "완료", "보류"];
export const PRIORITIES: Priority[] = ["높음", "보통", "낮음"];
export const REPEAT_FLAGS: RepeatMonthly[] = ["아니오", "예"];
export const ALARM_MODES: AlarmMode[] = ["없음", "소리", "진동"];
export const ENTRY_KINDS: EntryKind[] = ["업무", "개인"];

export const STATUS_COLORS: Record<TaskStatus, string> = {
  예정: "border-blue-500 bg-blue-50 text-blue-700",
  진행중: "border-amber-500 bg-amber-50 text-amber-700",
  완료: "border-emerald-500 bg-emerald-50 text-emerald-700",
  보류: "border-slate-400 bg-slate-50 text-slate-700",
};

export const KIND_COLORS: Record<EntryKind, string> = {
  업무: "border-blue-500 bg-blue-50 text-blue-700",
  개인: "border-rose-500 bg-rose-50 text-rose-700",
};

export function todayKey() {
  return dateKey(new Date());
}

export function makeEmptyDraft(date = todayKey()): EntryDraft {
  return {
    workDate: date,
    workTime: "",
    kind: "업무",
    title: "",
    category: "회계",
    status: "예정",
    priority: "보통",
    amount: 0,
    vendor: "",
    repeatMonthly: "아니오",
    repeatDay: null,
    alarmMode: "없음",
    memo: "",
  };
}

export function sampleEntries(): WorkEntry[] {
  const now = new Date().toISOString();
  const today = todayKey();
  const current = parseDateKey(today);
  const day10 = dateKey(new Date(current.getFullYear(), current.getMonth(), 10));
  const day25 = dateKey(new Date(current.getFullYear(), current.getMonth(), 25));
  return [
    {
      id: crypto.randomUUID(),
      workDate: today,
      workTime: "09:30",
      kind: "업무",
      title: "오늘 결제 요청 검토",
      category: "결제",
      status: "예정",
      priority: "높음",
      amount: 0,
      vendor: "",
      repeatMonthly: "아니오",
      repeatDay: null,
      alarmMode: "소리",
      memo: "증빙 누락 여부와 승인자를 같이 확인합니다.",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      workDate: day10,
      workTime: "10:00",
      kind: "업무",
      title: "원천세 신고/납부 확인",
      category: "세무",
      status: "예정",
      priority: "높음",
      amount: 0,
      vendor: "홈택스",
      repeatMonthly: "예",
      repeatDay: 10,
      alarmMode: "소리",
      memo: "매월 10일 반복 업무입니다.",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      workDate: day25,
      workTime: "16:00",
      kind: "업무",
      title: "월마감 자료 정리",
      category: "회계",
      status: "진행중",
      priority: "보통",
      amount: 0,
      vendor: "",
      repeatMonthly: "예",
      repeatDay: 25,
      alarmMode: "진동",
      memo: "거래처별 미수/미지급 내역을 확인합니다.",
      createdAt: now,
      updatedAt: now,
    },
  ];
}
