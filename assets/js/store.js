/* 本地存储：设置 / 历史 / 草稿 / 当前结果。所有数据只留在浏览器里。 */
import { fmtDateTime, uid } from './utils.js';

const KEY = {
  settings: 'essayGrader.settings.v1',
  history: 'essayGrader.history.v1',
  draft: 'essayGrader.draft.v1',
  result: 'essayGrader.result.v1'
};

export const APP_VERSION = '1.0.0';

export const PROVIDERS = [
  {
    id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1',
    models: [{ name: 'deepseek-chat', vision: false }, { name: 'deepseek-reasoner', vision: false }]
  },
  {
    id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1',
    models: [{ name: 'gpt-4o-mini', vision: true }, { name: 'gpt-4o', vision: true }]
  },
  {
    id: 'qwen', name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [{ name: 'qwen-plus', vision: false }, { name: 'qwen-vl-max', vision: true }]
  },
  {
    id: 'zhipu', name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: [{ name: 'glm-4-plus', vision: false }, { name: 'glm-4v-plus', vision: true }]
  },
  {
    id: 'moonshot', name: 'Kimi', baseUrl: 'https://api.moonshot.cn/v1',
    models: [{ name: 'moonshot-v1-8k', vision: false }, { name: 'moonshot-v1-32k-vision-preview', vision: true }]
  },
  {
    id: 'siliconflow', name: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1',
    models: [{ name: 'Qwen/Qwen2.5-72B-Instruct', vision: false }, { name: 'Qwen/Qwen2.5-VL-72B-Instruct', vision: true }]
  },
  { id: 'custom', name: '自定义', baseUrl: '', models: [] }
];

export const DEFAULT_PROMPT = [
  '你是一位资深的考研英语阅卷老师，负责批改考研英语作文（默认满分 20 分，若题目另有要求以题目为准）。',
  '请从内容、结构、语言、词汇语法四个方面评判学生作文，并用中文给出批改结果。',
  '',
  '【评分标准】',
  '1. 内容要点（6 分）：是否覆盖题目要求，论点是否清晰、相关、有展开。',
  '2. 篇章结构（5 分）：段落安排、衔接过渡、逻辑层次是否清楚。',
  '3. 语言表达（5 分）：句式多样性、表达是否地道、时态语态是否正确。',
  '4. 词汇语法（4 分）：拼写、搭配、语法错误的严重程度。',
  '',
  '【输出格式】必须严格按下面的三个区块输出，区块之间不要添加任何额外说明，每个区块以【】标题开头：',
  '',
  '【修改建议】',
  '- 逐条列出主要问题，每条一行，格式为“问题：…… 修改：……”。',
  '- 指出 3–6 条最关键的问题，覆盖语法、用词、结构、逻辑。',
  '- 如果原文有亮点，用“亮点：……”开头单独列出 1–2 条。',
  '',
  '【修改作文】',
  '- 在保留学生原有思路和内容的前提下，给出润色后的完整作文。',
  '- 只输出作文正文，不要任何解释、批注或小标题。',
  '- 使用规范的英文书面表达，分 2–3 段，长度与原文相当或略长。',
  '',
  '【作文评分】',
  '总分：X/20',
  '档次：第一档（优秀）/ 第二档（良好）/ 第三档（及格）/ 第四档（待提高）',
  '内容要点：X/6',
  '篇章结构：X/5',
  '语言表达：X/5',
  '词汇语法：X/4',
  '评语：用 2–3 句话说明得分理由与提分重点。',
  '',
  '如果用户提供了图片，请先准确识别图片中的手写或印刷文字，再按上述要求批改；如果图片中的作文不完整，请在修改建议中注明。',
  '批改时请默认学生作文是英文作文；如果学生写的是中文，请指出并按照中文写作的标准处理。'
].join('\n');

const DEFAULT_SETTINGS = {
  provider: 'deepseek',
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-chat',
  models: [
    { name: 'deepseek-chat', vision: false },
    { name: 'deepseek-reasoner', vision: false }
  ],
  prompt: DEFAULT_PROMPT,
  temperature: 0.4
};

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    const err = new Error('本地存储空间不足，请清理历史记录或备份后重试');
    err.code = 'QUOTA';
    throw err;
  }
}

/* ---------------- 设置 ---------------- */
export function getSettings() {
  const saved = readJson(KEY.settings, null) || {};
  const merged = Object.assign({}, DEFAULT_SETTINGS, saved);
  if (!Array.isArray(merged.models) || !merged.models.length) merged.models = DEFAULT_SETTINGS.models.slice();
  if (!merged.prompt) merged.prompt = DEFAULT_PROMPT;
  return merged;
}

export function saveSettings(patch) {
  const next = Object.assign(getSettings(), patch || {});
  writeJson(KEY.settings, next);
  return next;
}

export function resetPrompt() {
  return saveSettings({ prompt: DEFAULT_PROMPT }).prompt;
}

export function currentModelInfo() {
  const s = getSettings();
  const found = s.models.find((m) => m.name === s.model);
  return { name: s.model, vision: !!(found && found.vision) };
}

/* ---------------- 历史 ---------------- */
export function listHistory() {
  const list = readJson(KEY.history, []);
  return Array.isArray(list) ? list : [];
}

export function getHistory(id) {
  return listHistory().find((item) => item.id === id) || null;
}

export function addHistory(entry) {
  const list = listHistory();
  const record = Object.assign({
    id: uid(),
    title: '',
    createdAt: Date.now(),
    model: '',
    question: '',
    essay: '',
    images: [],
    score: null
  }, entry);
  if (!record.title) record.title = fmtDateTime(record.createdAt);
  list.unshift(record);
  const trimmed = list.slice(0, 200);
  writeJson(KEY.history, trimmed);
  return record;
}

export function updateHistory(id, patch) {
  const list = listHistory();
  const idx = list.findIndex((item) => item.id === id);
  if (idx < 0) return null;
  list[idx] = Object.assign({}, list[idx], patch);
  writeJson(KEY.history, list);
  return list[idx];
}

export function removeHistory(id) {
  const list = listHistory().filter((item) => item.id !== id);
  writeJson(KEY.history, list);
}

export function clearHistory() {
  writeJson(KEY.history, []);
}

/* ---------------- 草稿 ---------------- */
export function getDraft() {
  return Object.assign({ question: '', essay: '', images: [] }, readJson(KEY.draft, {}));
}

export function saveDraft(patch) {
  const next = Object.assign(getDraft(), patch || {});
  try { writeJson(KEY.draft, next); } catch (e) { /* 草稿写入失败不打断使用 */ }
  return next;
}

export function clearDraft() {
  try { localStorage.removeItem(KEY.draft); } catch (e) { /* ignore */ }
}

/* ---------------- 当前结果 ---------------- */
export function getResult() {
  return readJson(KEY.result, null);
}

export function saveResult(result) {
  try { writeJson(KEY.result, result); } catch (e) { /* 忽略体积问题 */ }
  return result;
}

export function clearResult() {
  try { localStorage.removeItem(KEY.result); } catch (e) { /* ignore */ }
}

/* ---------------- 备份 ---------------- */
export function exportBackup(includeKey) {
  const settings = getSettings();
  const payload = {
    app: 'essay-grader',
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: includeKey ? settings : Object.assign({}, settings, { apiKey: '' }),
    history: listHistory()
  };
  return payload;
}

export function importBackup(data) {
  if (!data || typeof data !== 'object') throw new Error('备份文件格式不正确');
  if (data.settings && typeof data.settings === 'object') {
    const incoming = Object.assign({}, data.settings);
    if (!incoming.apiKey) delete incoming.apiKey;
    saveSettings(incoming);
  }
  if (Array.isArray(data.history)) {
    const cleaned = data.history.filter((it) => it && typeof it === 'object' && it.id).slice(0, 200);
    writeJson(KEY.history, cleaned);
  }
  return true;
}

export function wipeAll() {
  Object.values(KEY).forEach((k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } });
}
