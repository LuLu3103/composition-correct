/* 本地存储：设置 / 历史 / 草稿 / 当前结果。所有数据只留在浏览器里。 */
import { fmtDateTime, uid } from './utils.js';
import { DEFAULT_PROMPT, PROMPT_VERSION } from './prompt.js';

export { DEFAULT_PROMPT };

const KEY = {
  settings: 'essayGrader.settings.v1',
  history: 'essayGrader.history.v1',
  draft: 'essayGrader.draft.v1',
  result: 'essayGrader.result.v1'
};

export const APP_VERSION = '2.0';

/* 只提供接口地址，不再预置任何模型：模型由用户在设置里从服务商拉取 */
export const PROVIDERS = [
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { id: 'qwen', name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { id: 'zhipu', name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  { id: 'moonshot', name: 'Kimi', baseUrl: 'https://api.moonshot.cn/v1' },
  { id: 'siliconflow', name: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1' },
  { id: 'custom', name: '自定义', baseUrl: '' }
];

const DEFAULT_SETTINGS = {
  provider: 'deepseek',
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: '',
  models: [],
  prompt: DEFAULT_PROMPT,
  promptVersion: PROMPT_VERSION,
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

  if (!Array.isArray(merged.models)) merged.models = [];
  merged.models = merged.models
    .filter((m) => m && m.name)
    .map((m) => ({ name: String(m.name), vision: !!m.vision }));

  if (!merged.model || !merged.models.some((m) => m.name === merged.model)) {
    merged.model = merged.models.length ? merged.models[0].name : '';
  }

  /* V1 → V2：只替换「没有改过」的旧默认提示词，用户自己写的保留 */
  if (merged.promptVersion !== PROMPT_VERSION) {
    const looksLegacy = !merged.prompt || merged.prompt.indexOf('你是一位资深的考研英语阅卷老师') === 0;
    if (looksLegacy) merged.prompt = DEFAULT_PROMPT;
    merged.promptVersion = PROMPT_VERSION;
  }
  if (!merged.prompt) merged.prompt = DEFAULT_PROMPT;

  return merged;
}

export function saveSettings(patch) {
  const next = Object.assign(getSettings(), patch || {});
  writeJson(KEY.settings, next);
  return next;
}

export function resetPrompt() {
  return saveSettings({ prompt: DEFAULT_PROMPT, promptVersion: PROMPT_VERSION }).prompt;
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
  writeJson(KEY.history, list.slice(0, 200));
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
  writeJson(KEY.history, listHistory().filter((item) => item.id !== id));
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
  return {
    app: 'essay-grader',
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: includeKey ? settings : Object.assign({}, settings, { apiKey: '' }),
    history: listHistory()
  };
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
