/* 通用工具：DOM、图标、Markdown、弹层、提示、图片压缩 */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const escapeHtml = (value) =>
  String(value == null ? '' : value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

/* ---------------- 图标 ---------------- */
const ICON_PATHS = {
  home: '<path d="M4 10.6 12 4l8 6.6V20a1 1 0 0 1-1 1h-4.2v-5.6H9.2V21H5a1 1 0 0 1-1-1v-9.4Z"/>',
  review: '<path d="M4 20h4L18.2 9.8a2.2 2.2 0 0 0 0-3.1l-1-1a2.2 2.2 0 0 0-3.1 0L4 15.9V20Z"/><path d="M13.4 6.6 17.4 10.6"/>',
  history: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.4V12l3.1 1.9"/>',
  settings: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3.4v2.2M12 18.4v2.2M4.6 7.4l1.9 1.1M17.5 15.5l1.9 1.1M4.6 16.6l1.9-1.1M17.5 8.5l1.9-1.1"/>',
  chevronDown: '<path d="M6.5 9.5 12 15l5.5-5.5"/>',
  chevronRight: '<path d="M9.5 6.5 15 12l-5.5 5.5"/>',
  arrowRight: '<path d="M4.5 12h14M13 6.5 18.5 12 13 17.5"/>',
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3.4"/><circle cx="8.6" cy="9.6" r="1.6"/><path d="M4.4 17.2 9.8 12l3.4 3.2 2.6-2.4 3.8 3.6"/>',
  trash: '<path d="M4.6 6.8h14.8M9.4 6.8V5.2a1.2 1.2 0 0 1 1.2-1.2h2.8a1.2 1.2 0 0 1 1.2 1.2v1.6"/><path d="M6.6 6.8 7.4 19a1.4 1.4 0 0 0 1.4 1.3h6.4a1.4 1.4 0 0 0 1.4-1.3l.8-12.2"/><path d="M10.4 10.6v5.6M13.6 10.6v5.6"/>',
  edit: '<path d="M4.5 19.5h4L19.3 8.7a1.9 1.9 0 0 0 0-2.7l-1.3-1.3a1.9 1.9 0 0 0-2.7 0L4.5 15.5v4Z"/>',
  copy: '<rect x="8.6" y="8.6" width="11" height="11" rx="2.6"/><path d="M15.4 8.6V6.4a1.8 1.8 0 0 0-1.8-1.8H6.4a1.8 1.8 0 0 0-1.8 1.8v7.2a1.8 1.8 0 0 0 1.8 1.8h2.2"/>',
  check: '<path d="M5 12.6 9.6 17.2 19 7.8"/>',
  close: '<path d="M6.4 6.4 17.6 17.6M17.6 6.4 6.4 17.6"/>',
  eye: '<path d="M2.6 12S6 5.8 12 5.8 21.4 12 21.4 12 18 18.2 12 18.2 2.6 12 2.6 12Z"/><circle cx="12" cy="12" r="2.9"/>',
  eyeOff: '<path d="M4.2 4.2 19.8 19.8"/><path d="M9.6 5.9A9.6 9.6 0 0 1 12 5.8c6 0 9.4 6.2 9.4 6.2a17 17 0 0 1-3 3.7M6.2 7.5A17 17 0 0 0 2.6 12S6 18.2 12 18.2a9.4 9.4 0 0 0 3.6-.7"/><path d="M10.1 10.1a2.9 2.9 0 0 0 4 4"/>',
  download: '<path d="M12 4v10.4M7.6 10l4.4 4.4L16.4 10"/><path d="M4.6 17.6v1.4a1.2 1.2 0 0 0 1.2 1.2h12.4a1.2 1.2 0 0 0 1.2-1.2v-1.4"/>',
  upload: '<path d="M12 20V9.6M7.6 14 12 9.6l4.4 4.4"/><path d="M4.6 6.4V5a1.2 1.2 0 0 1 1.2-1.2h12.4A1.2 1.2 0 0 1 19.4 5v1.4"/>',
  info: '<circle cx="12" cy="12" r="8.4"/><path d="M12 11v5.2M12 8.1v.6"/>',
  camera: '<path d="M4.6 8.6h2.6l1.4-2.2h6.8l1.4 2.2h2.6a1.6 1.6 0 0 1 1.6 1.6v8a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 18.2v-8a1.6 1.6 0 0 1 1.6-1.6Z"/><circle cx="12" cy="13.6" r="3.3"/>',
  refresh: '<path d="M19.6 12a7.6 7.6 0 1 1-2.4-5.5"/><path d="M19.6 4.6v4.2h-4.2"/>',
  key: '<circle cx="8.2" cy="12" r="3.4"/><path d="M11.6 12h9M17.4 12v3M20 12v2.2"/>',
  shield: '<path d="M12 3.4 5 6.2v5.2c0 4.2 2.9 7.6 7 9.2 4.1-1.6 7-5 7-9.2V6.2l-7-2.8Z"/><path d="M9.4 12.2 11.3 14l3.4-3.6"/>',
  alert: '<path d="M12 4.6 2.9 20h18.2L12 4.6Z"/><path d="M12 10v4.2M12 17.2v.4"/>',
  sparkle: '<path d="M12 4.2 13.7 9.6 19 11.3 13.7 13 12 18.4 10.3 13 5 11.3 10.3 9.6 12 4.2Z"/><path d="M18.6 16.4l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z"/>',
  book: '<path d="M4.6 5.4A1.8 1.8 0 0 1 6.4 3.6H12v16.8H6.4a1.8 1.8 0 0 1-1.8-1.8V5.4Z"/><path d="M19.4 5.4a1.8 1.8 0 0 0-1.8-1.8H12v16.8h5.6a1.8 1.8 0 0 0 1.8-1.8V5.4Z"/>',
  layers: '<path d="M12 3.6 3.8 8l8.2 4.4L20.2 8 12 3.6Z"/><path d="M3.8 12.2 12 16.6l8.2-4.4"/><path d="M3.8 16.2 12 20.6l8.2-4.4"/>',
  clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.6V12l3.2 2"/>',
  lock: '<rect x="5" y="10.4" width="14" height="10" rx="3"/><path d="M8.4 10.4V7.8a3.6 3.6 0 0 1 7.2 0v2.6"/>'
};

export function icon(name, cls = 'ico') {
  const body = ICON_PATHS[name] || '';
  return '<svg class="' + cls + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
}

export function logoSvg(cls = 'logo-svg') {
  return '<svg class="' + cls + '" viewBox="0 0 48 48" aria-hidden="true">' +
    '<defs><linearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#74a9ff"/><stop offset="1" stop-color="#2563eb"/>' +
    '</linearGradient></defs>' +
    '<rect width="48" height="48" rx="15" fill="url(#brandGrad)"/>' +
    '<path d="M15 34.5 31.4 12.2" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>' +
    '<path d="M14.6 34.6h8.6" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity=".92"/>' +
    '<circle cx="32.2" cy="11" r="1.9" fill="#fff" opacity=".85"/>' +
    '</svg>';
}

/* ---------------- Markdown（安全子集） ---------------- */
const FENCE = String.fromCharCode(96, 96, 96);

export function mdToHtml(src) {
  const text = String(src || '').replace(/\r\n?/g, '\n').trim();
  if (!text) return '';
  const inline = (s) => escapeHtml(s)
    .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  const out = [];
  let list = null;
  let para = [];
  const flushPara = () => { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } };
  const closeList = () => { if (list) { out.push('</' + list + '>'); list = null; } };

  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.indexOf(FENCE) === 0) {
      const buf = []; i++;
      while (i < lines.length && lines[i].trim().indexOf(FENCE) !== 0) { buf.push(lines[i]); i++; }
      i++; flushPara(); closeList();
      out.push('<pre><code>' + escapeHtml(buf.join('\n')) + '</code></pre>');
      continue;
    }
    if (!line) { flushPara(); closeList(); i++; continue; }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { flushPara(); closeList(); const lvl = Math.min(h[1].length + 2, 6); out.push('<h' + lvl + '>' + inline(h[2]) + '</h' + lvl + '>'); i++; continue; }
    if (/^(---+|___+|\*\*\*+)$/.test(line)) { flushPara(); closeList(); out.push('<hr>'); i++; continue; }
    const q = line.match(/^>\s?(.*)$/);
    if (q) { flushPara(); closeList(); out.push('<blockquote>' + inline(q[1]) + '</blockquote>'); i++; continue; }
    const ul = line.match(/^[-*•·]\s+(.*)$/);
    const ol = line.match(/^(\d+)[.、)]\s+(.*)$/);
    if (ul || ol) {
      flushPara();
      const kind = ul ? 'ul' : 'ol';
      if (list !== kind) { closeList(); out.push('<' + kind + '>'); list = kind; }
      out.push('<li>' + inline(ul ? ul[1] : ol[2]) + '</li>');
      i++; continue;
    }
    if (/^\|.*\|$/.test(line) && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1].trim())) {
      flushPara(); closeList();
      const cells = (r) => r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) { rows.push(cells(lines[i].trim())); i++; }
      out.push('<div class="table-wrap"><table><thead><tr>' + head.map((c) => '<th>' + inline(c) + '</th>').join('') +
        '</tr></thead><tbody>' + rows.map((r) => '<tr>' + r.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') +
        '</tbody></table></div>');
      continue;
    }
    para.push(line); i++;
  }
  flushPara(); closeList();
  return out.join('');
}

/* ---------------- 时间 ---------------- */
const pad2 = (n) => String(n).padStart(2, '0');
export const fmtClock = (d = new Date()) => pad2(d.getHours()) + ':' + pad2(d.getMinutes());
export const fmtDate = (d = new Date()) => (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + '日一二三四五六'[d.getDay()];
export const fmtDateTime = (ts) => {
  const d = new Date(ts);
  return d.getFullYear() + '.' + pad2(d.getMonth() + 1) + '.' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
};
export const fmtDay = (ts) => {
  const d = new Date(ts);
  return (d.getMonth() + 1) + '月' + d.getDate() + '日';
};

/* ---------------- 提示 & 弹层 ---------------- */
let toastTimer = null;
export function toast(message, type = 'info') {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.className = 'toast toast-' + type + ' is-show';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-show'), 2400);
}

export function openSheet(options = {}) {
  const title = options.title || '';
  const html = options.html || '';
  const layer = $('#layer');
  layer.innerHTML =
    '<div class="sheet-backdrop" data-close="1"></div>' +
    '<section class="sheet" role="dialog" aria-modal="true">' +
    '<div class="sheet-grab"></div>' +
    (title ? '<h3 class="sheet-title">' + escapeHtml(title) + '</h3>' : '') +
    '<div class="sheet-body">' + html + '</div>' +
    '</section>';
  const close = () => {
    layer.classList.remove('is-open');
    setTimeout(() => { if (!layer.classList.contains('is-open')) layer.innerHTML = ''; }, 240);
  };
  layer.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));
  requestAnimationFrame(() => layer.classList.add('is-open'));
  if (options.onMount) options.onMount(layer.querySelector('.sheet'), close);
  return { root: layer.querySelector('.sheet'), close };
}

export function confirmDialog(options = {}) {
  const title = options.title || '确认操作';
  const message = options.message || '';
  const confirmText = options.confirmText || '确定';
  const danger = !!options.danger;
  return new Promise((resolve) => {
    openSheet({
      title,
      html: '<p class="sheet-text">' + escapeHtml(message) + '</p>' +
        '<div class="sheet-actions">' +
        '<button class="btn btn-ghost" data-act="cancel">取消</button>' +
        '<button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-act="ok">' + escapeHtml(confirmText) + '</button>' +
        '</div>',
      onMount(root, close) {
        root.querySelector('[data-act="cancel"]').addEventListener('click', () => { close(); resolve(false); });
        root.querySelector('[data-act="ok"]').addEventListener('click', () => { close(); resolve(true); });
      }
    });
  });
}

/* ---------------- 剪贴板 & 下载 ---------------- */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* ignore */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) { return false; }
}

export function downloadFile(filename, content, type = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
/* ---------------- 图片 ---------------- */
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i;

export function isImageFile(file) {
  if (!file) return false;
  if (/^image\//i.test(file.type || '')) return true;
  if (IMAGE_EXT.test(file.name || '')) return true;
  /* 某些相册/文件管理器给出的 type 是空的或 octet-stream，交给解码器再判断 */
  return !file.type || file.type === 'application/octet-stream';
}

export function compressImage(file, opts = {}) {
  const maxSide = opts.maxSide || 1400;
  const quality = opts.quality || 0.82;
  return new Promise((resolve, reject) => {
    if (!file || !(file instanceof Blob)) { reject(new Error('读取图片失败')); return; }
    const looksImage = /^image\//i.test(file.type || '') || IMAGE_EXT.test(file.name || '')
      || !file.type || file.type === 'application/octet-stream';
    if (!looksImage) { reject(new Error('这不是图片文件')); return; }
    if (file.size > 30 * 1024 * 1024) { reject(new Error('图片超过 30MB，请压缩后再上传')); return; }

    const fail = () => reject(new Error('这张图片无法解析（可能是 HEIC 格式）。可以改用「拍照」，或先把图片转成 JPG 再上传。'));

    const paint = (source, width, height) => {
      try {
        const scale = Math.min(1, maxSide / Math.max(width, height));
        const outW = Math.max(1, Math.round(width * scale));
        const outH = Math.max(1, Math.round(height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, outW, outH);
        ctx.drawImage(source, 0, 0, outW, outH);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (e) {
        fail();
      }
    };

    const tryBitmap = () => {
      if (!window.createImageBitmap) { fail(); return; }
      createImageBitmap(file).then((bmp) => {
        paint(bmp, bmp.width, bmp.height);
        if (bmp.close) setTimeout(() => bmp.close(), 50);
      }).catch(fail);
    };

    const reader = new FileReader();
    reader.onerror = () => tryBitmap();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => paint(img, img.naturalWidth || img.width, img.naturalHeight || img.height);
      img.onerror = () => tryBitmap();
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
/* ---------------- 杂项 ---------------- */
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function debounce(fn, wait = 300) {
  let t = null;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

/* 根据模型名粗略判断是否支持图片（用户仍可在设置里手动切换） */
export function guessVision(name) {
  return /(?:vl|vision|4o|4\.1|4v|omni|gemini|claude|multimodal|llava|pixtral|qvq|internvl)/i.test(String(name || ''));
}

export function countWords(text) {
  const s = String(text || '').trim();
  if (!s) return 0;
  const cjk = (s.match(/[\u4e00-\u9fff]/g) || []).length;
  const en = (s.match(/[A-Za-z][A-Za-z'-]*/g) || []).length;
  return cjk + en;
}

export function autoGrow(el, max = 420) {
  const resize = () => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, max) + 'px';
  };
  el.addEventListener('input', resize);
  resize();
  return resize;
}

