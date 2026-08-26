const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export function mondaySerial(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError('需要有效日期');
  }
  const localDaySerial = Math.floor(Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ) / DAY_IN_MILLISECONDS);
  const daysSinceMonday = (date.getDay() + 6) % 7;
  return localDaySerial - daysSinceMonday;
}

export function createSchoolWeekSetting(week, date = new Date()) {
  const normalizedWeek = Number.parseInt(week, 10);
  if (!Number.isInteger(normalizedWeek) || normalizedWeek < 1) {
    throw new RangeError('周次必须是大于0的整数');
  }
  return {
    version: 1,
    week: normalizedWeek,
    anchorMonday: mondaySerial(date),
  };
}

export function calculateSchoolWeek(setting, date = new Date()) {
  if (!setting || !Number.isInteger(setting.week) || setting.week < 1
    || !Number.isInteger(setting.anchorMonday)) return null;
  const elapsedWeeks = Math.floor((mondaySerial(date) - setting.anchorMonday) / 7);
  return Math.max(1, setting.week + elapsedWeeks);
}
