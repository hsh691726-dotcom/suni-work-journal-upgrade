export type TaskStatus = "예정" | "진행중" | "완료" | "보류";
export type Priority = "높음" | "보통" | "낮음";
export type RepeatMonthly = "아니오" | "예";
export type AlarmMode = "없음" | "소리" | "진동";
export type EntryKind = "업무" | "개인";

export type WorkEntry = {
  id: string;
  workDate: string;
  workTime: string;
  kind: EntryKind;
  title: string;
  category: string;
  status: TaskStatus;
  priority: Priority;
  amount: number;
  vendor: string;
  repeatMonthly: RepeatMonthly;
  repeatDay: number | null;
  alarmMode: AlarmMode;
  memo: string;
  createdAt: string;
  updatedAt: string;
};

export type EntryDraft = Omit<WorkEntry, "id" | "createdAt" | "updatedAt">;

export type StorageMode = "local" | "supabase";
