/* 批改结果解析：把模型输出拆成「修改建议 / 修改作文 / 作文评分」 */

const ALIASES = [
  { key: 'suggestions', words: ['修改建议', '修改意见', '批改建议', '改进建议', '建议'] },
  { key: 'revised', words: ['修改作文', '修改后的作文', '修改后作文', '润色作文', '参考范文', '范文', '修改稿'] },
  { key: 'score', words: ['作文评分', '评分', '得分', '分数', '总评'] }
];

function keyOf(word) {
  for (let i = 0; i < ALIASES.length; i++) {
    if (ALIASES[i].words.indexOf(word) >= 0) return ALIASES[i].key;
  }
  return null;
}

function collectBracketMarkers(text) {
  const re = /[\u3010\[]\s*([^\u3011\]]{2,12})\s*[\u3011\]]/g;
  const marks = [];
  let m;
  while ((m = re.exec(text))) {
    const key = keyOf(m[1].trim());
    if (key) marks.push({ key, start: m.index, end: m.index + m[0].length });
  }
  return marks;
}

function collectLineMarkers(text) {
  const lines = text.split('\n');
  const marks = [];
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const clean = line.trim()
      .replace(/^#{1,6}\s*/, '')
      .replace(/^\*\*(.*)\*\*$/, '$1')
      .replace(/[:：]\s*$/, '')
      .trim();
    const key = keyOf(clean);
    if (key) marks.push({ key, start: offset, end: offset + line.length });
    offset += line.length + 1;
  }
  return marks;
}

function sliceSections(text, marks) {
  const out = { suggestions: '', revised: '', score: '' };
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].end;
    const end = i + 1 < marks.length ? marks[i + 1].start : text.length;
    const body = text.slice(start, end).trim();
    const key = marks[i].key;
    if (!body) continue;
    out[key] = out[key] ? out[key] + '\n' + body : body;
  }
  return out;
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function parseScore(text) {
  if (!text) return null;
  const dims = [];
  const dimRe = /(?:^|\n)\s*[-*\u2022\u00b7]?\s*([\u4e00-\u9fa5A-Za-z ]{2,12})\s*[:：]\s*(\d+(?:\.\d+)?)\s*(?:\/|\uff0f)\s*(\d+(?:\.\d+)?)/g;
  let m;
  while ((m = dimRe.exec(text))) {
    const name = m[1].trim();
    if (/^(总分|得分|分数|满分|总评)/.test(name)) continue;
    if (dims.some((d) => d.name === name)) continue;
    dims.push({ name, value: Number(m[2]), max: Number(m[3]) });
  }

  let total = null;
  let max = null;
  const totalMatch = text.match(/(?:总分|得分|总评|分数)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(?:\/|\uff0f)\s*(\d+)?/);
  if (totalMatch) {
    total = Number(totalMatch[1]);
    if (totalMatch[2]) max = Number(totalMatch[2]);
  }
  if (total === null) {
    const alt = text.match(/(\d+(?:\.\d+)?)\s*(?:\/|\uff0f)\s*(\d+)\s*分/);
    if (alt) { total = Number(alt[1]); max = Number(alt[2]); }
  }
  if (total === null) {
    const alt2 = text.match(/(?:总分|得分)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*分/);
    if (alt2) total = Number(alt2[1]);
  }
  if (total === null && dims.length) {
    total = dims.reduce((sum, d) => sum + d.value, 0);
  }
  if (max === null) {
    const mm = text.match(/(?:满分|总分)\s*[:：]?\s*(\d{1,3})/);
    if (mm) max = Number(mm[1]);
  }
  if (max === null && dims.length) {
    max = dims.reduce((sum, d) => sum + d.max, 0) || null;
  }
  if (max === null) max = 20;
  if (total === null && !dims.length) return null;
  if (total !== null && max && total > max) total = max;

  const levelMatch = text.match(/(?:档次|等级|档位)\s*[:：]?\s*([^\n]+)/);
  let level = levelMatch ? levelMatch[1].trim() : '';
  const ratio = total !== null && max ? total / max : 0;
  if (!level) {
    if (ratio >= 0.9) level = '第一档（优秀）';
    else if (ratio >= 0.75) level = '第二档（良好）';
    else if (ratio >= 0.6) level = '第三档（及格）';
    else level = '第四档（待提高）';
  }

  const commentMatch = text.match(/(?:评语|点评|总评)\s*[:：]?\s*([\s\S]*)$/);
  let comment = commentMatch ? commentMatch[1].trim() : '';

  return { total, max, level, comment, dims };
}

function normalizeJson(obj, raw) {
  const suggestions = obj.suggestions || obj['修改建议'] || '';
  const revised = obj.revised || obj.corrected || obj['修改作文'] || '';
  const scoreRaw = obj.score || obj['作文评分'] || null;
  let score = null;
  if (scoreRaw && typeof scoreRaw === 'object') {
    const dims = Array.isArray(scoreRaw.dims)
      ? scoreRaw.dims.filter((d) => d && d.name).map((d) => ({ name: String(d.name), value: toNum(d.value) || 0, max: toNum(d.max) || 0 }))
      : [];
    const total = toNum(scoreRaw.total);
    if (total !== null) {
      score = {
        total,
        max: toNum(scoreRaw.max) || (dims.length ? dims.reduce((s, d) => s + d.max, 0) : 20),
        level: scoreRaw.level || scoreRaw['档次'] || '',
        comment: scoreRaw.comment || scoreRaw['评语'] || '',
        dims
      };
    }
  }
  if (!suggestions && !revised && !score) return null;
  return {
    suggestions: String(suggestions || ''),
    revised: String(revised || ''),
    scoreText: score ? '' : '',
    score,
    parsed: true,
    raw
  };
}

function tryJson(text) {
  const cleaned = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  if (cleaned.charAt(0) !== '{') return null;
  try {
    const obj = JSON.parse(cleaned);
    return normalizeJson(obj, text);
  } catch (e) {
    return null;
  }
}

export function parseResult(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;

  const json = tryJson(text);
  if (json) return json;

  let marks = collectBracketMarkers(text);
  if (marks.length < 2) {
    const lineMarks = collectLineMarkers(text);
    if (lineMarks.length > marks.length) marks = lineMarks;
  }
  marks.sort((a, b) => a.start - b.start);

  if (!marks.length) {
    return { suggestions: text, revised: '', scoreText: '', score: null, parsed: false, raw: text };
  }

  const parts = sliceSections(text, marks);
  const score = parseScore(parts.score);
  return {
    suggestions: parts.suggestions || (parts.revised || parts.score ? '' : text),
    revised: parts.revised,
    scoreText: parts.score,
    score,
    parsed: true,
    raw: text
  };
}

export function scoreRatio(score) {
  if (!score || !score.max) return 0;
  return Math.max(0, Math.min(1, (score.total || 0) / score.max));
}
