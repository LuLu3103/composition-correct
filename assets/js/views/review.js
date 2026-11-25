/* 批改页：V2 八段结果，按「修改建议 / 修改作文 / 作文评分」分区，每张卡片可折叠 */
import {
  $, $$, icon, logoSvg, escapeHtml, fmtDateTime, mdToHtml, toast, copyText
} from '../utils.js';
import { getResult } from '../store.js';
import { scoreRatio } from '../parse.js';

const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;

const BLOCK_ICONS = {
  req: 'info',
  overall: 'sparkle',
  sentences: 'edit',
  personal: 'sparkle',
  errors: 'alert',
  phrases: 'book',
  suggestions: 'edit',
  raw: 'review'
};

function head(title, sub, right) {
  return '<header class="page-head">' +
    '<div class="hero-logo">' + logoSvg() + '</div>' +
    '<div><div class="page-head-title">' + title + '</div><div class="page-head-sub">' + sub + '</div></div>' +
    '<div class="page-head-right">' + (right || '') + '</div>' +
    '</header>';
}

function chapter(text) {
  return '<div class="chapter"><span class="chapter-bar"></span>' + escapeHtml(text) + '</div>';
}

/* 可折叠卡片 */
function foldCard(opts) {
  return '<details class="card fold" data-fold="' + escapeHtml(opts.id) + '"' + (opts.open ? ' open' : '') + '>' +
    '<summary class="fold-head">' +
      '<span class="card-icon">' + icon(opts.icon || 'edit') + '</span>' +
      '<span class="fold-title">' + escapeHtml(opts.title) + '</span>' +
      (opts.preview ? '<span class="fold-preview">' + escapeHtml(opts.preview) + '</span>' : '') +
      '<span class="fold-chevron">' + icon('chevronDown') + '</span>' +
    '</summary>' +
    '<div class="fold-body">' + (opts.body || '') + '</div>' +
  '</details>';
}

function snippet(text, max) {
  const raw = String(text || '')
    .replace(/\`\`\`[\s\S]*?\`\`\`/g, ' ')
    .replace(/[#>*_`]/g, '')
    .replace(/^\s*[-•]\s*/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  const limit = max || 38;
  return raw.length > limit ? raw.slice(0, limit) + '…' : raw;
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

/* ---------- 逐句批改 ---------- */
function sentencesHtml(items) {
  return items.map((item) =>
    '<div class="sentence">' +
      '<div class="sentence-row">' +
        '<span class="sentence-tag">原句</span>' +
        '<p class="sentence-text is-bad">' + escapeHtml(item.original) + '</p>' +
      '</div>' +
      (item.fix ? '<div class="sentence-row">' +
        '<span class="sentence-tag is-good">改为</span>' +
        '<p class="sentence-text is-good">' + escapeHtml(item.fix) + '</p>' +
      '</div>' : '') +
      (item.note ? '<div class="sentence-note">' + mdToHtml(item.note) + '</div>' : '') +
    '</div>'
  ).join('');
}

/* ---------- 积累表达 ---------- */
function phrasesHtml(items) {
  return '<div class="phrase-list">' + items.map((item) =>
    '<div class="phrase">' +
      '<div class="phrase-text">' + escapeHtml(item.phrase) + '</div>' +
      (item.usage ? '<div class="phrase-usage"><span>可用于</span>' + mdToHtml(item.usage) + '</div>' : '') +
    '</div>'
  ).join('') + '</div>';
}

function blockHtml(block) {
  let body;
  if (block.kind === 'sentences' && block.sentences) body = sentencesHtml(block.sentences);
  else if (block.kind === 'phrases' && block.phrases) body = phrasesHtml(block.phrases);
  else body = '<div class="prose">' + mdToHtml(block.body) + '</div>';
  const previewSource = block.body
    || (block.sentences && block.sentences[0] ? block.sentences[0].original : '')
    || (block.phrases && block.phrases[0] ? block.phrases[0].phrase : '');
  return foldCard({
    id: block.id,
    icon: BLOCK_ICONS[block.id] || 'edit',
    title: block.title,
    preview: snippet(previewSource),
    body: body,
    open: block.id === 'overall'
  });
}

/* ---------- 评分 ---------- */
function fmtNum(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return String(Math.round(n * 10) / 10);
}

function scoreBody(score) {
  if (!score) {
    return '<p class="prose">这次输出里没有识别到评分信息，可以换一个模型或调整提示词后重试。</p>';
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

  return '<div class="score-card">' +
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
        (score.level ? '<div class="score-level">' + icon('check') + escapeHtml(score.level) + '</div>' : '') +
        (score.range ? '<p class="score-range">预估区间 ' + escapeHtml(score.range) + ' 分</p>' : '') +
        (score.comment ? '<p class="score-comment">' + escapeHtml(score.comment) + '</p>' : '') +
      '</div>' +
    '</div>' +
    (dims ? '<div class="dims">' + dims + '</div>' : '') +
    (score.strengths ? '<div class="score-points"><h4>' + icon('check') + '得分优势</h4><div class="prose">' + mdToHtml(score.strengths) + '</div></div>' : '') +
    (score.weaknesses ? '<div class="score-points"><h4>' + icon('alert') + '主要扣分点</h4><div class="prose">' + mdToHtml(score.weaknesses) + '</div></div>' : '');
}

/* ---------- 兼容旧记录 ---------- */
function normalize(parsed) {
  if (!parsed) return { blocks: [], revised: '', score: null, parsed: false };
  if (Array.isArray(parsed.blocks)) {
    return { blocks: parsed.blocks, revised: parsed.revised || '', score: parsed.score || null, parsed: !!parsed.parsed };
  }
  const blocks = [];
  if (parsed.suggestions) blocks.push({ id: 'suggestions', title: '具体修改意见', body: parsed.suggestions, kind: 'text' });
  return { blocks: blocks, revised: parsed.revised || '', score: parsed.score || null, parsed: !!parsed.parsed };
}

function resultHtml(app, data) {
  const parsed = normalize(data.parsed);
  const score = parsed.score;
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

  const notParsed = parsed.parsed === false
    ? '<section class="card"><p class="prose">' + icon('alert') + ' 模型输出没有按提示词的段落编号分节，已把内容整段展示。</p></section>'
    : '';

  const suggestionBlocks = parsed.blocks.map(blockHtml).join('');

  const revisedCard = parsed.revised
    ? foldCard({
        id: 'revised',
        icon: 'book',
        title: '修改后的完整作文',
        preview: '点击查看完整修改稿',
        body: '<div class="fold-tools"><button class="card-action" type="button" data-act="copy-revised">' + icon('copy') + ' 复制全文</button></div>' +
          '<div class="essay-paper"><div class="prose">' + mdToHtml(parsed.revised) + '</div></div>'
      })
    : '';

  const scoreCard = foldCard({
    id: 'score',
    icon: 'layers',
    title: '得分详情',
    preview: score && score.total !== null ? (fmtNum(score.total) + '/' + fmtNum(score.max) + ' · ' + (score.level || '')) : '未识别到评分',
    body: scoreBody(score),
    open: true
  });

  const original = data.essay
    ? foldCard({
        id: 'original',
        icon: 'copy',
        title: '原始作文',
        preview: '提交时的内容',
        body: '<div class="essay-paper"><div class="prose">' + mdToHtml(data.essay) + '</div></div>'
      })
    : '';

  const toolbar = '<div class="result-toolbar">' +
    '<button class="chip chip-muted fold-toggle" type="button" data-act="toggle-all">' + icon('layers') + '全部展开</button>' +
    '<span class="toolbar-hint">点击标题展开或收起</span>' +
    '</div>';

  return head('批改结果', 'AI 给出的建议、范文与评分', data.historyId ? '<span class="chip chip-muted">历史</span>' : '') +
    hero +
    toolbar +
    (suggestionBlocks ? chapter('修改建议') + notParsed + suggestionBlocks : notParsed) +
    (revisedCard ? chapter('修改作文') + revisedCard : '') +
    chapter('作文评分') + scoreCard +
    original +
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
      parsed: job.result, question: job.question, essay: job.essay, model: job.model,
      createdAt: job.startedAt, images: job.images, historyId: job.recordId
    });
  }
  if (saved && saved.parsed) {
    return resultHtml(app, {
      parsed: saved.parsed, question: saved.question, essay: saved.essay, model: saved.model,
      createdAt: saved.createdAt, images: saved.images, historyId: saved.historyId
    });
  }
  return emptyHtml();
}

export function mount(root, app) {
  const job = app.getJob();
  const saved = getResult();
  const parsed = normalize(job && job.status === 'done' ? job.result : (saved && saved.parsed) || null);

  const ring = $('.ring-fg', root);
  if (ring) {
    const final = ring.getAttribute('data-final');
    requestAnimationFrame(() => { setTimeout(() => { ring.style.strokeDashoffset = final; }, 60); });
  }
  $$('.dim-bar i', root).forEach((bar) => {
    const width = bar.getAttribute('data-w') || '0';
    requestAnimationFrame(() => { setTimeout(() => { bar.style.width = width + '%'; }, 80); });
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
    else if (act === 'toggle-all') {
      const folds = $$('.fold', root);
      const anyClosed = folds.some((d) => !d.open);
      folds.forEach((d) => { d.open = anyClosed; });
      btn.innerHTML = icon('layers') + (anyClosed ? '全部收起' : '全部展开');
    } else if (act === 'copy-revised') {
      const ok = await copyText(parsed.revised || '');
      toast(ok ? '已复制修改作文' : '复制失败，请长按选择', ok ? 'success' : 'error');
    } else if (act === 'copy-all') {
      const score = parsed.score;
      const scoreText = score
        ? ['总分：' + fmtNum(score.total) + '/' + fmtNum(score.max), score.level, score.strengths ? '得分优势：' + score.strengths : '', score.weaknesses ? '主要扣分点：' + score.weaknesses : ''].filter(Boolean).join('\n')
        : '';
      const text = parsed.blocks.map((b) => b.title + '\n' + b.body).join('\n\n') +
        (parsed.revised ? '\n\n修改后的完整作文\n' + parsed.revised : '') +
        (scoreText ? '\n\n评分\n' + scoreText : '');
      const ok = await copyText(text.trim());
      toast(ok ? '已复制批改结果' : '复制失败，请长按选择', ok ? 'success' : 'error');
    }
  });
}
