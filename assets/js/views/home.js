/* 首页：模型选择 / 题目 / 作文 / 提交批改 */
import {
  $, $$, icon, logoSvg, escapeHtml, fmtDateTime, toast,
  autoGrow, countWords, compressImage, debounce
} from '../utils.js';
import { getSettings, getActiveProvider, updateProvider, getDraft, saveDraft, getResult, currentModelInfo } from '../store.js';

export function render() {
  const settings = getSettings();
  const draft = getDraft();
  const result = getResult();
  const provider = getActiveProvider(settings);
  const model = currentModelInfo();
  const models = Array.isArray(provider.models) ? provider.models : [];
  const images = Array.isArray(draft.images) ? draft.images : [];
  const viewing = !!(result && result.historyId);

  const banner = viewing
    ? '<div class="draft-banner">' + icon('clock') +
      '<span>正在查看 <b>' + escapeHtml(fmtDateTime(result.createdAt)) + '</b> 的历史批改</span>' +
      '<button class="icon-btn" type="button" data-act="clear-view" aria-label="新建批改">' + icon('close') + '</button></div>'
    : '';

  const options = models.length
    ? models.map((m) =>
        '<option value="' + escapeHtml(m.name) + '"' + (m.name === provider.model ? ' selected' : '') + '>' +
        escapeHtml(m.name) + (m.vision ? ' · 视觉' : '') + '</option>'
      ).join('')
    : '<option value="">未添加模型</option>';
  const visionHint = !models.length
    ? '还没有模型，请到「设置」里获取可用模型'
    : (model.vision ? '当前模型支持图片识别' : '当前模型仅支持文本，图片请选带「视觉」的模型');

  const thumbs = images.map((src, index) =>
    '<div class="thumb"><img src="' + src + '" alt="作文图片 ' + (index + 1) + '" />' +
    '<button class="thumb-x" type="button" data-remove="' + index + '" aria-label="删除图片">' + icon('close') + '</button></div>'
  ).join('');

  return '' +
    '<header class="hero">' +
      '<div class="hero-logo">' + logoSvg() + '</div>' +
      '<div class="hero-text">' +
        '<div class="hero-name">作文批改器 <span class="badge">考研</span></div>' +
        '<div class="hero-sub">选模型 · 贴作文 · 得批改</div>' +
      '</div>' +
      '<div class="hero-clock">' +
        '<div class="hero-time" data-clock-time>--:--</div>' +
        '<div class="hero-date" data-clock-date>—</div>' +
      '</div>' +
    '</header>' +
    banner +
    '<div class="section-title"><h1>开始批改</h1><span class="muted">今天也要认真写一篇</span></div>' +

    '<section class="card">' +
      '<div class="card-head">' +
        '<div class="card-icon">' + icon('layers') + '</div>' +
        '<div><h2 class="card-title">模型选择</h2><p class="card-desc">决定批改质量与是否识别图片</p></div>' +
        '<button class="card-action" type="button" data-act="to-settings">配置</button>' +
      '</div>' +
      '<div class="model-row"><select class="select" id="model-select" aria-label="选择模型"' + (models.length ? '' : ' disabled') + '>' + options + '</select></div>' +
      '<p class="vision-flag" id="vision-hint">' + icon('image') + '<span>' + visionHint + '</span></p>' +
    '</section>' +

    '<section class="card">' +
      '<div class="card-head">' +
        '<div class="card-icon">' + icon('book') + '</div>' +
        '<div><h2 class="card-title">题目</h2><p class="card-desc">作文题目或写作要求（可选）</p></div>' +
      '</div>' +
      '<textarea class="textarea" id="question" rows="2" placeholder="例如：Write an essay on the importance of ..."></textarea>' +
    '</section>' +

    '<section class="card">' +
      '<div class="card-head">' +
        '<div class="card-icon">' + icon('edit') + '</div>' +
        '<div><h2 class="card-title">作文</h2><p class="card-desc">粘贴文本，或上传作文照片</p></div>' +
        '<span class="field-hint" id="essay-count">0 词</span>' +
      '</div>' +
      '<textarea class="textarea" id="essay" rows="6" placeholder="在此粘贴作文内容，或拍照后交由 AI 识别…"></textarea>' +
      (thumbs ? '<div class="thumbs" id="thumbs">' + thumbs + '</div>' : '') +
      '<button class="uploader" type="button" data-act="add-image">' + icon('camera') + ' 拍照 / 上传作文图片</button>' +
      '<input type="file" id="file-input" accept="image/*" multiple hidden />' +
    '</section>' +

    '<button class="submit" type="button" data-act="submit">' +
      icon('sparkle') + '提交批改' +
    '</button>' +
    '<p class="submit-note">' + icon('lock') + '作文与密钥仅保存在本机浏览器</p>';
}

export function mount(root, app) {
  const draft = getDraft();
  const questionEl = $('#question', root);
  const essayEl = $('#essay', root);
  const countEl = $('#essay-count', root);

  questionEl.value = draft.question || '';
  essayEl.value = draft.essay || '';
  autoGrow(questionEl, 220);
  autoGrow(essayEl, 420);

  const updateCount = () => {
    const n = countWords(essayEl.value);
    countEl.textContent = n + ' 词';
  };
  updateCount();

  const persist = debounce(() => saveDraft({ question: questionEl.value, essay: essayEl.value }), 350);
  questionEl.addEventListener('input', persist);
  essayEl.addEventListener('input', () => { persist(); updateCount(); });

  const settings = getSettings();
  const provider = getActiveProvider(settings);
  const select = $('#model-select', root);
  select.value = provider.model;
  select.addEventListener('change', () => {
    const next = updateProvider(provider.id, { model: select.value });
    const nextProvider = next.providers.find((p) => p.id === provider.id);
    const info = nextProvider.models.find((m) => m.name === select.value);
    const hint = $('#vision-hint', root);
    if (hint) {
      hint.innerHTML = icon('image') + '<span>' + (info && info.vision
        ? '当前模型支持图片识别'
        : '当前模型仅支持文本，图片请选带「视觉」的模型') + '</span>';
    }
  });

  root.addEventListener('click', (event) => {
    const target = event.target.closest('[data-act], [data-remove]');
    if (!target) return;
    if (target.hasAttribute('data-remove')) {
      const index = Number(target.getAttribute('data-remove'));
      const now = getDraft();
      const images = (now.images || []).slice();
      images.splice(index, 1);
      saveDraft({ images });
      app.refresh();
      return;
    }
    const act = target.getAttribute('data-act');
    if (act === 'to-settings') app.go('settings');
    else if (act === 'clear-view') app.clearViewing();
    else if (act === 'submit') app.startCorrection();
    else if (act === 'add-image') $('#file-input', root).click();
  });

  essayEl.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      app.startCorrection();
    }
  });

  const input = $('#file-input', root);
  input.addEventListener('change', async () => {
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) return;
    const now = getDraft();
    const images = (now.images || []).slice();
    for (const file of files) {
      if (images.length >= 3) { toast('最多上传 3 张图片'); break; }
      try {
        const data = await compressImage(file);
        images.push(data);
      } catch (err) {
        toast(err && err.message ? err.message : '图片处理失败', 'error');
      }
    }
    saveDraft({ images });
    app.refresh();
  });
}
