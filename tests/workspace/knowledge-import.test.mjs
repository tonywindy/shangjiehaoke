import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractKnowledgePointRows,
  groupKnowledgePointRows,
  seatRowIndexes,
} from '../../teacher-workspace/v07/knowledge-import.js';

test('Excel 合并单元格后的空白单元会继承上一单元', () => {
  const rows = [
    ['单元', '知识点'],
    ['第一单元', '认识更大的数'],
    ['', '人口普查'],
    ['第二单元', '线与角'],
    ['', '平移与平行'],
  ];
  assert.deepEqual(extractKnowledgePointRows(rows), [
    { unitName: '第一单元', name: '认识更大的数' },
    { unitName: '第一单元', name: '人口普查' },
    { unitName: '第二单元', name: '线与角' },
    { unitName: '第二单元', name: '平移与平行' },
  ]);
});

test('单列中的单元标题会建立分组而不是被当成知识点', () => {
  const rows = [
    ['第一单元 认识更大的数'],
    ['数一数'],
    ['人口普查'],
    ['第二单元 线与角'],
    ['线的认识'],
  ];
  const items = extractKnowledgePointRows(rows);
  assert.equal(items.length, 3);
  assert.deepEqual(groupKnowledgePointRows(items).map((group) => [group.unitName, group.knowledgePoints.length]), [
    ['第一单元 认识更大的数', 2],
    ['第二单元 线与角', 1],
  ]);
});

test('纯一列清单可以使用教师填写的默认单元', () => {
  assert.deepEqual(extractKnowledgePointRows([['口算'], ['竖式']], { fallbackUnit: '第三单元' }), [
    { unitName: '第三单元', name: '口算' },
    { unitName: '第三单元', name: '竖式' },
  ]);
});

test('讲台在下方时按相反视觉顺序展示排号', () => {
  assert.deepEqual(seatRowIndexes(4, 'top'), [0, 1, 2, 3]);
  assert.deepEqual(seatRowIndexes(4, 'bottom'), [3, 2, 1, 0]);
});
