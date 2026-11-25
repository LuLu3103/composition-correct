/* OpenAI 兼容接口调用：支持流式输出、多模态图片、错误翻译 */

export class ApiError extends Error {
  constructor(message, options) {
    super(message);
    this.name = 'ApiError';
    this.status = (options && options.status) || 0;
    this.detail = (options && options.detail) || '';
  }
}

let lastFinishReason = '';

export function getLastFinishReason() {
  return lastFinishReason;
}

export function endpointOf(baseUrl) {
  const base = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!base) throw new ApiError('请先在设置里填写接口地址');
  if (!/^https?:\/\//i.test(base)) throw new ApiError('接口地址需要以 http:// 或 https:// 开头');
  if (/\/chat\/completions$/i.test(base)) return base;
  return base + '/chat/completions';
}

function friendly(status, detail) {
  if (status === 401 || status === 403) return 'API Key 无效或没有访问权限，请在设置里检查';
  if (status === 404) return '接口地址或模型名称不正确（404）';
  if (status === 429) return '请求过于频繁或账户额度不足（429）';
  if (status === 400) return '请求被拒绝（400），可能是模型名称或参数不正确';
  if (status >= 500) return '服务商暂时不可用（' + status + '），请稍后再试';
  return '请求失败（' + status + '）' + (detail ? '：' + String(detail).slice(0, 120) : '');
}

export function buildMessages(options) {
  const prompt = String(options.prompt || '');
  const essay = String(options.essay || '').trim();
  const essayImages = Array.isArray(options.images) ? options.images : [];
  const questionImages = Array.isArray(options.questionImages) ? options.questionImages : [];
  const hasImages = essayImages.length + questionImages.length > 0;

  const parts = [{ type: 'text', text: '请批改下面这篇考研英语作文。' }];

  if (questionImages.length) {
    parts.push({ type: 'text', text: '【题目图片】下面 ' + questionImages.length + ' 张图片是作文题目或要求，请先准确识别其中的文字。' });
    questionImages.forEach((url) => parts.push({ type: 'image_url', image_url: { url: url } }));
    const questionText = (options.question || '').trim();
    if (questionText) parts.push({ type: 'text', text: '【题目文字补充】\n' + questionText });
  } else {
    const questionText = (options.question || '').trim();
    parts.push({ type: 'text', text: '【题目】\n' + (questionText || '（学生未提供题目，请根据作文内容推断主题，并在评语中说明）') });
  }

  if (essay) parts.push({ type: 'text', text: '【学生作文（文本）】\n' + essay });

  if (essayImages.length) {
    parts.push({ type: 'text', text: '【学生作文（图片）】作文正文在下面 ' + essayImages.length + ' 张图片里，请先逐字识别文字再批改。' });
    essayImages.forEach((url) => parts.push({ type: 'image_url', image_url: { url: url } }));
  } else if (!essay) {
    parts.push({ type: 'text', text: '（学生没有提供作文文字或图片）' });
  }

  const system = hasImages
    ? prompt + '\n\n补充要求：用户提供了图片（题目图片和/或作文图片），请先准确识别图片中的手写或印刷文字，再进行批改；如果题目图片与文字不一致，以图片中的要求为准。'
    : prompt;

  return [
    { role: 'system', content: system },
    { role: 'user', content: hasImages ? parts : parts.map((p) => p.text).join('\n\n') }
  ];
}

async function readError(res) {
  let detail = '';
  try {
    const raw = await res.text();
    try {
      const json = JSON.parse(raw);
      detail = (json.error && (json.error.message || json.error.code)) || json.message || raw;
    } catch (e) {
      detail = raw;
    }
  } catch (e) { /* ignore */ }
  return detail;
}

function pickContent(data) {
  const choice = data && data.choices && data.choices[0];
  if (!choice) return '';
  const message = choice.message || {};
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content.map((part) => (typeof part === 'string' ? part : part && part.text ? part.text : '')).join('');
  }
  if (typeof choice.text === 'string') return choice.text;
  return '';
}

export async function chatCompletion(options) {
  lastFinishReason = '';
  const url = endpointOf(options.baseUrl);
  const apiKey = String(options.apiKey || '').trim();
  if (!apiKey) throw new ApiError('还没有填写 API Key，请先到「设置」里配置');

  const payload = {
    model: options.model,
    messages: options.messages,
    stream: !!options.onDelta
  };
  if (typeof options.temperature === 'number') payload.temperature = options.temperature;
  if (options.maxTokens) payload.max_tokens = options.maxTokens;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey
      },
      body: JSON.stringify(payload),
      signal: options.signal
    });
  } catch (e) {
    if (e && e.name === 'AbortError') throw e;
    throw new ApiError('网络连接失败：无法访问接口地址。请检查网络，或确认该服务商允许浏览器直接调用（跨域）。', { detail: String(e && e.message ? e.message : e) });
  }

  if (!res.ok) {
    const detail = await readError(res);
    throw new ApiError(friendly(res.status, detail), { status: res.status, detail: detail });
  }

  const contentType = res.headers.get('content-type') || '';
  const canStream = !!options.onDelta && !!res.body && /text\/event-stream/i.test(contentType);

  if (!canStream) {
    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw new ApiError('无法解析服务端返回内容', { detail: String(e && e.message ? e.message : e) });
    }
    lastFinishReason = (data && data.choices && data.choices[0] && data.choices[0].finish_reason) || '';
    const content = pickContent(data);
    if (!content) throw new ApiError('模型返回了空内容', { detail: JSON.stringify(data).slice(0, 300) });
    if (options.onDelta) options.onDelta(content);
    return content;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let output = '';

  const handleChunk = (chunk) => {
    const lines = chunk.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.indexOf('data:') !== 0) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const json = JSON.parse(data);
        const choice = json.choices && json.choices[0];
        if (choice && choice.finish_reason) lastFinishReason = choice.finish_reason;
        const delta = choice && choice.delta;
        const piece = delta && (delta.content || '');
        if (piece) { output += piece; options.onDelta(piece); }
      } catch (e) { /* 忽略不完整片段 */ }
    }
  };

  while (true) {
    const step = await reader.read();
    if (step.done) break;
    buffer += decoder.decode(step.value, { stream: true }).replace(/\r\n/g, '\n');
    let idx = buffer.indexOf('\n\n');
    while (idx !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      handleChunk(chunk);
      idx = buffer.indexOf('\n\n');
    }
  }
  if (buffer.trim()) handleChunk(buffer);
  if (!output.trim()) throw new ApiError('模型没有返回批改内容，请换个模型或稍后重试');
  return output;
}

/* ---------------- 拉取服务商可用模型 ---------------- */
export async function listModels(options) {
  const base = String(options.baseUrl || '').trim().replace(/\/+$/, '');
  if (!base) throw new ApiError('请先填写接口地址');
  if (!/^https?:\/\//i.test(base)) throw new ApiError('接口地址需要以 http:// 或 https:// 开头');
  const apiKey = String(options.apiKey || '').trim();
  if (!apiKey) throw new ApiError('请先填写 API Key，再获取模型列表');

  const url = /\/models$/i.test(base) ? base : base + '/models';
  let res;
  try {
    res = await fetch(url, { headers: { Authorization: 'Bearer ' + apiKey } });
  } catch (e) {
    throw new ApiError('无法访问模型列表：网络问题，或该服务商不允许浏览器跨域', { detail: String((e && e.message) || e) });
  }
  if (!res.ok) {
    const detail = await readError(res);
    throw new ApiError(friendly(res.status, detail), { status: res.status, detail: detail });
  }
  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new ApiError('模型列表返回格式无法解析');
  }
  const rawList = Array.isArray(data)
    ? data
    : (Array.isArray(data.data) ? data.data : (Array.isArray(data.models) ? data.models : []));
  const ids = rawList
    .map((item) => (typeof item === 'string' ? item : (item && (item.id || item.name || item.model)) || ''))
    .filter(Boolean)
    .map(String);
  const unique = Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b));
  if (!unique.length) throw new ApiError('服务商没有返回可用模型，可以手动添加');
  return unique;
}

export async function testConnection(options) {
  const started = Date.now();
  try {
    await chatCompletion({
      baseUrl: options.baseUrl,
      apiKey: options.apiKey,
      model: options.model,
      messages: [{ role: 'user', content: '只回复两个字：可用' }]
    });
    return { ms: Date.now() - started, note: '' };
  } catch (err) {
    const status = err && err.status;
    if (status === 401 || status === 403) throw err;
    /* 推理模型或部分服务商会拒绝这种极短的聊天请求，
       这时改用 /models 验证地址与 Key，避免「批改能用但测试不通」 */
    try {
      const models = await listModels({ baseUrl: options.baseUrl, apiKey: options.apiKey });
      const note = models.indexOf(options.model) >= 0 ? '' : '模型不在服务商返回的列表中，但接口与 Key 可用';
      return { ms: Date.now() - started, note: note };
    } catch (fallbackErr) {
      if (fallbackErr && fallbackErr.name === 'ApiError' && fallbackErr.status === 0) throw fallbackErr;
      throw err;
    }
  }
}
