/* 本地存储：服务商配置 / 提示词 / 历史 / 草稿 / 当前结果。所有数据只留在浏览器里。 */
import { fmtDateTime, uid } from './utils.js';
import { DEFAULT_PROMPT, PROMPT_VERSION } from './prompt.js';

export { DEFAULT_PROMPT };

const KEY = {
  settings: 'essayGrader.settings.v1',
  history: 'essayGrader.history.v1',
  draft: 'essayGrader.draft.v1',
  result: 'essayGrader.result.v1'
};

export const APP_VERSION = '3.0';
export const SETTINGS_VERSION = 3;

/* 内置服务商：只有默认地址，Key 与模型由用户各自保存 */
export const BUILTIN_PROVIDERS = [
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { id: 'qwen', name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { id: 'zhipu', name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  { id: 'moonshot', name: 'Kimi', baseUrl: 'https://api.moonshot.cn/v1' },
  { id: 'siliconflow', name: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1' }
];

export const PROVIDERS = BUILTIN_PROVIDERS;

const V1_DEFAULT_MODELS = ['deepseek-chat', 'deepseek-reasoner'];

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

function normalizeModels(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((m) => m && m.name)
    .map((m) => ({ name: String(m.name), vision: !!m.vision }));
}

function normalizeProviders(list) {
  return list
    .filter((p) => p && p.id)
    .map((p) => ({
      id: String(p.id),
      name: String(p.name || '未命名服务商'),
      baseUrl: String(p.baseUrl || ''),
      apiKey: String(p.apiKey || ''),
      models: normalizeModels(p.models),
      model: String(p.model || ''),
      builtin: !!p.builtin
    }));
}

function builtinEntries() {
  return BUILTIN_PROVIDERS.map((p) => ({
    id: p.id, name: p.name, baseUrl: p.baseUrl, apiKey: '', models: [], model: '', builtin: true
  }));
}

/* V1 / V2 的「单服务商」结构迁到 V3 的「多服务商」结构 */
function migrateProviders(saved) {
  if (Array.isArray(saved.providers) && saved.providers.length && saved.settingsVersion >= SETTINGS_VERSION) {
    const providers = normalizeProviders(saved.providers);
    if (!providers.length) return null;
    let activeId = saved.activeId;
    if (!providers.some((p) => p.id === activeId)) activeId = providers[0].id;
    return { providers: providers, activeId: activeId };
  }

  const providers = builtinEntries();
  let models = normalizeModels(saved.models);
  if ((saved.modelsVersion || 1) < 2 && models.length && models.length <= 2 &&
      models.every((m) => V1_DEFAULT_MODELS.indexOf(m.name) >= 0)) {
    models = [];
  }

  const legacyId = saved.provider || 'deepseek';
  const target = providers.find((p) => p.id === legacyId);
  if (target) {
    target.baseUrl = saved.baseUrl || target.baseUrl;
    target.apiKey = saved.apiKey || '';
    target.models = models;
    target.model = models.some((m) => m.name === saved.model) ? saved.model : (models[0] ? models[0].name : '');
    return { providers: providers, activeId: target.id };
  }

  const custom = {
    id: 'custom-' + uid(),
    name: '自定义服务商',
    baseUrl: saved.baseUrl || '',
    apiKey: saved.apiKey || '',
    models: models,
    model: models[0] ? models[0].name : '',
    builtin: false
  };
  providers.push(custom);
  return { providers: providers, activeId: custom.id };
}

/* ---------------- 设置 ---------------- */
export function getSettings() {
  const saved = readJson(KEY.settings, null) || {};
  const migrated = migrateProviders(saved);
  const providers = migrated ? migrated.providers : builtinEntries();
  const activeId = migrated ? migrated.activeId : providers[0].id;

  const savedPromptVersion = typeof saved.promptVersion === 'number' ? saved.promptVersion : 1;
  let prompt = saved.prompt;
  if (savedPromptVersion < PROMPT_VERSION && (!prompt || prompt.indexOf('你是一位资深的考研英语阅卷老师') === 0)) {
    prompt = DEFAULT_PROMPT;
  }
  if (!prompt) prompt = DEFAULT_PROMPT;

  return {
    settingsVersion: SETTINGS_VERSION,
    providers: providers,
    activeId: activeId,
    prompt: prompt,
    promptVersion: PROMPT_VERSION,
    temperature: typeof saved.temperature === 'number' ? saved.temperature : 0.4
  };
}

export function getActiveProvider(settings) {
  const s = settings || getSettings();
  return s.providers.find((p) => p.id === s.activeId) || s.providers[0];
}

export function saveSettings(patch) {
  const next = Object.assign(getSettings(), patch || {}, { settingsVersion: SETTINGS_VERSION });
  writeJson(KEY.settings, next);
  return next;
}

export function updateProvider(id, patch) {
  const s = getSettings();
  const providers = s.providers.map((p) => (p.id === id ? Object.assign({}, p, patch) : p));
  return saveSettings({ providers: providers });
}

export function addProvider(entry) {
  const s = getSettings();
  const id = 'custom-' + uid();
  const provider = {
    id: id,
    name: String((entry && entry.name) || '自定义服务商').trim() || '自定义服务商',
    baseUrl: String((entry && entry.baseUrl) || '').trim(),
    apiKey: String((entry && entry.apiKey) || '').trim(),
    models: [],
    model: '',
    builtin: false
  };
  return saveSettings({ providers: s.providers.concat([provider]), activeId: id });
}

export function removeProvider(id) {
  const s = getSettings();
  const provider = s.providers.find((p) => p.id === id);
  if (!provider) throw new Error('服务商不存在');
  if (provider.builtin) throw new Error('内置服务商不能删除');
  const providers = s.providers.filter((p) => p.id !== id);
  const activeId = s.activeId === id ? providers[0].id : s.activeId;
  return saveSettings({ providers: providers, activeId: activeId });
}

export function resetPrompt() {
  return saveSettings({ prompt: DEFAULT_PROMPT, promptVersion: PROMPT_VERSION }).prompt;
}

export function currentModelInfo() {
  const provider = getActiveProvider();
  const found = provider.models.find((m) => m.name === provider.model);
  return { name: provider.model, vision: !!(found && found.vision), provider: provider };
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
    id: uid(), title: '', createdAt: Date.now(), model: '', question: '', essay: '', images: [], score: null
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
  const safe = includeKey ? settings : Object.assign({}, settings, {
    providers: settings.providers.map((p) => Object.assign({}, p, { apiKey: '' }))
  });
  return {
    app: 'essay-grader',
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: safe,
    history: listHistory()
  };
}

export function importBackup(data) {
  if (!data || typeof data !== 'object') throw new Error('备份文件格式不正确');
  if (data.settings && typeof data.settings === 'object') {
    const incoming = Object.assign({}, data.settings);
    if (Array.isArray(incoming.providers)) {
      incoming.providers = incoming.providers.map((p) => {
        const copy = Object.assign({}, p);
        if (!copy.apiKey) delete copy.apiKey;
        return copy;
      });
    } else if (!incoming.apiKey) {
      delete incoming.apiKey;
    }
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
