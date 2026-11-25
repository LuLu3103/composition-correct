/* 应用外壳：路由、底部标签、批改任务生命周期 */
import { $, $$, icon, fmtClock, fmtDate, toast } from './utils.js';
import {
  getSettings, getActiveProvider, currentModelInfo, getDraft, saveDraft, addHistory, saveResult,
  getResult, clearResult
} from './store.js';
import { buildMessages, chatCompletion } from './api.js';
import { parseResult } from './parse.js';
import * as homeView from './views/home.js';
import * as reviewView from './views/review.js';
import * as historyView from './views/history.js';
import * as settingsView from './views/settings.js';

const VIEWS = { home: homeView, review: reviewView, history: historyView, settings: settingsView };
const ROUTES = ['home', 'review', 'history', 'settings'];
const TAB_LABELS = { home: '首页', review: '批改', history: '历史', settings: '设置' };
const TAB_ICONS = { home: 'home', review: 'review', history: 'history', settings: 'settings' };

let job = null;

const app = {
  go(route) {
    const next = VIEWS[route] ? route : 'home';
    if (location.hash === '#/' + next) render();
    else location.hash = '#/' + next;
  },
  refresh() {
    const y = window.scrollY;
    render();
    requestAnimationFrame(() => window.scrollTo(0, y));
  },
  getJob() { return job; },
  getRoute() { return routeFromHash(); },
  startCorrection,
  openHistory,
  clearViewing() {
    job = null;
    clearResult();
    clearDraftInputs();
    render();
  }
};

function routeFromHash() {
  const raw = (location.hash || '').replace(/^#\/?/, '').replace(/\/$/, '');
  return ROUTES.indexOf(raw) >= 0 ? raw : 'home';
}

function clearDraftInputs() {
  saveDraft({ question: '', essay: '', images: [], questionImages: [] });
}

function buildTabbar() {
  const bar = $('#tabbar');
  if (!bar) return;
  bar.innerHTML = ROUTES.map((route) =>
    '<button class="tab" type="button" data-route="' + route + '" aria-label="' + TAB_LABELS[route] + '">' +
    icon(TAB_ICONS[route]) + '<span>' + TAB_LABELS[route] + '</span></button>'
  ).join('');
  bar.addEventListener('click', (event) => {
    const btn = event.target.closest('.tab');
    if (btn && btn.dataset.route) app.go(btn.dataset.route);
  });
}

function render() {
  const route = routeFromHash();
  const view = VIEWS[route];
  const current = document.getElementById('view');
  if (!current) return;
  /* 每次都用全新的节点，避免旧的事件监听器残留（重复提交、列表串台） */
  const root = document.createElement('main');
  root.id = 'view';
  root.className = 'view';
  root.innerHTML = view.render(app);
  current.replaceWith(root);
  if (view.mount) view.mount(root, app);
  const shell = $('#app');
  if (shell) shell.dataset.route = route;
  $$('.tab').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.route === route));
  window.scrollTo(0, 0);
  tickClock();
  paintStream();
}

function paintStream() {
  const box = $('#stream-box');
  if (!box || !job || job.status !== 'running') return;
  box.textContent = job.raw || '';
  box.scrollTop = box.scrollHeight;
}

async function startCorrection() {
  if (job && job.status === 'running') {
    toast('正在批改中，请稍候');
    app.go('review');
    return;
  }
  const settings = getSettings();
  const provider = getActiveProvider(settings);
  const draft = getDraft();
  const model = currentModelInfo();
  const essay = (draft.essay || '').trim();
  const images = Array.isArray(draft.images) ? draft.images : [];
  const questionImages = Array.isArray(draft.questionImages) ? draft.questionImages : [];
  const useImages = model.vision ? images : [];
  const useQuestionImages = model.vision ? questionImages : [];

  if (!provider || !provider.model) {
    toast('请先在设置里获取并选择一个模型');
    app.go('settings');
    return;
  }
  if (!provider.apiKey) {
    toast('还没有填写 API Key，请先到设置里配置');
    app.go('settings');
    return;
  }
  if (!essay && !useImages.length) {
    toast('请先输入作文，或上传作文图片');
    return;
  }
  if ((images.length || questionImages.length) && !model.vision) {
    toast('当前模型不支持图片，本次只提交文字');
  }

  const messages = buildMessages({
    prompt: settings.prompt,
    question: draft.question,
    essay: draft.essay,
    images: useImages,
    questionImages: useQuestionImages
  });

  const token = {
    status: 'running',
    raw: '',
    startedAt: Date.now(),
    model: provider.model,
    question: draft.question || '',
    essay: draft.essay || '',
    images: images,
    questionImages: questionImages
  };
  job = token;
  app.go('review');

  try {
    const content = await chatCompletion({
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      model: provider.model,
      messages: messages,
      temperature: settings.temperature,
      onDelta(piece) {
        if (job !== token) return;
        token.raw += piece;
        paintStream();
      }
    });
    if (job !== token) return;

    const parsed = parseResult(content);
    let record = null;
    try {
      record = addHistory({
        createdAt: token.startedAt,
        model: provider.model,
        question: token.question,
        essay: token.essay,
        images: token.images,
        questionImages: token.questionImages,
        score: parsed ? parsed.score : null,
        result: parsed,
        raw: content
      });
    } catch (err) {
      toast(err && err.message ? err.message : '历史记录保存失败', 'error');
    }

    job = {
      status: 'done',
      raw: content,
      result: parsed,
      recordId: record ? record.id : '',
      startedAt: token.startedAt,
      model: provider.model,
      question: token.question,
      essay: token.essay,
      images: token.images,
      questionImages: token.questionImages
    };
    saveResult({
      historyId: record ? record.id : '',
      question: token.question,
      essay: token.essay,
      images: token.images,
      questionImages: token.questionImages,
      model: provider.model,
      createdAt: token.startedAt,
      parsed: parsed,
      raw: content
    });
    render();
    toast('批改完成', 'success');
  } catch (err) {
    if (job !== token) return;
    job = {
      status: 'error',
      error: (err && err.message) || '批改失败，请稍后再试',
      detail: (err && err.detail) || '',
      startedAt: token.startedAt,
      question: token.question,
      essay: token.essay
    };
    render();
  }
}

function openHistory(item) {
  if (!item) return;
  job = null;
  saveDraft({
    question: item.question || '',
    essay: item.essay || '',
    images: Array.isArray(item.images) ? item.images : [],
    questionImages: Array.isArray(item.questionImages) ? item.questionImages : []
  });
  const parsed = item.result || parseResult(item.raw || '');
  saveResult({
    historyId: item.id,
    question: item.question || '',
    essay: item.essay || '',
    images: Array.isArray(item.images) ? item.images : [],
    questionImages: Array.isArray(item.questionImages) ? item.questionImages : [],
    model: item.model || '',
    createdAt: item.createdAt || Date.now(),
    parsed: parsed,
    raw: item.raw || ''
  });
  app.go('review');
}

function tickClock() {
  const now = new Date();
  $$('[data-clock-time]').forEach((el) => { el.textContent = fmtClock(now); });
  $$('[data-clock-date]').forEach((el) => { el.textContent = fmtDate(now); });
}

function boot() {
  buildTabbar();
  render();
  tickClock();
  setInterval(tickClock, 15000);

  window.addEventListener('hashchange', render);

  window.addEventListener('error', (event) => {
    const box = $('#boot-error');
    if (!box) return;
    box.hidden = false;
    box.textContent = '运行出错：' + (event.message || '未知错误');
  });
  window.addEventListener('unhandledrejection', (event) => {
    const box = $('#boot-error');
    if (!box) return;
    box.hidden = false;
    box.textContent = '运行出错：' + ((event.reason && event.reason.message) || event.reason || '未知错误');
  });

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
}

boot();

export default app;
