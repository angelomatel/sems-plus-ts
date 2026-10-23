import { fromEpochMs, isRecord, toInteger, toText } from '../core/json.js';
import type { Alarm, AlarmCounts } from '../types/domain.js';
import type { RawAlarm, RawAlarmCounts } from '../types/raw.js';

export function toAlarmCounts(data: unknown): AlarmCounts {
  const raw: RawAlarmCounts = isRecord(data) ? data : {};
  return {
    total: toInteger(raw.total) ?? 0,
    active: toInteger(raw.happened) ?? 0,
    recovered: toInteger(raw.recovery) ?? 0,
  };
}

export function toAlarm(raw: RawAlarm): Alarm | null {
  const id = toText(raw.warningid);
  if (id === null) return null;
  const code = toText(raw.warning_code);
  return {
    id,
    code,
    name: toText(raw.warningNameEn) ?? code ?? 'Unknown alarm',
    level: toText(raw.alarmLevel),
    active: toInteger(raw.status) === 0,
    deviceSn: toText(raw.devicesn),
    deviceName: toText(raw.deviceName),
    happenedAt: fromEpochMs(raw.happentime),
    recoveredAt: fromEpochMs(raw.recoverytime),
  };
}
