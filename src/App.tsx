import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  Bell,
  CalendarDays,
  Clock,
  Download,
  Edit3,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  ALARM_MODES,
  APP_TITLE,
  CATEGORIES,
  PRIORITIES,
  REPEAT_FLAGS,
  sampleEntries,
  STATUSES,
  STATUS_COLORS,
  STORAGE_KEY,
  makeEmptyDraft,
  todayKey,
} from "./constants";
import { dateKey, entriesForDate, formatKoreanDate, isThisWeek, materializeEntriesForMonth, monthMatrix, parseDateKey } from "./lib/date";
import { downloadCsv } from "./lib/csv";
import { fromDb, isSupabaseConfigured, supabase, toDb } from "./lib/supabase";
import type { EntryDraft, WorkEntry } from "./types";

type NotificationPermissionState = "default" | "granted" | "denied" | "unsupported";

function makeEntry(draft: EntryDraft): WorkEntry {
  const now = new Date().toISOString();
  return {
    ...draft,
    id: crypto.randomUUID(),
    repeatDay: draft.repeatMonthly === "예" ? parseDateKey(draft.workDate).getDate() : null,
    createdAt: now,
    updatedAt: now,
  };
}

function emptyDraftFor(date: string): EntryDraft {
  return makeEmptyDraft(date);
}

function normalizeEntry(entry: WorkEntry): WorkEntry {
  return {
    ...entry,
    workTime: entry.workTime ?? "",
    alarmMode: entry.alarmMode ?? "없음",
  };
}

function entryDateTime(entry: WorkEntry) {
  if (!entry.workTime) return null;
  const [hour, minute] = entry.workTime.split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  const date = parseDateKey(entry.workDate);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute);
}

function alarmKey(entry: WorkEntry) {
  return `${entry.id}-${entry.workDate}-${entry.workTime}`;
}

function isValidWorkTime(value: string) {
  return !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function playAlarmSound() {
  if (!window.AudioContext) return;
  const context = new window.AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 880;
  gain.gain.setValueAtTime(0.001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.8);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.85);
}

export default function App() {
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [anchor, setAnchor] = useState(() => parseDateKey(todayKey()));
  const [draft, setDraft] = useState<EntryDraft>(() => emptyDraftFor(todayKey()));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("전체");
  const [categoryFilter, setCategoryFilter] = useState("전체");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermissionState>(() => {
    if (!("Notification" in window)) return "unsupported";
    return Notification.permission;
  });
  const [firedAlarmKeys, setFiredAlarmKeys] = useState<Set<string>>(() => new Set());

  const storageMode = isSupabaseConfigured ? "Supabase" : "이 브라우저";

  async function loadEntries() {
    setLoading(true);
    if (supabase) {
      const { data, error } = await supabase.from("work_entries").select("*").order("work_date", { ascending: true });
      if (error) {
        setNotice(`Supabase 불러오기 실패: ${error.message}`);
      } else {
        setEntries((data ?? []).map(fromDb).map(normalizeEntry));
        setNotice("Supabase에서 업무일지를 불러왔습니다.");
      }
    } else {
      const raw = localStorage.getItem(STORAGE_KEY);
      setEntries(raw ? JSON.parse(raw).map(normalizeEntry) : []);
      setNotice("Supabase 연결 전이라 이 브라우저에 임시 저장합니다.");
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadEntries();
  }, []);

  useEffect(() => {
    if (!supabase && !loading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    }
  }, [entries, loading]);

  useEffect(() => {
    if (!editingId) {
      setDraft(emptyDraftFor(selectedDate));
    }
  }, [selectedDate, editingId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date();
      const nextFired = new Set(firedAlarmKeys);
      let changed = false;

      materializeEntriesForMonth(entries, now).forEach((entry) => {
        if (entry.status === "완료" || entry.alarmMode === "없음" || !entry.workTime) return;
        const scheduledAt = entryDateTime(entry);
        if (!scheduledAt) return;
        const reminderAt = new Date(scheduledAt.getTime() - 60 * 60 * 1000);
        const key = alarmKey(entry);
        if (now < reminderAt || now > scheduledAt || nextFired.has(key)) return;

        if (entry.alarmMode === "소리") {
          playAlarmSound();
        }
        if (entry.alarmMode === "진동" && "vibrate" in navigator) {
          navigator.vibrate([350, 150, 350]);
        }
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("경영지원팀 업무일지 알림", {
            body: `${entry.workTime} ${entry.title} - 1시간 전입니다.`,
          });
        }
        nextFired.add(key);
        changed = true;
      });

      if (changed) {
        setFiredAlarmKeys(nextFired);
      }
    }, 30000);

    return () => window.clearInterval(timer);
  }, [entries, firedAlarmKeys]);

  const monthEntries = useMemo(() => materializeEntriesForMonth(entries, anchor), [entries, anchor]);
  const selectedEntries = useMemo(() => entriesForDate(entries, selectedDate), [entries, selectedDate]);

  const filteredEntries = useMemo(() => {
    const text = query.trim().toLowerCase();
    return entries
      .filter((entry) => {
        const matchesText =
          !text ||
          [entry.title, entry.category, entry.vendor, entry.memo, entry.status, entry.priority, entry.workTime, entry.alarmMode].join(" ").toLowerCase().includes(text);
        const matchesStatus = statusFilter === "전체" || entry.status === statusFilter;
        const matchesCategory = categoryFilter === "전체" || entry.category === categoryFilter;
        return matchesText && matchesStatus && matchesCategory;
      })
      .sort((a, b) => a.workDate.localeCompare(b.workDate) || a.workTime.localeCompare(b.workTime) || a.title.localeCompare(b.title, "ko"));
  }, [entries, query, statusFilter, categoryFilter]);

  const dashboard = useMemo(() => {
    const today = todayKey();
    const currentMonth = today.slice(0, 7);
    return {
      today: entriesForDate(entries, today).filter((entry) => entry.status !== "완료").length,
      week: entries.filter((entry) => isThisWeek(entry.workDate) && entry.status !== "완료").length,
      month: entries.filter((entry) => entry.workDate.startsWith(currentMonth) && entry.status !== "완료").length,
      overdue: entries.filter((entry) => entry.workDate < today && entry.status !== "완료").length,
      done: entries.filter((entry) => entry.workDate.startsWith(currentMonth) && entry.status === "완료").length,
    };
  }, [entries]);

  const focusEntries = useMemo(() => {
    const today = todayKey();
    return materializeEntriesForMonth(entries, parseDateKey(today))
      .filter((entry) => entry.status !== "완료" && (entry.workDate <= today || isThisWeek(entry.workDate)))
      .sort((a, b) => a.workDate.localeCompare(b.workDate) || a.workTime.localeCompare(b.workTime) || a.title.localeCompare(b.title, "ko"))
      .slice(0, 8);
  }, [entries]);

  async function persistAdd(entry: WorkEntry) {
    if (supabase) {
      const { data, error } = await supabase.from("work_entries").insert(toDb(entry)).select("*").single();
      if (error) throw error;
      setEntries((current) => [...current, normalizeEntry(fromDb(data))]);
    } else {
      setEntries((current) => [...current, entry]);
    }
  }

  async function persistUpdate(id: string, nextDraft: EntryDraft) {
    const nextValues = {
      ...nextDraft,
      repeatDay: nextDraft.repeatMonthly === "예" ? parseDateKey(nextDraft.workDate).getDate() : null,
      updatedAt: new Date().toISOString(),
    };
    if (supabase) {
      const { data, error } = await supabase.from("work_entries").update(toDb(nextValues)).eq("id", id).select("*").single();
      if (error) throw error;
      setEntries((current) => current.map((entry) => (entry.id === id ? normalizeEntry(fromDb(data)) : entry)));
    } else {
      setEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, ...nextValues } : entry)));
    }
  }

  async function persistDelete(id: string) {
    if (supabase) {
      const { error } = await supabase.from("work_entries").delete().eq("id", id);
      if (error) throw error;
    }
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }

  async function handleSubmit() {
    if (!draft.title.trim()) {
      setNotice("업무명을 먼저 입력해 주세요.");
      return;
    }
    if (!isValidWorkTime(draft.workTime)) {
      setNotice("시간은 09:30처럼 24시간 형식으로 입력해 주세요.");
      return;
    }
    if (draft.alarmMode !== "없음" && !draft.workTime) {
      setNotice("알림을 사용하려면 시간을 먼저 입력해 주세요.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await persistUpdate(editingId, draft);
        setNotice("업무를 수정하고 저장했습니다.");
      } else {
        await persistAdd(makeEntry(draft));
        setNotice("업무를 추가하고 저장했습니다.");
      }
      setEditingId(null);
      setDraft(emptyDraftFor(selectedDate));
    } catch (error) {
      setNotice(error instanceof Error ? `저장 실패: ${error.message}` : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(entry: WorkEntry) {
    const realId = entry.id.split("::")[0];
    const source = entries.find((item) => item.id === realId) ?? entry;
    setEditingId(realId);
    setDraft({
      workDate: entry.workDate,
      workTime: source.workTime,
      title: source.title,
      category: source.category,
      status: source.status,
      priority: source.priority,
      amount: source.amount,
      vendor: source.vendor,
      repeatMonthly: source.repeatMonthly,
      repeatDay: source.repeatDay,
      alarmMode: source.alarmMode,
      memo: source.memo,
    });
  }

  function openEntryDate(entry: WorkEntry) {
    const target = parseDateKey(entry.workDate);
    setSelectedDate(entry.workDate);
    setAnchor(new Date(target.getFullYear(), target.getMonth(), 1));
  }

  async function updateStatus(entry: WorkEntry, status: WorkEntry["status"]) {
    const realId = entry.id.split("::")[0];
    const source = entries.find((item) => item.id === realId);
    if (!source) return;
    setSaving(true);
    try {
      await persistUpdate(realId, {
        workDate: source.workDate,
        workTime: source.workTime,
        title: source.title,
        category: source.category,
        status,
        priority: source.priority,
        amount: source.amount,
        vendor: source.vendor,
        repeatMonthly: source.repeatMonthly,
        repeatDay: source.repeatDay,
        alarmMode: source.alarmMode,
        memo: source.memo,
      });
      setNotice("상태를 변경하고 저장했습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? `상태 변경 실패: ${error.message}` : "상태 변경에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function useSamples() {
    const samples = sampleEntries();
    setSaving(true);
    try {
      if (supabase) {
        for (const sample of samples) {
          await persistAdd(sample);
        }
      } else {
        setEntries((current) => [...current, ...samples]);
      }
      setNotice("샘플 업무 3건을 넣고 저장했습니다. 실제 사용 전 자유롭게 수정하거나 삭제하세요.");
    } catch (error) {
      setNotice(error instanceof Error ? `샘플 저장 실패: ${error.message}` : "샘플 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(entry: WorkEntry) {
    const realId = entry.id.split("::")[0];
    if (pendingDeleteId !== realId) {
      setPendingDeleteId(realId);
      setNotice("삭제하려면 같은 업무의 '삭제 확인' 버튼을 한 번 더 눌러 주세요.");
      return;
    }
    setSaving(true);
    try {
      await persistDelete(realId);
      setPendingDeleteId(null);
      if (editingId === realId) {
        setEditingId(null);
        setDraft(emptyDraftFor(selectedDate));
      }
      setNotice("업무를 삭제하고 저장했습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? `삭제 실패: ${error.message}` : "삭제에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function requestNotificationPermission() {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      setNotice("이 브라우저는 알림 기능을 지원하지 않습니다.");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    setNotice(
      permission === "granted"
        ? "알림 권한이 켜졌습니다. 앱을 열어두면 입력 시간 1시간 전에 알림을 받을 수 있습니다."
        : "알림 권한이 꺼져 있습니다. 브라우저 설정에서 다시 켤 수 있습니다.",
    );
  }

  const days = monthMatrix(anchor);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-700">Vercel + Supabase 업그레이드</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">{APP_TITLE}</h1>
            <p className="mt-2 text-sm text-slate-600">달력에서 날짜를 누르고, 총무회계 업무를 바로 기록하세요.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={useSamples}>
              <Sparkles size={17} /> 샘플 넣기
            </button>
            <button className="btn-secondary" onClick={() => void loadEntries()}>
              <RefreshCw size={17} /> 다시 불러오기
            </button>
            <button className="btn-primary" onClick={() => downloadCsv(entries)}>
              <Download size={17} /> CSV 다운로드
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-5 md:grid-cols-4">
        <Metric label="오늘 할 일" value={`${dashboard.today}건`} />
        <Metric label="이번주 할 일" value={`${dashboard.week}건`} />
        <Metric label="이달 할 일" value={`${dashboard.month}건`} />
        <Metric label="지연 업무" value={`${dashboard.overdue}건`} tone={dashboard.overdue ? "danger" : "default"} />
      </section>

      <section className="mx-auto max-w-7xl px-4">
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          저장 위치: <strong>{storageMode}</strong>. {saving ? "저장 중입니다..." : "저장 후 새로고침해도 데이터가 유지됩니다."}
          {notice && <span className="ml-2 text-blue-700">{notice}</span>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <Bell size={17} className="text-blue-700" />
          <span>시간이 있는 업무는 입력 시간 1시간 전에 알림을 확인합니다.</span>
          {notificationPermission !== "granted" && notificationPermission !== "unsupported" && (
            <button className="btn-secondary py-1.5" onClick={() => void requestNotificationPermission()}>
              알림 권한 켜기
            </button>
          )}
          {notificationPermission === "granted" && <span className="font-semibold text-emerald-700">알림 권한 켜짐</span>}
          {notificationPermission === "unsupported" && <span className="font-semibold text-slate-500">이 브라우저는 알림 미지원</span>}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-5">
        <div className="panel">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">오늘 챙길 업무</h2>
              <p className="text-sm text-slate-500">지연 업무와 이번 주 미완료 업무를 먼저 보여줍니다.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">{focusEntries.length}건</span>
          </div>
          {focusEntries.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">급하게 챙길 업무가 없습니다.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {focusEntries.map((entry) => (
                <button key={entry.id} className="quick-entry" onClick={() => openEntryDate(entry)}>
                  <span className="font-semibold">{entry.workDate}</span>
                  <span className="truncate">{entry.workTime ? `${entry.workTime} · ${entry.title}` : entry.title}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_COLORS[entry.status]}`}>{entry.status}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="panel">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="text-blue-700" />
              <h2 className="text-xl font-bold">{anchor.getFullYear()}년 {anchor.getMonth() + 1}월</h2>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}>이전 달</button>
              <button className="btn-secondary" onClick={() => { const today = parseDateKey(todayKey()); setAnchor(today); setSelectedDate(todayKey()); }}>오늘</button>
              <button className="btn-secondary" onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}>다음 달</button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500">
            {["월", "화", "수", "목", "금", "토", "일"].map((day) => <div key={day}>{day}</div>)}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {days.map((day) => {
              const key = dateKey(day);
              const inMonth = day.getMonth() === anchor.getMonth();
              const dayEntries = monthEntries.filter((entry) => entry.workDate === key);
              const selected = key === selectedDate;
              return (
                <button
                  key={key}
                  className={`calendar-cell ${selected ? "ring-2 ring-blue-600" : ""} ${inMonth ? "bg-white" : "bg-slate-50 text-slate-400"}`}
                  onClick={() => setSelectedDate(key)}
                >
                  <span className="font-semibold">{day.getDate()}</span>
                  <span className="text-xs text-slate-500">{dayEntries.length ? `${dayEntries.length}건` : ""}</span>
                  <span className="mt-2 space-y-1">
                    {dayEntries.slice(0, 3).map((entry) => (
                      <span key={entry.id} className={`block truncate rounded border-l-4 px-1.5 py-1 text-left text-[11px] ${STATUS_COLORS[entry.status]}`}>
                        {entry.workTime ? `${entry.workTime} ${entry.title}` : entry.title}
                      </span>
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-5">
          <div className="panel">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{formatKoreanDate(selectedDate)}</h2>
                <p className="text-sm text-slate-500">선택한 날짜의 업무를 바로 입력합니다.</p>
              </div>
              {editingId && (
                <button className="btn-secondary" onClick={() => { setEditingId(null); setDraft(emptyDraftFor(selectedDate)); }}>
                  취소
                </button>
              )}
            </div>
            <EntryForm draft={draft} setDraft={setDraft} onSubmit={handleSubmit} editing={Boolean(editingId)} saving={saving} />
          </div>

          <div className="panel">
            <h2 className="mb-3 text-lg font-bold">선택 날짜 업무</h2>
            <div className="space-y-3">
              {selectedEntries.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">이 날짜에는 아직 업무가 없습니다.</p>}
              {selectedEntries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  onEdit={() => startEdit(entry)}
                  onDelete={() => void confirmDelete(entry)}
                  deleting={pendingDeleteId === entry.id.split("::")[0]}
                  onStatus={(status) => void updateStatus(entry, status)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-10">
        <div className="panel">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold">전체 업무 목록</h2>
              <p className="text-sm text-slate-500">검색, 상태, 업무유형으로 필요한 기록을 빠르게 찾습니다.</p>
            </div>
            <div className="flex flex-col gap-2 md:flex-row">
              <label className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={17} />
                <input className="input w-full pl-9 md:w-64" placeholder="업무명, 거래처, 메모 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
              </label>
              <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                {["전체", ...STATUSES].map((status) => <option key={status}>{status}</option>)}
              </select>
              <select className="input" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                {["전체", ...CATEGORIES].map((category) => <option key={category}>{category}</option>)}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-slate-600">
                <tr>
                  {["날짜", "시간", "업무명", "유형", "상태", "중요도", "금액", "거래처", "반복", "알림", "메모", "작업"].map((header) => (
                    <th key={header} className="px-3 py-2 font-semibold">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{entry.workDate}</td>
                    <td className="px-3 py-2">{entry.workTime || "-"}</td>
                    <td className="px-3 py-2 font-medium">{entry.title}</td>
                    <td className="px-3 py-2">{entry.category}</td>
                    <td className="px-3 py-2">{entry.status}</td>
                    <td className="px-3 py-2">{entry.priority}</td>
                    <td className="px-3 py-2">{entry.amount ? `${entry.amount.toLocaleString()}원` : "-"}</td>
                    <td className="px-3 py-2">{entry.vendor || "-"}</td>
                    <td className="px-3 py-2">{entry.repeatMonthly}</td>
                    <td className="px-3 py-2">{entry.alarmMode}</td>
                    <td className="max-w-xs truncate px-3 py-2">{entry.memo || "-"}</td>
                    <td className="px-3 py-2">
                      <div className="flex min-w-52 flex-wrap gap-1.5">
                        <button className="btn-mini" onClick={() => openEntryDate(entry)}>열기</button>
                        <button className="btn-mini" onClick={() => { openEntryDate(entry); startEdit(entry); }}>수정</button>
                        {entry.status !== "완료" && (
                          <button className="btn-mini" onClick={() => void updateStatus(entry, "완료")}>완료</button>
                        )}
                        <button className="btn-mini-danger" onClick={() => void confirmDelete(entry)}>
                          {pendingDeleteId === entry.id.split("::")[0] ? "삭제 확인" : "삭제"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredEntries.length && <p className="p-6 text-center text-sm text-slate-500">조건에 맞는 업무가 없습니다.</p>}
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "danger" }) {
  return (
    <div className={`rounded-lg border p-4 shadow-soft ${tone === "danger" ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
      <p className={`text-sm ${tone === "danger" ? "text-red-700" : "text-slate-500"}`}>{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function EntryForm({
  draft,
  setDraft,
  onSubmit,
  editing,
  saving,
}: {
  draft: EntryDraft;
  setDraft: Dispatch<SetStateAction<EntryDraft>>;
  onSubmit: () => void;
  editing: boolean;
  saving: boolean;
}) {
  const timeInputRef = useRef<HTMLInputElement | null>(null);
  const update = <K extends keyof EntryDraft>(key: K, value: EntryDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const openTimePicker = () => {
    const input = timeInputRef.current;
    if (!input) return;
    input.focus();
    const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
    if (pickerInput.showPicker) {
      pickerInput.showPicker();
    } else {
      input.click();
    }
  };

  return (
    <div className="space-y-3">
      <label className="field">
        <span>업무명</span>
        <input className="input" value={draft.title} onChange={(event) => update("title", event.target.value)} placeholder="예: 세금계산서 발행 확인" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          <span>업무일자</span>
          <input className="input" type="date" value={draft.workDate} onChange={(event) => update("workDate", event.target.value)} />
        </label>
        <label className="field">
          <span>시간</span>
          <span className="relative">
            <input
              ref={timeInputRef}
              className="input pr-11"
              type="time"
              value={draft.workTime}
              onChange={(event) => update("workTime", event.target.value)}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-blue-700"
              onClick={openTimePicker}
              aria-label="시간 선택"
              title="시간 선택"
            >
              <Clock size={18} />
            </button>
          </span>
        </label>
        <label className="field">
          <span>업무유형</span>
          <select className="input" value={draft.category} onChange={(event) => update("category", event.target.value)}>
            {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
          </select>
        </label>
        <label className="field">
          <span>진행상태</span>
          <select className="input" value={draft.status} onChange={(event) => update("status", event.target.value as EntryDraft["status"])}>
            {STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
        <label className="field">
          <span>중요도</span>
          <select className="input" value={draft.priority} onChange={(event) => update("priority", event.target.value as EntryDraft["priority"])}>
            {PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
          </select>
        </label>
        <label className="field">
          <span>금액</span>
          <input className="input" type="number" min="0" value={draft.amount} onChange={(event) => update("amount", Number(event.target.value || 0))} />
        </label>
        <label className="field">
          <span>매월 같은 날짜 반복</span>
          <select className="input" value={draft.repeatMonthly} onChange={(event) => update("repeatMonthly", event.target.value as EntryDraft["repeatMonthly"])}>
            {REPEAT_FLAGS.map((flag) => <option key={flag}>{flag}</option>)}
          </select>
        </label>
        <label className="field">
          <span>알림 방식</span>
          <select className="input" value={draft.alarmMode} onChange={(event) => update("alarmMode", event.target.value as EntryDraft["alarmMode"])}>
            {ALARM_MODES.map((mode) => <option key={mode}>{mode}</option>)}
          </select>
        </label>
      </div>
      <label className="field">
        <span>거래처/관련처</span>
        <input className="input" value={draft.vendor} onChange={(event) => update("vendor", event.target.value)} placeholder="예: 홈택스, 거래처명" />
      </label>
      <label className="field">
        <span>메모</span>
        <textarea className="input min-h-24" value={draft.memo} onChange={(event) => update("memo", event.target.value)} placeholder="증빙, 결제 방법, 확인할 내용을 적어주세요." />
      </label>
      <button className="btn-primary w-full justify-center disabled:cursor-not-allowed disabled:bg-slate-400" onClick={onSubmit} disabled={saving}>
        {editing ? <Save size={18} /> : <Plus size={18} />}
        {saving ? "저장 중..." : editing ? "수정 저장" : "이 날짜에 업무 추가"}
      </button>
    </div>
  );
}

function EntryCard({
  entry,
  onEdit,
  onDelete,
  onStatus,
  deleting,
}: {
  entry: WorkEntry;
  onEdit: () => void;
  onDelete: () => void;
  onStatus: (status: WorkEntry["status"]) => void;
  deleting: boolean;
}) {
  const generated = entry.id.includes("::");
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold">{entry.workTime ? `${entry.workTime} · ${entry.title}` : entry.title}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {entry.category} · {entry.priority} · {entry.repeatMonthly === "예" ? "매월 반복" : "일회성"}
          </p>
        </div>
        <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${STATUS_COLORS[entry.status]}`}>{entry.status}</span>
      </div>
      {(entry.vendor || entry.memo || entry.amount > 0 || (entry.workTime && entry.alarmMode !== "없음")) && (
        <div className="mt-3 space-y-1 text-sm text-slate-600">
          {entry.amount > 0 && <p>금액: {entry.amount.toLocaleString()}원</p>}
          {entry.workTime && entry.alarmMode !== "없음" && <p>알림: {entry.workTime} 기준 1시간 전 · {entry.alarmMode}</p>}
          {entry.vendor && <p>거래처/관련처: {entry.vendor}</p>}
          {entry.memo && <p>{entry.memo}</p>}
          {generated && <p className="text-blue-700">반복 업무가 이 달력 날짜에 자동 표시되었습니다.</p>}
        </div>
      )}
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <select className="input" value={entry.status} onChange={(event) => onStatus(event.target.value as WorkEntry["status"])}>
          {STATUSES.map((status) => <option key={status}>{status}</option>)}
        </select>
        <button className="btn-secondary justify-center" onClick={onEdit}>
          <Edit3 size={16} /> 수정
        </button>
        <button className="btn-danger justify-center" onClick={onDelete}>
          <Trash2 size={16} /> {deleting ? "삭제 확인" : "삭제"}
        </button>
      </div>
    </article>
  );
}
