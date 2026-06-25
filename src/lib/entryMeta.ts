import type { AlarmMode } from "../types";

const META_PREFIX = "\n\n<!--work-journal-meta:";
const META_SUFFIX = "-->";

type EntryMeta = {
  workTime: string;
  alarmMode: AlarmMode;
};

const defaultMeta: EntryMeta = {
  workTime: "",
  alarmMode: "없음",
};

export function encodeMemoWithMeta(memo: string, meta: EntryMeta) {
  const cleanMemo = decodeMemoWithMeta(memo).memo;
  const payload = JSON.stringify({
    workTime: meta.workTime,
    alarmMode: meta.alarmMode,
  });
  return `${cleanMemo}${META_PREFIX}${payload}${META_SUFFIX}`;
}

export function decodeMemoWithMeta(value: string): { memo: string } & EntryMeta {
  const index = value.lastIndexOf(META_PREFIX);
  if (index === -1) {
    return { memo: value, ...defaultMeta };
  }

  const metaStart = index + META_PREFIX.length;
  const metaEnd = value.indexOf(META_SUFFIX, metaStart);
  if (metaEnd === -1) {
    return { memo: value, ...defaultMeta };
  }

  try {
    const parsed = JSON.parse(value.slice(metaStart, metaEnd)) as Partial<EntryMeta>;
    return {
      memo: value.slice(0, index).trimEnd(),
      workTime: typeof parsed.workTime === "string" ? parsed.workTime : "",
      alarmMode: parsed.alarmMode === "소리" || parsed.alarmMode === "진동" ? parsed.alarmMode : "없음",
    };
  } catch {
    return { memo: value.slice(0, index).trimEnd(), ...defaultMeta };
  }
}
