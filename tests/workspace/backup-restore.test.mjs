import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeBackup,
  remapClassDataset,
  restoreDatasetsToClasses,
} from '../../teacher-workspace/review-export-data.js';

const scopedStores = [
  'students', 'kps', 'judgements', 'questionSets', 'questionSetUses',
  'reasonTemplates', 'homeworks', 'homeworkEntries', 'followupTasks', 'notes',
];

function emptyRecords() {
  return Object.fromEntries(scopedStores.map((name) => [name, []]));
}

function sourceFixture(classId = 'source-class') {
  const records = emptyRecords();
  records.students.push({ id: 'student-a', classId, name: '测试学生' });
  records.kps.push({ id: 'kp-a', classId, name: '测试知识点' });
  records.judgements.push({
    id: 'judgement-a', classId, studentId: 'student-a', kpId: 'kp-a', status: 'mastered',
  });
  return {
    records,
    seatConfig: { rows: 1, desks: 1, seatsPerDesk: 1 },
    seatAssignments: { '0:0:0': 'student-a' },
    initialized: true,
  };
}

function fakeDatabase({ throwOnStore = '' } = {}) {
  const staged = new Map();
  const database = {
    calls: [],
    aborted: false,
    committed: false,
    transaction(storeNames, mode) {
      database.calls.push({ storeNames: [...storeNames], mode });
      const transaction = {
        error: null,
        objectStore(name) {
          if (!staged.has(name)) staged.set(name, []);
          return {
            openCursor() {
              const request = {};
              queueMicrotask(() => {
                request.result = null;
                request.onsuccess?.();
              });
              return request;
            },
            put(value) {
              if (name === throwOnStore) throw new Error('模拟写入失败');
              staged.get(name).push(value);
            },
          };
        },
        abort() {
          database.aborted = true;
          transaction.error = new Error('事务已取消');
          queueMicrotask(() => transaction.onabort?.());
        },
      };
      queueMicrotask(() => queueMicrotask(() => {
        if (!database.aborted) {
          database.committed = true;
          transaction.oncomplete?.();
        }
      }));
      return transaction;
    },
  };
  return { database, staged };
}

test('备份校验拒绝重复班级和未知班级数据', () => {
  const duplicateClasses = {
    app: '上节好课教师工作台', version: 5, scope: 'all-classes',
    classes: [{ id: 'a', name: '一班' }, { id: 'a', name: '二班' }], records: emptyRecords(),
  };
  assert.throws(() => normalizeBackup(duplicateClasses), /重复班级ID/);

  const unknownClass = {
    app: '上节好课教师工作台', version: 5, scope: 'all-classes',
    classes: [{ id: 'a', name: '一班' }], records: emptyRecords(),
  };
  unknownClass.records.students.push({ id: 's', classId: 'missing', name: '学生' });
  assert.throws(() => normalizeBackup(unknownClass), /未知班级数据/);
});

test('恢复时同步重映射学生关联和座位', () => {
  const remapped = remapClassDataset(
    sourceFixture().records,
    { '0:0:0': 'student-a' },
    'target-class',
  );
  const student = remapped.records.students[0];
  const judgement = remapped.records.judgements[0];

  assert.equal(student.classId, 'target-class');
  assert.notEqual(student.id, 'student-a');
  assert.equal(judgement.studentId, student.id);
  assert.equal(remapped.seatAssignments['0:0:0'], student.id);
});

test('多班级恢复只使用一个覆盖全部数据仓库的事务', async () => {
  const { database, staged } = fakeDatabase();
  await restoreDatasetsToClasses([{
    source: sourceFixture(),
    targetClassId: 'target-class',
    classRecord: { id: 'target-class', name: '恢复班级' },
  }], database);

  assert.equal(database.calls.length, 1);
  assert.equal(database.calls[0].mode, 'readwrite');
  assert.deepEqual(new Set(database.calls[0].storeNames), new Set([...scopedStores, 'meta', 'classes']));
  assert.equal(database.committed, true);
  assert.equal(staged.get('classes').length, 1);
  assert.equal(staged.get('students').length, 1);
});

test('恢复写入失败会取消整笔事务', async () => {
  const { database } = fakeDatabase({ throwOnStore: 'judgements' });
  await assert.rejects(
    restoreDatasetsToClasses([{
      source: sourceFixture(),
      targetClassId: 'target-class',
      classRecord: { id: 'target-class', name: '恢复班级' },
    }], database),
    /模拟写入失败|事务已取消/,
  );
  assert.equal(database.aborted, true);
  assert.equal(database.committed, false);
});
