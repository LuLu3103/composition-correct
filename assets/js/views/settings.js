/* 设置页：接口配置、提示词、数据备份、关于 */
import {
  $, $$, icon, logoSvg, escapeHtml, toast, openSheet, confirmDialog,
  downloadFile, debounce, fmtClock, guessVision
} from '../utils.js';
import {
  PROVIDERS, APP_VERSION, DEFAULT_PROMPT, getSettings, saveSettings,
  exportBackup, importBackup, wipeAll, listHistory
} from '../store.js';
import { testConnection, listModels } from '../api.js';

function groupTitle(text) {
  return '<div class="group-title">' + escapeHtml(text) + '</div>';
}

export function render() {
  const s = getSettings();
  const providers = PROVIDERS.map((p) =>
    '<button class="pill' + (p.id === s.provider ? ' is-on' : '') + '" type="button" data-provider="' + p.id + '">' + escapeHtml(p.name) + '</button>'
  ).join('');

  const modelList = (s.models || []).map((m) =>
    '<div class="model-item' + (m.name === s.model ? ' is-on' : '') + '">' +
      '<input type="radio" name="model-pick" value="' + escapeHtml(m.name) + '"' + (m.name === s.model ? ' checked' : '') + ' />' +
      '<span class="model-name">' + escapeHtml(m.name) + '</span>' +
      '<button class="model-tag' + (m.vision ? '' : ' is-off') + '" type="button" data-act="toggle-vision" data-name="' + escapeHtml(m.name) + '" title="切换是否支持图片">' + (m.vision ? '视觉' : '文本') + '</button>' +
      '<button class="icon-btn" type="button" data-act="del-model" data-name="' + escapeHtml(m.name) + '" aria-label="移除模型">' + icon('close') + '</button>' +
    '</div>'
  ).join('');
  const models = (s.models || []).length
    ? '<div class="models-list">' + modelList + '</div>'
    : '<div class="model-empty">' + icon('layers') + '<span>还没有模型，点下面的按钮从服务商获取</span></div>';

  const historyCount = listHistory().length;

  return '<header class="page-head">' +
      '<div class="hero-logo">' + logoSvg() + '</div>' +
      '<div><div class="page-head-title">设置</div><div class="page-head-sub">接口 · 提示词 · 数据</div></div>' +
      '<div class="page-head-right"><span class="badge">V' + APP_VERSION + '</span></div>' +
    '</header>' +

    groupTitle('模型与接口') +
    '<section class="setting-card">' +
      '<div class="setting-body">' +
        '<div class="provider-chips">' + providers + '</div>' +
        '<div class="setting-row" style="padding:0 0 10px;border:0;display:block">' +
          '<div class="field-row"><span class="field-label">接口地址</span><span class="field-hint">OpenAI 兼容</span></div>' +
          '<input class="input" id="base-url" spellcheck="false" placeholder="https://api.deepseek.com/v1" value="' + escapeHtml(s.baseUrl) + '" />' +
        '</div>' +
        '<div class="setting-row" style="padding:0;border:0;display:block">' +
          '<div class="field-row"><span class="field-label">API Key</span><span class="field-hint">' + icon('lock') + ' 仅存本机</span></div>' +
          '<div class="input-group">' +
            '<input class="input" id="api-key" type="password" autocomplete="off" spellcheck="false" placeholder="sk-…" value="' + escapeHtml(s.apiKey) + '" />' +
            '<button class="icon-btn" type="button" data-act="toggle-key" aria-label="显示或隐藏密钥">' + icon('eye') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="setting-body">' +
        '<div class="field-row"><span class="field-label">可选模型</span><span class="field-hint">选中的就是首页默认模型</span></div>' +
        models +
        '<button class="btn btn-ghost btn-block models-fetch" type="button" data-act="fetch-models" id="fetch-btn">' + icon('refresh') + ' 获取可用模型</button>' +
        '<details class="manual-add">' +
          '<summary>手动添加模型名称</summary>' +
          '<div class="input-group" style="margin-top:10px">' +
            '<input class="input" id="new-model" spellcheck="false" placeholder="例如：deepseek-chat" />' +
            '<button class="icon-btn" type="button" data-act="add-model" aria-label="添加模型">' + icon('plus') + '</button>' +
          '</div>' +
        '</details>' +
        '<div class="input-group" style="margin-top:10px">' +
          '<button class="btn btn-ghost btn-block" type="button" data-act="test">' + icon('refresh') + ' 测试连接</button>' +
        '</div>' +
        '<p class="setting-desc" id="test-status" style="margin:8px 0 0">Key 只通过当前浏览器直接发给你选择的服务商，不会经过其他服务器。</p>' +
      '</div>' +
    '</section>' +

    groupTitle('提示词') +
    '<section class="setting-card">' +
      '<div class="setting-body">' +
        '<div class="field-row"><span class="field-label">批改提示词</span><span class="field-hint" id="prompt-status">修改后自动保存</span></div>' +
        '<textarea class="textarea prompt-area" id="prompt-input" spellcheck="false">' + escapeHtml(s.prompt) + '</textarea>' +
        '<div class="input-group" style="margin-top:10px">' +
          '<button class="btn btn-ghost btn-block" type="button" data-act="reset-prompt">' + icon('refresh') + ' 恢复默认提示词</button>' +
        '</div>' +
      '</div>' +
    '</section>' +

    groupTitle('数据') +
    '<section class="setting-card">' +
      '<div class="setting-row" data-act="export" role="button" tabindex="0">' +
        '<div class="setting-icon">' + icon('download') + '</div>' +
        '<div class="setting-text"><div class="setting-name">导出备份</div><div class="setting-desc">把设置与 ' + historyCount + ' 条历史保存为 JSON</div></div>' +
        '<span class="setting-chevron">' + icon('chevronRight') + '</span>' +
      '</div>' +
      '<div class="setting-row" data-act="import" role="button" tabindex="0">' +
        '<div class="setting-icon">' + icon('upload') + '</div>' +
        '<div class="setting-text"><div class="setting-name">导入备份</div><div class="setting-desc">从 JSON 文件恢复设置与历史</div></div>' +
        '<span class="setting-chevron">' + icon('chevronRight') + '</span>' +
      '</div>' +
      '<div class="setting-row" data-act="wipe" role="button" tabindex="0">' +
        '<div class="setting-icon" style="background:#fff1f1;color:#e5484d">' + icon('trash') + '</div>' +
        '<div class="setting-text"><div class="setting-name" style="color:#e5484d">清空本地数据</div><div class="setting-desc">删除全部设置、Key 与历史，不可恢复</div></div>' +
        '<span class="setting-chevron">' + icon('chevronRight') + '</span>' +
      '</div>' +
      '<input type="file" id="import-input" accept="application/json,.json" hidden />' +
    '</section>' +

    groupTitle('关于') +
    '<section class="setting-card">' +
      '<div class="setting-body">' +
        '<details>' +
          '<summary class="setting-name" style="cursor:pointer">使用说明</summary>' +
          '<div class="about-text" style="margin-top:10px">' +
            '<p>1. 在首页选择一个模型，填写题目与作文（文本或图片）。</p>' +
            '<p>2. 点击「提交批改」，AI 会返回修改建议、修改作文与作文评分。</p>' +
            '<p>3. 每次批改都会自动存进「历史」，点开一条即可回看当时的题目、作文与批改结果。</p>' +
            '<p>4. 图片批改需要选择带「视觉」标记的模型，例如 gpt-4o、qwen-vl-max、glm-4v-plus。</p>' +
            '<p>5. 如果提示「网络连接失败」，通常是服务商不允许浏览器跨域调用，可以换一家支持 CORS 的服务商。</p>' +
          '</div>' +
        '</details>' +
      '</div>' +
      '<div class="setting-body">' +
        '<details>' +
          '<summary class="setting-name" style="cursor:pointer">网站声明</summary>' +
          '<div class="about-text" style="margin-top:10px">' +
            '<p>本工具是纯前端页面：作文、批改结果、API Key 都只保存在你当前浏览器的本地存储中，不会上传到本项目的服务器（本项目没有服务器）。</p>' +
            '<p>提交批改时，作文内容与提示词会直接从你的浏览器发送到你配置的 AI 服务商；请自行确认该服务商的隐私政策与资费。</p>' +
            '<p>AI 批改结果仅供学习参考，不代表真实考试评分；因使用本工具产生的任何后果由使用者自行承担。</p>' +
            '<p>界面与代码开源在 GitHub，欢迎自行部署与修改。</p>' +
          '</div>' +
        '</details>' +
      '</div>' +
      '<div class="setting-row">' +
        '<div class="setting-icon">' + icon('info') + '</div>' +
        '<div class="setting-text"><div class="setting-name">版本</div><div class="setting-desc">作文批改器 · 考研</div></div>' +
        '<span class="version-line"><b>V' + APP_VERSION + '</b></span>' +
      '</div>' +
    '</section>';
}

function openModelPicker(names, app) {
  const current = getSettings();
  const existing = current.models.map((m) => m.name);
  const rows = names.map((name) => {
    const checked = existing.indexOf(name) >= 0 ? ' checked' : '';
    return '<label class="picker-row" data-name="' + escapeHtml(name) + '">' +
      '<input type="checkbox" value="' + escapeHtml(name) + '"' + checked + ' />' +
      '<span class="picker-name">' + escapeHtml(name) + '</span>' +
      (guessVision(name) ? '<span class="model-tag">视觉</span>' : '') +
      '</label>';
  }).join('');

  openSheet({
    title: '选择要添加的模型',
    html: '<input class="input" id="picker-search" placeholder="搜索模型名称…" spellcheck="false" />' +
      '<div class="picker-list" id="picker-list">' + rows + '</div>' +
      '<div class="sheet-actions">' +
        '<button class="btn btn-ghost" type="button" data-act="cancel">取消</button>' +
        '<button class="btn btn-primary" type="button" data-act="confirm" disabled>添加</button>' +
      '</div>',
    onMount(root, close) {
      const list = root.querySelector('#picker-list');
      const confirm = root.querySelector('[data-act="confirm"]');
      const search = root.querySelector('#picker-search');

      const update = () => {
        const picked = list.querySelectorAll('input:checked').length;
        confirm.textContent = picked ? '添加 ' + picked + ' 个模型' : '添加';
        confirm.disabled = picked === 0;
      };
      update();
      list.addEventListener('change', update);

      search.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        list.querySelectorAll('.picker-row').forEach((row) => {
          const hit = !q || row.getAttribute('data-name').toLowerCase().indexOf(q) >= 0;
          row.classList.toggle('hidden', !hit);
        });
      });

      root.querySelector('[data-act="cancel"]').addEventListener('click', close);
      confirm.addEventListener('click', () => {
        const picked = Array.from(list.querySelectorAll('input:checked')).map((input) => input.value);
        if (!picked.length) return;
        const s = getSettings();
        const models = s.models.slice();
        picked.forEach((name) => {
          if (!models.some((m) => m.name === name)) models.push({ name: name, vision: guessVision(name) });
        });
        saveSettings({ models: models, model: s.model || models[0].name });
        close();
        app.refresh();
        toast('已添加 ' + picked.length + ' 个模型', 'success');
      });
    }
  });
}

export function mount(root, app) {
  const persist = debounce((patch) => {
    try {
      saveSettings(patch);
    } catch (err) {
      toast(err && err.message ? err.message : '保存失败', 'error');
    }
  }, 400);

  const baseInput = $('#base-url', root);
  const keyInput = $('#api-key', root);
  const promptInput = $('#prompt-input', root);

  baseInput.addEventListener('input', () => persist({ baseUrl: baseInput.value.trim() }));

  keyInput.addEventListener('input', () => {
    persist({ apiKey: keyInput.value.trim() });
  });

  promptInput.addEventListener('input', () => {
    persist({ prompt: promptInput.value });
    const status = $('#prompt-status', root);
    if (status) status.textContent = '已保存 ' + fmtClock();
  });

  root.addEventListener('change', (event) => {
    const radio = event.target.closest('input[name="model-pick"]');
    if (radio) {
      saveSettings({ model: radio.value });
      const items = $$('.model-item', root);
      items.forEach((el) => el.classList.toggle('is-on', !!el.querySelector('input:checked')));
      toast('默认模型：' + radio.value, 'success');
    }
  });

  root.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-act], [data-provider]');
    if (!target) return;

    if (target.hasAttribute('data-provider')) {
      const preset = PROVIDERS.find((p) => p.id === target.getAttribute('data-provider'));
      if (!preset) return;
      const current = getSettings();
      saveSettings({ provider: preset.id, baseUrl: preset.baseUrl || current.baseUrl });
      app.refresh();
      toast('已切换到 ' + preset.name + '，可点「获取可用模型」');
      return;
    }

    const act = target.getAttribute('data-act');

    if (act === 'toggle-key') {
      const showing = keyInput.type === 'text';
      keyInput.type = showing ? 'password' : 'text';
      target.innerHTML = icon(showing ? 'eye' : 'eyeOff');
      return;
    }

    if (act === 'add-model') {
      const input = $('#new-model', root);
      const name = (input.value || '').trim();
      if (!name) { toast('先填写模型名称'); return; }
      const s = getSettings();
      if (s.models.some((m) => m.name === name)) { toast('这个模型已经在列表里了'); return; }
      const models = s.models.concat([{ name: name, vision: guessVision(name) }]);
      saveSettings({ models: models, model: s.model || name });
      app.refresh();
      toast('已添加 ' + name, 'success');
      return;
    }

    if (act === 'toggle-vision') {
      const name = target.getAttribute('data-name');
      const s = getSettings();
      const models = s.models.map((m) => (m.name === name ? { name: m.name, vision: !m.vision } : m));
      saveSettings({ models: models });
      app.refresh();
      toast(name + (models.find((m) => m.name === name).vision ? ' 可识别图片' : ' 仅文本'), 'success');
      return;
    }

    if (act === 'del-model') {
      const name = target.getAttribute('data-name');
      const s = getSettings();
      if (s.models.length <= 1) { toast('至少保留一个模型'); return; }
      const models = s.models.filter((m) => m.name !== name);
      saveSettings({ models: models, model: s.model === name ? models[0].name : s.model });
      app.refresh();
      return;
    }

    if (act === 'fetch-models') {
      const s = getSettings();
      if (!s.apiKey) { toast('先填写 API Key，再获取模型列表'); return; }
      const label = target.innerHTML;
      target.setAttribute('disabled', 'disabled');
      target.textContent = '正在获取模型列表…';
      try {
        const names = await listModels({ baseUrl: s.baseUrl, apiKey: s.apiKey });
        target.removeAttribute('disabled');
        target.innerHTML = label;
        openModelPicker(names, app);
      } catch (err) {
        target.removeAttribute('disabled');
        target.innerHTML = label;
        toast((err && err.message) || '获取模型列表失败', 'error');
      }
      return;
    }

    if (act === 'test') {
      const s = getSettings();
      const status = $('#test-status', root);
      if (!s.apiKey) { toast('先填写 API Key'); return; }
      target.setAttribute('disabled', 'disabled');
      if (status) status.textContent = '正在连接 ' + s.model + ' …';
      try {
        const ms = await testConnection({ baseUrl: s.baseUrl, apiKey: s.apiKey, model: s.model });
        if (status) status.textContent = '连接成功 ✓ 用时 ' + (ms / 1000).toFixed(1) + ' 秒';
        toast('连接成功', 'success');
      } catch (err) {
        const msg = (err && err.message) || '连接失败';
        if (status) status.textContent = msg;
        toast(msg, 'error');
      } finally {
        target.removeAttribute('disabled');
      }
      return;
    }

    if (act === 'reset-prompt') {
      const ok = await confirmDialog({
        title: '恢复默认提示词？',
        message: '当前修改过的提示词会被覆盖。',
        confirmText: '恢复默认'
      });
      if (ok) {
        saveSettings({ prompt: DEFAULT_PROMPT });
        app.refresh();
        toast('已恢复默认提示词', 'success');
      }
      return;
    }

    if (act === 'export') {
      openSheet({
        title: '导出备份',
        html: '<p class="sheet-text">备份包含设置与历史记录。是否同时导出 API Key？</p>' +
          '<div class="sheet-actions">' +
            '<button class="btn btn-ghost" type="button" data-act="export-safe">不含 Key</button>' +
            '<button class="btn btn-primary" type="button" data-act="export-full">含 Key</button>' +
          '</div>',
        onMount(sheet, close) {
          const doExport = (includeKey) => {
            const data = exportBackup(includeKey);
            const stamp = new Date().toISOString().slice(0, 10);
            downloadFile('essay-grader-backup-' + stamp + '.json', JSON.stringify(data, null, 2));
            close();
            toast('备份已开始下载', 'success');
          };
          sheet.querySelector('[data-act="export-safe"]').addEventListener('click', () => doExport(false));
          sheet.querySelector('[data-act="export-full"]').addEventListener('click', () => doExport(true));
        }
      });
      return;
    }

    if (act === 'import') {
      $('#import-input', root).click();
      return;
    }

    if (act === 'wipe') {
      const ok = await confirmDialog({
        title: '清空本地数据？',
        message: '设置、API Key、全部历史记录都会被删除，且无法恢复。',
        confirmText: '全部清空',
        danger: true
      });
      if (ok) {
        wipeAll();
        app.refresh();
        toast('已清空本地数据', 'success');
      }
      return;
    }
  });

  const importInput = $('#import-input', root);
  importInput.addEventListener('change', async () => {
    const file = (importInput.files || [])[0];
    importInput.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      importBackup(data);
      app.refresh();
      toast('备份已导入', 'success');
    } catch (err) {
      toast('导入失败：' + ((err && err.message) || '文件格式不正确'), 'error');
    }
  });
}
