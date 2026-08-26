import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateSchoolWeek,
  createSchoolWeekSetting,
  mondaySerial,
} from '../../teacher-workspace/school-week.js';

test('选定周次后，同一周内保持不变', () => {
  const setting = createSchoolWeekSetting(3, new Date(2026, 7, 25, 10));
  assert.equal(calculateSchoolWeek(setting, new Date(2026, 7, 30, 23, 59)), 3);
});

test('到了下周一自动增加一周', () => {
  const setting = createSchoolWeekSetting(3, new Date(2026, 7, 30, 18));
  assert.equal(calculateSchoolWeek(setting, new Date(2026, 7, 31, 0, 0)), 4);
  assert.equal(calculateSchoolWeek(setting, new Date(2026, 8, 7, 8, 0)), 5);
});

test('周一作为每周统一基准，不受选择当天影响', () => {
  assert.equal(mondaySerial(new Date(2026, 7, 24)), mondaySerial(new Date(2026, 7, 30)));
  assert.notEqual(mondaySerial(new Date(2026, 7, 30)), mondaySerial(new Date(2026, 7, 31)));
});

test('未设置或损坏的数据不显示错误周次', () => {
  assert.equal(calculateSchoolWeek(null), null);
  assert.equal(calculateSchoolWeek({ week: 0, anchorMonday: 1 }), null);
});
