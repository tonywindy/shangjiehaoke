const normalizeHeader = (value) => String(value ?? '')
  .replace(/^\uFEFF/, '')
  .replace(/[\s_·：:]/g, '')
  .toLowerCase();

const UNIT_ALIASES = new Set([
  '单元', '单元名称', '章节', '章节名称', '章', '模块', '一级目录', 'unit', 'unitname',
].map(normalizeHeader));

const KP_ALIASES = new Set([
  '知识点', '知识点名称', '学习内容', '课时知识点', '二级目录', '内容', 'knowledgepoint', 'name',
].map(normalizeHeader));

const looksLikeUnitHeading = (value) => {
  const text = String(value || '').trim();
  return /^(第?[一二三四五六七八九十百0-9]+(?:单元|章节|章)|unit\s*[0-9]+)(?:\s|$|[：:、.．-])/i.test(text)
    || /^[一二三四五六七八九十]+[、.．]\s*\S+/.test(text);
};

export function extractKnowledgePointRows(rows, options = {}) {
  const normalizedRows = rows
    .map((row) => (Array.isArray(row) ? row : [row]).map((cell) => String(cell ?? '').trim()))
    .filter((row) => row.some(Boolean));
  if (!normalizedRows.length) return [];

  const headerIndex = normalizedRows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return headers.some((value) => UNIT_ALIASES.has(value))
      && headers.some((value) => KP_ALIASES.has(value));
  });
  const header = headerIndex >= 0 ? normalizedRows[headerIndex].map(normalizeHeader) : [];
  const unitIndex = header.findIndex((value) => UNIT_ALIASES.has(value));
  const kpIndex = header.findIndex((value) => KP_ALIASES.has(value));
  const dataRows = headerIndex >= 0 ? normalizedRows.slice(headerIndex + 1) : normalizedRows;
  const fallbackUnit = String(options.fallbackUnit || '').trim();
  const result = [];
  const seen = new Set();
  let currentUnit = fallbackUnit;

  dataRows.forEach((row) => {
    let unitName = '';
    let name = '';

    if (headerIndex >= 0) {
      const explicitUnit = String(row[unitIndex] || '').trim();
      if (explicitUnit) currentUnit = explicitUnit;
      unitName = explicitUnit || currentUnit || fallbackUnit || '未分单元';
      name = String(row[kpIndex] || '').trim();
    } else {
      const first = String(row[0] || '').trim();
      const second = String(row[1] || '').trim();
      const nonEmpty = row.filter(Boolean);

      if (second) {
        if (first) currentUnit = first;
        unitName = first || currentUnit || fallbackUnit || '未分单元';
        name = second;
      } else if (nonEmpty.length > 1) {
        currentUnit = nonEmpty[0];
        unitName = currentUnit;
        name = nonEmpty[1];
      } else if (first && looksLikeUnitHeading(first)) {
        currentUnit = first;
        return;
      } else {
        unitName = currentUnit || fallbackUnit || '未分单元';
        name = nonEmpty[0] || '';
      }
    }

    if (!name || KP_ALIASES.has(normalizeHeader(name))) return;
    const item = { unitName: unitName.trim() || '未分单元', name: name.trim() };
    const key = `${item.unitName}\u0000${item.name}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push(item);
  });

  return result;
}

export function groupKnowledgePointRows(items) {
  const groups = new Map();
  items.forEach((item) => {
    if (!groups.has(item.unitName)) groups.set(item.unitName, []);
    groups.get(item.unitName).push(item);
  });
  return [...groups.entries()].map(([unitName, knowledgePoints]) => ({ unitName, knowledgePoints }));
}

export function seatRowIndexes(rows, podiumPosition = 'top') {
  const indexes = Array.from({ length: Math.max(0, Number(rows) || 0) }, (_, index) => index);
  return podiumPosition === 'bottom' ? indexes.reverse() : indexes;
}
