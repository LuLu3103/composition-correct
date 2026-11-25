/* 批改结果解析：支持 V2 八段格式、V1 三段格式与 JSON 输出 */

const V2_DEFS = [
  { id: 'req', title: '题目要求与完成情况', keys: ['题目要求', '完成情况', '任务完成'] },
  { id: 'overall', title: '总体评价', keys: ['总体评价', '总评'] },
  { id: 'sentences', title: '逐句批改', keys: ['逐句批改', '逐句'] },
  { id: 'personal', title: '个性化优化', keys: ['个性化', '模板基础'] },
  { id: 'errors', title: '最值得记住的错误', keys: ['最值得记住', '记住的错误'] },
  { id: 'revised', title: '修改后的完整作文', keys: ['修改后的完整作文', '完整作文', '修改稿'] },
  { id: 'phrases', title: '最值得积累的表达', keys: ['积累的表达', '值得积累'] },
  { id: 'score', title: '评分', keys: ['评分'] }
];

const V2_ORDER = ['req', 'overall', 'sentences', 'personal', 'errors', 'phrases'];

function matchDef(title) {
  for (let i = 0; i < V2_DEFS.length; i++) {
    const def = V2_DEFS[i];
    for (let j = 0; j < def.keys.length; j++) {
      if (title.indexOf(def.keys[j]) >= 0) return def;
    }
  }
  return null;
}

function splitV2(text) {
  const lines = text.split('\n');
  let offset = 0;
  const hits = [];
  const seen = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const start = offset;
    offset += line.length + 1;
    const clean = line.trim().replace(/^#{1,6}\s*/, '').replace(/\*\*/g, '');
    const m = clean.match(/^(?:\d{1,2}|[一二三四五六七八九十])\s*[.．、]\s*(.+)$/);
    if (!m) continue;
    const def = matchDef(m[1]);
    if (!def || seen[def.id]) continue;
    seen[def.id] = true;
    hits.push({ id: def.id, title: def.title, headingStart: start, bodyStart: start + line.length + 1 });
  }
  if (hits.length < 3) return null;
  const sections = {};
  for (let i = 0; i < hits.length; i++) {
    const end = i + 1 < hits.length ? hits[i + 1].headingStart : text.length;
    sections[hits[i].id] = text.slice(hits[i].bodyStart, end).trim();
  }
  return sections;
}

/* ---------- 逐句批改：把【原句】/【修改与说明】拆成条目 ---------- */
export function parseSentencePairs(body) {
  if (!body) return null;
  const chunks = body.split(/【原句】\s*[:：]?/).slice(1);
  if (!chunks.length) return null;
  const items = [];
  chunks.forEach((chunk) => {
    const parts = chunk.split(/【修改与说明】/);
    const original = (parts[0] || '').trim();
    const rest = (parts[1] || '').trim();
    if (!original && !rest) return;
    let fix = '';
    let note = '';
    const fixM = rest.match(/(?:修改为|改为|建议改为)\s*[:：]\s*([\s\S]*?)(?=\n\s*说明\s*[:：]|$)/);
    if (fixM) fix = fixM[1].trim();
    const noteM = rest.match(/说明\s*[:：]\s*([\s\S]*)$/);
    if (noteM) note = noteM[1].trim();
    if (!fix && !note) note = rest;
    items.push({ original: original, fix: fix, note: note });
  });
  return items.length ? items : null;
}

/* ---------- 最值得积累的表达 ---------- */
export function parsePhrasePairs(body) {
  if (!body) return null;
  const chunks = body.split(/表达与用法\s*[:：]/).slice(1);
  if (!chunks.length) return null;
  const items = [];
  chunks.forEach((chunk) => {
    const parts = chunk.split(/可用于\s*[:：]/);
    const phrase = (parts[0] || '').trim().replace(/^[-*\s]+/, '').replace(/\n+/g, ' ');
    const usage = (parts.slice(1).join(' ') || '').trim();
    if (phrase) items.push({ phrase: phrase, usage: usage });
  });
  return items.length ? items : null;
}

/* ---------- 评分 ---------- */
function dimsOf(text) {
  const dims = [];
  const re = /(?:^|\n)\s*[-*•·]?\s*([\u4e00-\u9fa5A-Za-z ]{2,12})\s*[:：]\s*(\d+(?:\.\d+)?)\s*(?:\/|／)\s*(\d+(?:\.\d+)?)/g;
  let m;
  while ((m = re.exec(text))) {
    const name = m[1].trim();
    if (/^(总分|得分|分数|满分|总评|预估)/.test(name)) continue;
    if (dims.some((d) => d.name === name)) continue;
    dims.push({ name: name, value: Number(m[2]), max: Number(m[3]) });
  }
  return dims;
}

export function parseScoreV2(body, fullText) {
  if (!body) return null;
  const levelM = body.match(/(?:预估)?档次\s*[:：]\s*([^\n]+)/);
  const lineM = body.match(/(?:预估)?分数\s*[:：]\s*([^\n]+)/);
  const scoreLine = lineM ? lineM[1].trim() : '';

  let total = null;
  let max = null;
  let range = '';
  const rangeM = scoreLine.match(/(\d+(?:\.\d+)?)\s*[-–—~～至]\s*(\d+(?:\.\d+)?)/);
  if (rangeM) range = rangeM[1] + '–' + rangeM[2];
  const moreM = scoreLine.match(/更可能(?:落在|是|为)?\s*[:：]?\s*(\d+(?:\.\d+)?)/)
    || body.match(/更可能(?:落在|是|为)?\s*[:：]?\s*(\d+(?:\.\d+)?)/);
  const fracM = scoreLine.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+)/);
  const singleM = scoreLine.match(/(\d+(?:\.\d+)?)\s*分/);

  if (fracM) { total = Number(fracM[1]); max = Number(fracM[2]); }
  else if (moreM) total = Number(moreM[1]);
  else if (rangeM) total = (Number(rangeM[1]) + Number(rangeM[2])) / 2;
  else if (singleM) total = Number(singleM[1]);

  const dims = dimsOf(body);
  if (total === null && !dims.length) return null;

  if (max === null) {
    const fullM = body.match(/满分\s*[:：]?\s*(\d+)/);
    if (fullM) max = Number(fullM[1]);
    else if (/小作文/.test(fullText) && !/大作文/.test(fullText)) max = 10;
    else max = 20;
  }
  if (total !== null && max && total > max) total = max;

  const strengthM = body.match(/得分优势\s*[:：]\s*([\s\S]*?)(?=主要扣分点|$)/);
  const weaknessM = body.match(/主要扣分点\s*[:：]\s*([\s\S]*)$/);

  return {
    total: total,
    max: max,
    range: range,
    level: levelM ? levelM[1].trim() : '',
    comment: '',
    dims: dims,
    strengths: strengthM ? strengthM[1].trim() : '',
    weaknesses: weaknessM ? weaknessM[1].trim() : ''
  };
}

function parseScoreV1(text) {
  if (!text) return null;
  const dims = dimsOf(text);
  let total = null;
  let max = null;
  const totalMatch = text.match(/(?:总分|得分|总评|分数)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*(?:\/|／)\s*(\d+)?/);
  if (totalMatch) {
    total = Number(totalMatch[1]);
    if (totalMatch[2]) max = Number(totalMatch[2]);
  }
  if (total === null) {
    const alt = text.match(/(\d+(?:\.\d+)?)\s*(?:\/|／)\s*(\d+)\s*分/);
    if (alt) { total = Number(alt[1]); max = Number(alt[2]); }
  }
  if (total === null) {
    const alt2 = text.match(/(?:总分|得分)\s*[:：]?\s*(\d+(?:\.\d+)?)\s*分/);
    if (alt2) total = Number(alt2[1]);
  }
  if (total === null && dims.length) total = dims.reduce((sum, d) => sum + d.value, 0);
  if (max === null) {
    const mm = text.match(/(?:满分|总分)\s*[:：]?\s*(\d{1,3})/);
    if (mm) max = Number(mm[1]);
  }
  if (max === null && dims.length) max = dims.reduce((sum, d) => sum + d.max, 0) || null;
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
  return {
    total: total,
    max: max,
    range: '',
    level: level,
    comment: commentMatch ? commentMatch[1].trim() : '',
    dims: dims,
    strengths: '',
    weaknesses: ''
  };
}

/* ---------- V1 三段格式 ---------- */
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

function bracketMarkers(text) {
  const re = /[\u3010\[]\s*([^\u3011\]]{2,12})\s*[\u3011\]]/g;
  const marks = [];
  let m;
  while ((m = re.exec(text))) {
    const key = keyOf(m[1].trim());
    if (key) marks.push({ key: key, start: m.index, end: m.index + m[0].length });
  }
  return marks;
}

function lineMarkers(text) {
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
    if (key) marks.push({ key: key, start: offset, end: offset + line.length });
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
    if (!body) continue;
    out[marks[i].key] = out[marks[i].key] ? out[marks[i].key] + '\n' + body : body;
  }
  return out;
}

/* ---------- JSON 输出 ---------- */
function normalizeJson(obj, raw) {
  const suggestions = obj.suggestions || obj['修改建议'] || '';
  const revised = obj.revised || obj.corrected || obj['修改作文'] || obj['修改后的完整作文'] || '';
  const scoreRaw = obj.score || obj['评分'] || obj['作文评分'] || null;
  let score = null;
  if (scoreRaw && typeof scoreRaw === 'object') {
    const total = Number(scoreRaw.total);
    if (Number.isFinite(total)) {
      const dims = Array.isArray(scoreRaw.dims)
        ? scoreRaw.dims.filter((d) => d && d.name).map((d) => ({ name: String(d.name), value: Number(d.value) || 0, max: Number(d.max) || 0 }))
        : [];
      score = {
        total: total,
        max: Number(scoreRaw.max) || (dims.length ? dims.reduce((s, d) => s + d.max, 0) : 20),
        level: scoreRaw.level || scoreRaw['档次'] || '',
        comment: scoreRaw.comment || scoreRaw['评语'] || '',
        dims: dims,
        strengths: scoreRaw.strengths || '',
        weaknesses: scoreRaw.weaknesses || '',
        range: ''
      };
    }
  }
  const blocks = [];
  if (suggestions) blocks.push({ id: 'suggestions', title: '修改建议', body: String(suggestions), kind: 'text' });
  if (!blocks.length && !revised && !score) return null;
  return {
    parsed: true,
    format: 'json',
    blocks: blocks,
    revised: String(revised || ''),
    score: score,
    suggestions: String(suggestions || ''),
    raw: raw
  };
}

function tryJson(text) {
  const cleaned = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  if (cleaned.charAt(0) !== '{') return null;
  try {
    return normalizeJson(JSON.parse(cleaned), text);
  } catch (e) {
    return null;
  }
}

/* ---------- 主入口 ---------- */
export function parseResult(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;

  const json = tryJson(text);
  if (json) return json;

  const v2 = splitV2(text);
  if (v2) {
    const blocks = [];
    V2_ORDER.forEach((id) => {
      const body = v2[id];
      if (!body) return;
      const def = V2_DEFS.find((d) => d.id === id);
      blocks.push({
        id: id,
        title: def ? def.title : id,
        body: body,
        kind: id === 'sentences' ? 'sentences' : (id === 'phrases' ? 'phrases' : 'text'),
        sentences: id === 'sentences' ? parseSentencePairs(body) : null,
        phrases: id === 'phrases' ? parsePhrasePairs(body) : null
      });
    });
    return {
      parsed: true,
      format: 'v2',
      blocks: blocks,
      revised: v2.revised || '',
      score: parseScoreV2(v2.score || '', text),
      suggestions: blocks.map((b) => b.body).join('\n\n'),
      raw: text
    };
  }

  let marks = bracketMarkers(text);
  if (marks.length < 2) {
    const lineM = lineMarkers(text);
    if (lineM.length > marks.length) marks = lineM;
  }
  marks.sort((a, b) => a.start - b.start);

  if (!marks.length) {
    return {
      parsed: false,
      format: 'text',
      blocks: [{ id: 'raw', title: '批改内容', body: text, kind: 'text' }],
      revised: '',
      score: null,
      suggestions: text,
      raw: text
    };
  }

  const parts = sliceSections(text, marks);
  const blocks = [];
  if (parts.suggestions) blocks.push({ id: 'suggestions', title: '修改建议', body: parts.suggestions, kind: 'text' });
  return {
    parsed: true,
    format: 'v1',
    blocks: blocks,
    revised: parts.revised || '',
    score: parseScoreV1(parts.score),
    suggestions: parts.suggestions || '',
    raw: text
  };
}

export function scoreRatio(score) {
  if (!score || !score.max) return 0;
  return Math.max(0, Math.min(1, (score.total || 0) / score.max));
}
