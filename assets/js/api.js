/* OpenAI 兼容接口调用：支持流式输出、多模态图片、错误翻译 */

export class ApiError extends Error {
  constructor(message, options) {
    super(message);
    this.name = 'ApiError';
    this.status = (options && options.status) || 0;
    this.detail = (options && options.detail) || '';
  }
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

function buildUserContent(question, essay, images) {
  const hasImages = Array.isArray(images) && images.length > 0;
  const blocks = ['请批改下面这篇考研英语作文。'];
  blocks.push('【题目】\n' + (question ? question.trim() : '（学生未提供题目，请根据作文内容推断主题，并在评语中说明）'));
  if (essay && essay.trim()) blocks.push('【学生作文（文本）】\n' + essay.trim());
  if (!essay.trim() && hasImages) blocks.push('【学生作文（图片）】\n作文内容在下面的图片中，请先逐字识别图片里的文字，再按格式批改。');
  return { text: blocks.join('\n\n'), hasImages };
}

export function buildMessages(options) {
  const prompt = String(options.prompt || '');
  const images = Array.isArray(options.images) ? options.images : [];
  const { text, hasImages } = buildUserContent(options.question, options.essay || '', images);
  const system = hasImages
    ? prompt + '\n\n补充要求：用户提供了作文图片，请先准确识别图片中的手写或印刷文字，再进行批改。'
    : prompt;
  const user = hasImages
    ? [{ type: 'text', text: text }].concat(images.map((url) => ({ type: 'image_url', image_url: { url: url } })))
    : text;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
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
  const url = endpointOf(options.baseUrl);
  const apiKey = String(options.apiKey || '').trim();
  if (!apiKey) throw new ApiError('还没有填写 API Key，请先到「设置」里配置');

  const payload = {
    model: options.model,
    messages: options.messages,
    temperature: typeof options.temperature === 'number' ? options.temperature : 0.4,
    stream: !!options.onDelta
  };
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
        const delta = json.choices && json.choices[0] && json.choices[0].delta;
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

export async function testConnection(options) {
  const started = Date.now();
  await chatCompletion({
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
    model: options.model,
    messages: [
      { role: 'system', content: '你是一个连通性测试助手，只需回答“ok”。' },
      { role: 'user', content: 'ping' }
    ],
    temperature: 0,
    maxTokens: 16
  });
  return Date.now() - started;
}
