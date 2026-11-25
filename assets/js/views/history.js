/* 历史页：本地批改记录 */
import {
  $, $$, icon, logoSvg, escapeHtml, fmtDateTime, fmtDay, toast, openSheet, confirmDialog, countWords
} from '../utils.js';
import { listHistory, getHistory, updateHistory, removeHistory, clearHistory } from '../store.js';

export function render() {
  const list = listHistory();
  const items = list.map((item, index) => {
    const score = item.score;
    const scoreText = score && score.total !== null && score.total !== undefined ? score.total + '/' + score.max : '';
    const isDefault = !item.title || item.title === fmtDateTime(item.createdAt);
    const preview = (item.question || item.essay || '').trim().slice(0, 40);
    return '<article class="history-item" data-id="' + escapeHtml(item.id) + '" style="animation-delay:' + Math.min(index * 0.04, 0.3) + 's">' +
      '<div class="history-top">' +
        '<div class="history-title' + (isDefault ? ' is-placeholder' : '') + '">' + escapeHtml(item.title || fmtDateTime(item.createdAt)) + '</div>' +
        (scoreText ? '<span class="history-score">' + escapeHtml(scoreText) + '</span>' : '') +
        '<div class="history-actions">' +
          '<button class="icon-btn" type="button" data-act="rename" data-id="' + escapeHtml(item.id) + '" aria-label="重命名">' + icon('edit') + '</button>' +
          '<button class="icon-btn" type="button" data-act="delete" data-id="' + escapeHtml(item.id) + '" aria-label="删除">' + icon('trash') + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="history-meta">' +
        '<span>' + escapeHtml(fmtDateTime(item.createdAt)) + '</span>' +
        '<span class="dot"></span>' +
        '<span class="chip chip-muted">' + escapeHtml(item.model || '未知模型') + '</span>' +
        (countWords(item.essay) ? '<span class="dot"></span><span>' + countWords(item.essay) + ' 词</span>' : '') +
      '</div>' +
      (preview ? '<div class="history-preview">' + escapeHtml(preview) + (preview.length >= 40 ? '…' : '') + '</div>' : '') +
      '</article>';
  }).join('');

  const body = list.length
    ? '<div class="history-list" id="history-list">' + items + '</div>'
    : '<div class="empty">' +
        '<div class="empty-orb">' + icon('history') + '</div>' +
        '<h3>还没有历史记录</h3>' +
        '<p>每次批改完成后会自动保存到这里，只存在这台设备上。</p>' +
        '<button class="btn btn-primary" type="button" data-act="go-home">去批改一篇</button>' +
      '</div>';

  return '<header class="page-head">' +
      '<div class="hero-logo">' + logoSvg() + '</div>' +
      '<div><div class="page-head-title">历史记录</div><div class="page-head-sub">' + (list.length ? list.length + ' 条 · 仅存本机' : '仅存本机') + '</div></div>' +
      '<div class="page-head-right">' +
        (list.length ? '<button class="icon-btn" type="button" data-act="clear" aria-label="清空历史">' + icon('trash') + '</button>' : '') +
      '</div>' +
    '</header>' +
    body;
}

function renameSheet(item, app) {
  openSheet({
    title: '重命名这条记录',
    html: '<input class="input" id="rename-input" maxlength="40" placeholder="例如：2023 英语一大作文" value="' + escapeHtml(item.title || '') + '" />' +
      '<div class="sheet-actions">' +
        '<button class="btn btn-ghost" type="button" data-act="cancel">取消</button>' +
        '<button class="btn btn-primary" type="button" data-act="save">保存</button>' +
      '</div>',
    onMount(root, close) {
      const input = root.querySelector('#rename-input');
      input.focus();
      input.select();
      const save = () => {
        const value = input.value.trim();
        updateHistory(item.id, { title: value || fmtDateTime(item.createdAt) });
        close();
        app.refresh();
        toast('已更新名称', 'success');
      };
      root.querySelector('[data-act="save"]').addEventListener('click', save);
      root.querySelector('[data-act="cancel"]').addEventListener('click', close);
      input.addEventListener('keydown', (event) => { if (event.key === 'Enter') save(); });
    }
  });
}

export function mount(root, app) {
  root.addEventListener('click', async (event) => {
    const actionBtn = event.target.closest('[data-act]');
    if (actionBtn) {
      const act = actionBtn.getAttribute('data-act');
      const id = actionBtn.getAttribute('data-id');
      if (act === 'go-home') { app.go('home'); return; }
      if (act === 'rename' && id) {
        const item = getHistory(id);
        if (item) renameSheet(item, app);
        return;
      }
      if (act === 'delete' && id) {
        const ok = await confirmDialog({
          title: '删除这条记录？',
          message: '删除后无法恢复，作文与批改结果都会从本机移除。',
          confirmText: '删除',
          danger: true
        });
        if (ok) {
          removeHistory(id);
          app.refresh();
          toast('已删除', 'success');
        }
        return;
      }
      if (act === 'clear') {
        const ok = await confirmDialog({
          title: '清空全部历史？',
          message: '所有批改记录都会从本机删除，此操作不可撤销。',
          confirmText: '全部清空',
          danger: true
        });
        if (ok) {
          clearHistory();
          app.refresh();
          toast('历史已清空', 'success');
        }
        return;
      }
    }

    const card = event.target.closest('.history-item');
    if (card && card.dataset.id) {
      const item = getHistory(card.dataset.id);
      if (item) app.openHistory(item);
    }
  });
}
