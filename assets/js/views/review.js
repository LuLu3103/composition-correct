/* 批改页：展示 AI 返回的修改建议、修改作文、作文评分 */
import {
  $, $$, icon, logoSvg, escapeHtml, fmtDateTime, mdToHtml, toast, copyText
} from '../utils.js';
import { getResult } from '../store.js';
import { scoreRatio } from '../parse.js';

const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;

function head(title, sub, right) {
  return '<header class="page-head">' +
    '<div class="hero-logo">' + logoSvg() + '</div>' +
    '<div><div class="page-head-title">' + title + '</div><div class="page-head-sub">' + sub + '</div></div>' +
    '<div class="page-head-right">' + (right || '') + '</div>' +
    '</header>';
}

function emptyHtml() {
  return head('批改结果', 'AI 给出的建议、范文与评分') +
    '<div class="empty">' +
      '<div class="empty-orb">' + icon('sparkle') + '</div>' +
      '<h3>还没有批改结果</h3>' +
      '<p>回到首页选择模型，填好题目和作文，点击「提交批改」就能看到这里。</p>' +
      '<button class="btn btn-primary" type="button" data-act="go-home">去写一篇</button>' +
    '</div>';
}

function runningHtml(job) {
  return head('批改中', '正在等待模型返回') +
    '<section class="card running-card">' +
      '<div class="running-dots"><i></i><i></i><i></i></div>' +
      '<div class="running-title">AI 正在批改…</div>' +
      '<div class="running-sub">通常需要 20–60 秒，请保持页面在前台</div>' +
      '<div class="stream-box" id="stream-box">' + escapeHtml(job.raw || '') + '</div>' +
    '</section>' +
    '<p class="submit-note">' + icon('info') + '结果会同时保存到「历史」</p>';
}

function errorHtml(job) {
  return head('批改失败', '请求没有成功') +
    '<section class="card">' +
      '<div class="empty" style="padding:26px 8px 10px">' +
        '<div class="empty-orb" style="width:72px;height:72px;border-radius:24px">' + icon('alert') + '</div>' +
        '<h3>批改没有完成</h3>' +
        '<p>' + escapeHtml(job.error || '未知错误') + '</p>' +
        (job.detail ? '<p style="margin-top:10px;font-size:11px;color:#b42318;word-break:break-all">' + escapeHtml(String(job.detail).slice(0, 200)) + '</p>' : '') +
      '</div>' +
      '<div class="sheet-actions">' +
        '<button class="btn btn-ghost" type="button" data-act="go-settings">检查设置</button>' +
        '<button class="btn btn-primary" type="button" data-act="retry">重试</button>' +
      '</div>' +
    '</section>';
}

function scoreCard(score) {
  if (!score) {
    return '<section class="card">' +
      '<div class="card-head"><div class="card-icon">' + icon('layers') + '</div>' +
      '<div><h2 class="card-title">作文评分</h2><p class="card-desc">模型未按格式给出分数</p></div></div>' +
      '<p class="prose">这次输出里没有识别到评分信息，可以换一个模型或调整提示词后重试。</p>' +
      '</section>';
  }
  const ratio = scoreRatio(score);
  const offset = (RING_C * (1 - ratio)).toFixed(1);
  const dims = (score.dims || []).map((d) => {
    const pct = d.max ? Math.max(4, Math.min(100, Math.round((d.value / d.max) * 100))) : 0;
    return '<div class="dim">' +
      '<span class="dim-name">' + escapeHtml(d.name) + '</span>' +
      '<span class="dim-bar"><i data-w="' + pct + '" style="width:0%"></i></span>' +
      '<span class="dim-value">' + d.value + '/' + d.max + '</span>' +
      '</div>';
  }).join('');

  return '<section class="card">' +
    '<div class="card-head"><div class="card-icon">' + icon('layers') + '</div>' +
    '<div><h2 class="card-title">作文评分</h2><p class="card-desc">按内容、结构、语言、词汇四项评定</p></div></div>' +
    '<div class="score-card">' +
      '<div class="score-ring">' +
        '<svg viewBox="0 0 120 120">' +
          '<defs><linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" stop-color="#74a9ff"/><stop offset="1" stop-color="#2563eb"/></linearGradient></defs>' +
          '<circle class="ring-bg" cx="60" cy="60" r="' + RING_R + '"/>' +
          '<circle class="ring-fg" data-final="' + offset + '" cx="60" cy="60" r="' + RING_R + '" ' +
          'style="stroke-dasharray:' + RING_C.toFixed(1) + ';stroke-dashoffset:' + RING_C.toFixed(1) + '"/>' +
        '</svg>' +
        '<div class="score-num"><b>' + fmtNum(score.total) + '</b><span>/ ' + fmtNum(score.max) + '</span></div>' +
      '</div>' +
      '<div class="score-side">' +
        '<div class="score-level">' + icon('check') + escapeHtml(score.level || '') + '</div>' +
        (score.comment ? '<p class="score-comment">' + escapeHtml(score.comment) + '</p>' : '') +
      '</div>' +
    '</div>' +
    (dims ? '<div class="dims">' + dims + '</div>' : '') +
    '</section>';
}

function fmtNum(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return String(Math.round(n * 10) / 10);
}

function resultHtml(app, data) {
  const parsed = data.parsed || {};
  const score = parsed.score || null;
  const title = (data.question || '').trim() || '未命名题目';
  const chips = [
    data.model ? '<span class="chip">' + icon('layers') + escapeHtml(data.model) + '</span>' : '',
    data.createdAt ? '<span class="chip">' + icon('clock') + escapeHtml(fmtDateTime(data.createdAt)) + '</span>' : ''
  ].join('');

  const hero = '<div class="result-hero">' +
    '<div class="result-eyebrow">批改报告</div>' +
    '<h2 class="result-title">' + escapeHtml(title) + '</h2>' +
    '<div class="result-meta">' + chips + '</div>' +
    (score && score.total !== null ? '<div class="result-score"><b>' + fmtNum(score.total) + '</b><span>/ ' + fmtNum(score.max) + '</span></div>' : '') +
    '</div>';

  const suggestions = parsed.suggestions
    ? '<section class="card">' +
        '<div class="card-head"><div class="card-icon">' + icon('edit') + '</div>' +
        '<div><h2 class="card-title">修改建议</h2><p class="card-desc">优先解决的高频问题</p></div></div>' +
        '<div class="prose">' + mdToHtml(parsed.suggestions) + '</div>' +
      '</section>'
    : '';

  const revised = parsed.revised
    ? '<section class="card">' +
        '<div class="card-head"><div class="card-icon">' + icon('book') + '</div>' +
        '<div><h2 class="card-title">修改作文</h2><p class="card-desc">保留原意，润色后的完整版本</p></div>' +
        '<button class="card-action" type="button" data-act="copy-revised">复制</button></div>' +
        '<div class="essay-paper"><div class="prose">' + mdToHtml(parsed.revised) + '</div></div>' +
      '</section>'
    : '';

  const original = data.essay
    ? '<section class="card">' +
        '<div class="card-head"><div class="card-icon">' + icon('copy') + '</div>' +
        '<div><h2 class="card-title">原始作文</h2><p class="card-desc">提交时的文本</p></div></div>' +
        '<details><summary class="card-action" style="margin:0;list-style:none">展开查看</summary>' +
        '<div class="essay-paper" style="margin-top:10px"><div class="prose">' + mdToHtml(data.essay) + '</div></div>' +
        '</details>' +
      '</section>'
    : '';

  const notParsed = parsed.parsed === false
    ? '<section class="card"><p class="prose">' + icon('alert') + ' 模型输出没有按「修改建议 / 修改作文 / 作文评分」分节，已把全部内容放在上面。</p></section>'
    : '';

  return head('批改结果', 'AI 给出的建议、范文与评分', data.historyId ? '<span class="chip chip-muted">历史</span>' : '') +
    hero + notParsed +
    (score ? '' : '') +
    suggestions + revised + scoreCard(score) + original +
    '<div class="result-actions">' +
      '<button class="btn btn-ghost" type="button" data-act="copy-all">' + icon('copy') + ' 复制全文</button>' +
      '<button class="btn btn-primary" type="button" data-act="retry">' + icon('refresh') + ' 重新批改</button>' +
    '</div>';
}

export function render(app) {
  const job = app.getJob();
  const saved = getResult();

  if (job && job.status === 'running') return runningHtml(job);
  if (job && job.status === 'error') return errorHtml(job);
  if (job && job.status === 'done') {
    return resultHtml(app, {
      parsed: job.result,
      question: job.question,
      essay: job.essay,
      model: job.model,
      createdAt: job.startedAt,
      images: job.images,
      historyId: job.recordId
    });
  }
  if (saved && saved.parsed) {
    return resultHtml(app, {
      parsed: saved.parsed,
      question: saved.question,
      essay: saved.essay,
      model: saved.model,
      createdAt: saved.createdAt,
      images: saved.images,
      historyId: saved.historyId
    });
  }
  return emptyHtml(app);
}

export function mount(root, app) {
  const job = app.getJob();
  const saved = getResult();
  const parsed = (job && job.status === 'done' ? job.result : saved && saved.parsed) || null;

  const ring = $('.ring-fg', root);
  if (ring) {
    const final = ring.getAttribute('data-final');
    requestAnimationFrame(() => {
      setTimeout(() => { ring.style.strokeDashoffset = final; }, 60);
    });
  }
  $$('.dim-bar i', root).forEach((bar) => {
    const width = bar.getAttribute('data-w') || '0';
    requestAnimationFrame(() => {
      setTimeout(() => { bar.style.width = width + '%'; }, 80);
    });
  });

  const box = $('#stream-box', root);
  if (box && job && job.status === 'running') {
    box.textContent = job.raw || '';
    box.scrollTop = box.scrollHeight;
  }

  root.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.getAttribute('data-act');
    if (act === 'go-home') app.go('home');
    else if (act === 'go-settings') app.go('settings');
    else if (act === 'retry') app.startCorrection();
    else if (act === 'copy-revised') {
      const text = (parsed && parsed.revised) || '';
      const ok = await copyText(text);
      toast(ok ? '已复制修改作文' : '复制失败，请长按选择', ok ? 'success' : 'error');
    } else if (act === 'copy-all') {
      const data = parsed || {};
      const score = data.score;
      const text = [data.suggestions, data.revised, score ? ('总分：' + score.total + '/' + score.max + '\n' + (score.level || '') + '\n' + (score.comment || '')) : '']
        .filter(Boolean).join('\n\n');
      const ok = await copyText(text || (data.raw || ''));
      toast(ok ? '已复制批改结果' : '复制失败，请长按选择', ok ? 'success' : 'error');
    }
  });
}
