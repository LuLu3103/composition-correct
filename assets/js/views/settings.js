/* 设置页：多服务商配置、提示词、数据备份、关于 */
import {
  $, $$, icon, logoSvg, escapeHtml, toast, openSheet, confirmDialog,
  downloadFile, debounce, fmtClock, guessVision
} from '../utils.js';
import {
  APP_VERSION, DEFAULT_PROMPT, getSettings, getActiveProvider, saveSettings,
  updateProvider, addProvider, removeProvider, exportBackup, importBackup, wipeAll, listHistory
} from '../store.js';
import { testConnection, listModels } from '../api.js';

function groupTitle(text) {
  return '<div class="group-title">' + escapeHtml(text) + '</div>';
}

export function render() {
  const s = getSettings();
  const active = getActiveProvider(s);

  const providerOptions = s.providers.map((p) =>
    '<option value="' + escapeHtml(p.id) + '"' + (p.id === active.id ? ' selected' : '') + '>' +
    escapeHtml(p.name) + (p.apiKey ? '' : '（未配置 Key）') + '</option>'
  ).join('');

  const modelList = active.models.map((m) =>
    '<div class="model-item' + (m.name === active.model ? ' is-on' : '') + '">' +
      '<input type="radio" name="model-pick" value="' + escapeHtml(m.name) + '"' + (m.name === active.model ? ' checked' : '') + ' />' +
      '<span class="model-name">' + escapeHtml(m.name) + '</span>' +
      '<button class="model-tag' + (m.vision ? '' : ' is-off') + '" type="button" data-act="toggle-vision" data-name="' + escapeHtml(m.name) + '" title="切换是否支持图片">' + (m.vision ? '视觉' : '文本') + '</button>' +
      '<button class="icon-btn" type="button" data-act="del-model" data-name="' + escapeHtml(m.name) + '" aria-label="移除模型">' + icon('close') + '</button>' +
    '</div>'
  ).join('');
  const models = active.models.length
    ? '<div class="models-list">' + modelList + '</div>'
    : '<div class="model-empty">' + icon('layers') + '<span>还没有模型，点下面的按钮从服务商获取</span></div>';

  const historyCount = listHistory().length;

  return '<header class="page-head">' +
      '<div class="hero-logo">' + logoSvg() + '</div>' +
      '<div><div class="page-head-title">设置</div><div class="page-head-sub">服务商 · 提示词 · 数据</div></div>' +
      '<div class="page-head-right"><span class="badge">V' + APP_VERSION + '</span></div>' +
    '</header>' +

    groupTitle('服务商') +
    '<section class="setting-card">' +
      '<div class="setting-body">' +
        '<div class="field-row"><span class="field-label">当前服务商</span>' +
          '<button class="card-action" type="button" data-act="new-provider">+ 新建自定义</button>' +
        '</div>' +
        '<select class="select" id="provider-select">' + providerOptions + '</select>' +

        '<div class="field-row" style="margin-top:14px"><span class="field-label">名称</span>' +
          (active.builtin ? '<span class="field-hint">内置服务商</span>' : '<span class="field-hint">可修改</span>') +
        '</div>' +
        '<input class="input" id="provider-name" spellcheck="false" value="' + escapeHtml(active.name) + '"' + (active.builtin ? ' disabled' : '') + ' />' +

        '<div class="field-row" style="margin-top:14px"><span class="field-label">接口地址</span><span class="field-hint">OpenAI 兼容</span></div>' +
        '<input class="input" id="base-url" spellcheck="false" placeholder="https://api.example.com/v1" value="' + escapeHtml(active.baseUrl) + '" />' +

        '<div class="field-row" style="margin-top:14px"><span class="field-label">API Key</span><span class="field-hint">' + icon('lock') + ' 仅存本机</span></div>' +
        '<div class="input-group">' +
          '<input class="input" id="api-key" type="password" autocomplete="off" spellcheck="false" placeholder="sk-…" value="' + escapeHtml(active.apiKey) + '" />' +
          '<button class="icon-btn" type="button" data-act="toggle-key" aria-label="显示或隐藏密钥">' + icon('eye') + '</button>' +
        '</div>' +

        '<p class="setting-desc" id="save-hint">修改后点「保存配置」才会生效</p>' +
        '<div class="save-row">' +
          '<button class="btn btn-primary" type="button" data-act="save-provider" id="save-btn" disabled>保存配置</button>' +
          (active.builtin ? '' : '<button class="btn btn-ghost btn-danger-soft" type="button" data-act="delete-provider">删除</button>') +
        '</div>' +
      '</div>' +

      '<div class="setting-body">' +
        '<div class="field-row"><span class="field-label">可选模型</span><span class="field-hint">选中的是首页默认</span></div>' +
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
            '<p>1. 在「服务商」下拉里选择要用的平台，填好 API Key 后点「保存配置」。</p>' +
            '<p>2. 点「获取可用模型」，在列表里勾选模型加入；也可以手动填写模型名。</p>' +
            '<p>3. 每个服务商分别保存自己的地址、Key 和模型，切换时不会互相覆盖。</p>' +
            '<p>4. 需要多个自建接口时，点「+ 新建自定义」保存多套配置。</p>' +
            '<p>5. 图片批改要选带「视觉」标记的模型；点标签可切换。</p>' +
            '<p>6. 若提示「网络连接失败」，通常是服务商不允许浏览器跨域调用，换一家即可。</p>' +
          '</div>' +
        '</details>' +
      '</div>' +
      '<div class="setting-body">' +
        '<details>' +
          '<summary class="setting-name" style="cursor:pointer">网站声明</summary>' +
          '<div class="about-text" style="margin-top:10px">' +
            '<p>本工具是纯前端页面：作文、批改结果、服务商配置与 API Key 都只保存在你当前浏览器的本地存储中，不会上传到本项目的服务器（本项目没有服务器）。</p>' +
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

function openNewProvider(app) {
  openSheet({
    title: '新建自定义服务商',
    html: '<div class="field-row"><span class="field-label">名称</span></div>' +
      '<input class="input" id="np-name" spellcheck="false" placeholder="例如：我的中转站" />' +
      '<div class="field-row" style="margin-top:12px"><span class="field-label">接口地址</span></div>' +
      '<input class="input" id="np-url" spellcheck="false" placeholder="https://api.example.com/v1" />' +
      '<div class="field-row" style="margin-top:12px"><span class="field-label">API Key</span></div>' +
      '<input class="input" id="np-key" type="password" autocomplete="off" spellcheck="false" placeholder="sk-…" />' +
      '<div class="sheet-actions">' +
        '<button class="btn btn-ghost" type="button" data-act="cancel">取消</button>' +
        '<button class="btn btn-primary" type="button" data-act="ok">保存并切换</button>' +
      '</div>',
    onMount(root, close) {
      const name = root.querySelector('#np-name');
      const url = root.querySelector('#np-url');
      const key = root.querySelector('#np-key');
      name.focus();
      const save = () => {
        const urlValue = url.value.trim();
        if (!name.value.trim()) { toast('给服务商起个名字'); return; }
        if (!/^https?:\/\//i.test(urlValue)) { toast('接口地址需要以 http:// 或 https:// 开头'); return; }
        addProvider({ name: name.value.trim(), baseUrl: urlValue, apiKey: key.value.trim() });
        close();
        app.refresh();
        toast('已新建并切换', 'success');
      };
      root.querySelector('[data-act="ok"]').addEventListener('click', save);
      root.querySelector('[data-act="cancel"]').addEventListener('click', close);
      key.addEventListener('keydown', (event) => { if (event.key === 'Enter') save(); });
    }
  });
}

function openModelPicker(names, providerId, app) {
  const provider = getSettings().providers.find((p) => p.id === providerId);
  const existing = provider ? provider.models.map((m) => m.name) : [];
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
        const fresh = getSettings().providers.find((p) => p.id === providerId);
        const models = fresh.models.slice();
        picked.forEach((name) => {
          if (!models.some((m) => m.name === name)) models.push({ name: name, vision: guessVision(name) });
        });
        updateProvider(providerId, { models: models, model: fresh.model || models[0].name });
        close();
        app.refresh();
        toast('已添加 ' + picked.length + ' 个模型', 'success');
      });
    }
  });
}

export function mount(root, app) {
  const active = getActiveProvider(getSettings());
  let dirty = false;

  const nameInput = $('#provider-name', root);
  const baseInput = $('#base-url', root);
  const keyInput = $('#api-key', root);
  const saveBtn = $('#save-btn', root);
  const saveHint = $('#save-hint', root);

  const markDirty = () => {
    if (dirty) return;
    dirty = true;
    if (saveBtn) saveBtn.removeAttribute('disabled');
    if (saveHint) { saveHint.textContent = '有未保存的修改'; saveHint.classList.add('is-dirty'); }
  };
  [nameInput, baseInput, keyInput].forEach((el) => {
    if (el && !el.disabled) el.addEventListener('input', markDirty);
  });

  const providerSelect = $('#provider-select', root);
  providerSelect.addEventListener('change', async () => {
    if (dirty) {
      const ok = await confirmDialog({
        title: '放弃未保存的修改？',
        message: '切换服务商会丢掉刚才输入的名称、地址或 Key。',
        confirmText: '放弃并切换'
      });
      if (!ok) { providerSelect.value = active.id; return; }
    }
    saveSettings({ activeId: providerSelect.value });
    app.refresh();
  });

  const promptInput = $('#prompt-input', root);
  const persistPrompt = debounce((value) => {
    try { saveSettings({ prompt: value }); } catch (err) { toast(err.message || '保存失败', 'error'); }
  }, 400);
  promptInput.addEventListener('input', () => {
    persistPrompt(promptInput.value);
    const status = $('#prompt-status', root);
    if (status) status.textContent = '已保存 ' + fmtClock();
  });

  root.addEventListener('change', (event) => {
    const radio = event.target.closest('input[name="model-pick"]');
    if (!radio) return;
    updateProvider(active.id, { model: radio.value });
    $$('.model-item', root).forEach((el) => el.classList.toggle('is-on', !!el.querySelector('input:checked')));
    toast('默认模型：' + radio.value, 'success');
  });

  root.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-act]');
    if (!target) return;
    const act = target.getAttribute('data-act');
    /* 以存储里的当前服务商为准，避免用到闭包里的旧值 */
    const fresh = getActiveProvider(getSettings());

    if (act === 'new-provider') { openNewProvider(app); return; }

    if (act === 'save-provider') {
      const name = (nameInput.value || '').trim();
      const baseUrl = (baseInput.value || '').trim();
      const apiKey = (keyInput.value || '').trim();
      if (!baseUrl) { toast('请填写接口地址'); return; }
      if (!/^https?:\/\//i.test(baseUrl)) { toast('接口地址需要以 http:// 或 https:// 开头'); return; }
      if (!fresh.builtin && !name) { toast('请给服务商填个名称'); return; }
      updateProvider(fresh.id, {
        name: fresh.builtin ? fresh.name : name,
        baseUrl: baseUrl,
        apiKey: apiKey
      });
      toast('配置已保存', 'success');
      app.refresh();
      return;
    }

    if (act === 'delete-provider') {
      const ok = await confirmDialog({
        title: '删除这个服务商？',
        message: '它的地址、Key 和模型列表都会被删除，且不可恢复。',
        confirmText: '删除',
        danger: true
      });
      if (ok) {
        try {
          removeProvider(fresh.id);
          toast('已删除', 'success');
          app.refresh();
        } catch (err) {
          toast(err.message || '删除失败', 'error');
        }
      }
      return;
    }

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
      if (fresh.models.some((m) => m.name === name)) { toast('这个模型已经在列表里了'); return; }
      const models = fresh.models.concat([{ name: name, vision: guessVision(name) }]);
      updateProvider(fresh.id, { models: models, model: fresh.model || name });
      app.refresh();
      toast('已添加 ' + name, 'success');
      return;
    }

    if (act === 'del-model') {
      const name = target.getAttribute('data-name');
      if (fresh.models.length <= 1) { toast('至少保留一个模型'); return; }
      const models = fresh.models.filter((m) => m.name !== name);
      updateProvider(fresh.id, { models: models, model: fresh.model === name ? models[0].name : fresh.model });
      app.refresh();
      return;
    }

    if (act === 'toggle-vision') {
      const name = target.getAttribute('data-name');
      const models = fresh.models.map((m) => (m.name === name ? { name: m.name, vision: !m.vision } : m));
      updateProvider(fresh.id, { models: models });
      app.refresh();
      toast(name + (models.find((m) => m.name === name).vision ? ' 可识别图片' : ' 仅文本'), 'success');
      return;
    }

    if (act === 'fetch-models') {
      if (!fresh.apiKey) { toast('先填写 API Key，点「保存配置」后再获取'); return; }
      const label = target.innerHTML;
      target.setAttribute('disabled', 'disabled');
      target.textContent = '正在获取模型列表…';
      try {
        const names = await listModels({ baseUrl: fresh.baseUrl, apiKey: fresh.apiKey });
        target.removeAttribute('disabled');
        target.innerHTML = label;
        openModelPicker(names, fresh.id, app);
      } catch (err) {
        target.removeAttribute('disabled');
        target.innerHTML = label;
        toast((err && err.message) || '获取模型列表失败', 'error');
      }
      return;
    }

    if (act === 'test') {
      const status = $('#test-status', root);
      if (!fresh.apiKey) { toast('先填写并保存 API Key'); return; }
      if (!fresh.model) { toast('先添加并选择一个模型'); return; }
      target.setAttribute('disabled', 'disabled');
      if (status) status.textContent = '正在连接 ' + fresh.model + ' …';
      try {
        const info = await testConnection({ baseUrl: fresh.baseUrl, apiKey: fresh.apiKey, model: fresh.model });
        if (status) status.textContent = '连接成功 ✓ 用时 ' + ((info.ms || 0) / 1000).toFixed(1) + ' 秒' + (info.note ? '（' + info.note + '）' : '');
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
        saveSettings({ prompt: DEFAULT_PROMPT, promptVersion: 2 });
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

    if (act === 'import') { $('#import-input', root).click(); return; }

    if (act === 'wipe') {
      const ok = await confirmDialog({
        title: '清空本地数据？',
        message: '服务商配置、API Key、全部历史记录都会被删除，且无法恢复。',
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
      importBackup(JSON.parse(text));
      app.refresh();
      toast('备份已导入', 'success');
    } catch (err) {
      toast('导入失败：' + ((err && err.message) || '文件格式不正确'), 'error');
    }
  });
}

