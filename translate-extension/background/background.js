const DEEPSEEK_API = 'https://api.deepseek.com/v1/chat/completions';
const TIMEOUT_MS = 5000;

async function getApiKey() {
  const result = await chrome.storage.sync.get(['deepseekApiKey']);
  return result.deepseekApiKey || null;
}

async function translate(text) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return { error: 'no_key' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(DEEPSEEK_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是一个英译中翻译助手。只返回翻译结果，不要解释或额外文字。' },
          { role: 'user', content: `将以下英文翻译成中文：\n${text}` }
        ],
        temperature: 0.3,
        max_tokens: 512
      }),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!res.ok) {
      console.error('DeepSeek API error:', res.status);
      return { error: 'api_error' };
    }

    const data = await res.json();
    const translation = data.choices?.[0]?.message?.content?.trim();
    if (!translation) {
      return { error: 'api_error' };
    }
    return { translation };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return { error: 'timeout' };
    }
    console.error('DeepSeek request failed:', err);
    return { error: 'api_error' };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'translate') {
    translate(message.text).then(sendResponse);
    return true; // keep channel open for async response
  }
  if (message.type === 'openOptions') {
    chrome.runtime.openOptionsPage();
    return false;
  }
});
