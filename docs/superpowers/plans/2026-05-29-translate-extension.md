# 划词翻译插件 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 Chrome/Edge 浏览器扩展，用户选中英文文本后在光标附近弹出 DeepSeek 翻译浮层。

**Architecture:** Content Script 捕获选中文字并通过 `chrome.runtime.sendMessage` 发送给 Service Worker，Worker 调用 DeepSeek chat completions API 翻译后返回结果。API Key 通过选项页配置，存储在 `chrome.storage.sync`。

**Tech Stack:** Plain JavaScript (ES2020+), Chrome Extensions Manifest V3, DeepSeek API (Bearer Token), CSS custom properties

---

### Task 1: 项目骨架 — manifest.json + 目录 + 图标

**Files:**
- Create: `translate-extension/manifest.json`
- Create: `translate-extension/_locales/zh_CN/messages.json`

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p translate-extension/{content,background,options,icons,_locales/zh_CN}
```

- [ ] **Step 2: 编写 manifest.json**

写入 `translate-extension/manifest.json`：

```json
{
  "manifest_version": 3,
  "name": "__MSG_extName__",
  "version": "1.0.0",
  "description": "__MSG_extDesc__",
  "default_locale": "zh_CN",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "permissions": ["storage"],
  "host_permissions": ["https://api.deepseek.com/*"],
  "background": {
    "service_worker": "background/background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/content.js"],
      "css": ["content/content.css"],
      "run_at": "document_idle"
    }
  ],
  "options_ui": {
    "page": "options/options.html",
    "open_in_tab": false
  }
}
```

- [ ] **Step 3: 编写国际化文案**

写入 `translate-extension/_locales/zh_CN/messages.json`：

```json
{
  "extName": { "message": "划词翻译" },
  "extDesc": { "message": "选中英文文本，使用 DeepSeek 翻译为中文" }
}
```

- [ ] **Step 4: 生成图标占位**

用 Canvas API 生成三个尺寸的简单图标（蓝色背景 + "译"字）。由于无法在终端运行浏览器，先创建占位说明：

```bash
echo "Place 16x16, 48x48, 128x128 PNG icons in translate-extension/icons/" > translate-extension/icons/README.txt
```

（实现时可从 [flaticon.com](https://flaticon.com) 下载免费翻译图标，或用 [real favicon generator](https://realfavicongenerator.net) 生成）

- [ ] **Step 5: 验证 manifest.json**

```bash
node -e "const m = require('./translate-extension/manifest.json'); console.log('manifest_version:', m.manifest_version); console.log('OK')"
```

Expected: `manifest_version: 3` 然后 `OK`

- [ ] **Step 6: Commit**

```bash
git add translate-extension/
git commit -m "feat: add extension scaffold with manifest.json"
```

---

### Task 2: Background Service Worker — DeepSeek API 翻译

**Files:**
- Create: `translate-extension/background/background.js`

- [ ] **Step 1: 编写 background.js**

写入 `translate-extension/background/background.js`：

```js
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
```

- [ ] **Step 2: 语法检查**

```bash
node -c translate-extension/background/background.js
```

Expected: no output (no syntax errors)

- [ ] **Step 3: Commit**

```bash
git add translate-extension/background/background.js
git commit -m "feat: add background service worker with DeepSeek API"
```

---

### Task 3: 选项页 — API Key 配置界面

**Files:**
- Create: `translate-extension/options/options.html`
- Create: `translate-extension/options/options.js`

- [ ] **Step 1: 编写 options.html**

写入 `translate-extension/options/options.html`：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>划词翻译 - 设置</title>
  <style>
    :root {
      --bg: #1e1e2e;
      --surface: #181825;
      --text: #cdd6f4;
      --subtext: #a6adc8;
      --accent: #89b4fa;
      --border: #313244;
      --danger: #f38ba8;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 24px;
      min-width: 320px;
    }
    h2 { font-size: 18px; margin-bottom: 4px; }
    .subtitle { font-size: 12px; color: var(--subtext); margin-bottom: 20px; }
    label { display: block; font-size: 13px; color: var(--subtext); margin-bottom: 6px; }
    input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--surface);
      color: var(--text);
      font-size: 14px;
      margin-bottom: 16px;
    }
    input:focus { outline: none; border-color: var(--accent); }
    button {
      width: 100%;
      padding: 10px;
      border: none;
      border-radius: 6px;
      background: var(--accent);
      color: var(--bg);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    button:hover { opacity: 0.9; }
    .toast {
      margin-top: 12px;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 13px;
      display: none;
    }
    .toast.success { display: block; background: #1a4d2e; color: #a6e3a1; }
    .toast.error { display: block; background: #4d1a2e; color: var(--danger); }
    .hint {
      margin-top: 16px;
      font-size: 11px;
      color: var(--subtext);
      line-height: 1.5;
    }
    .hint a { color: var(--accent); }
  </style>
</head>
<body>
  <h2>划词翻译 - 设置</h2>
  <p class="subtitle">配置 DeepSeek API Key</p>

  <label for="apiKey">API Key</label>
  <input type="password" id="apiKey" placeholder="sk-..." autocomplete="off">

  <button id="saveBtn">保存</button>
  <div id="toast" class="toast"></div>

  <p class="hint">
    前往 <a href="https://platform.deepseek.com/api_keys" target="_blank">platform.deepseek.com</a> 创建 API Key
  </p>

  <script src="options.js"></script>
</body>
</html>
```

- [ ] **Step 2: 编写 options.js**

写入 `translate-extension/options/options.js`：

```js
const apiKeyInput = document.getElementById('apiKey');
const saveBtn = document.getElementById('saveBtn');
const toast = document.getElementById('toast');

function showToast(msg, type) {
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  setTimeout(() => { toast.className = 'toast'; }, 2500);
}

async function loadApiKey() {
  const result = await chrome.storage.sync.get(['deepseekApiKey']);
  if (result.deepseekApiKey) {
    apiKeyInput.value = result.deepseekApiKey;
  }
}

async function saveApiKey() {
  const key = apiKeyInput.value.trim();
  if (!key) {
    showToast('请输入 API Key', 'error');
    return;
  }
  if (!key.startsWith('sk-')) {
    showToast('API Key 格式不正确，应以 sk- 开头', 'error');
    return;
  }
  try {
    await chrome.storage.sync.set({ deepseekApiKey: key });
    showToast('保存成功', 'success');
  } catch (err) {
    showToast('保存失败: ' + err.message, 'error');
  }
}

saveBtn.addEventListener('click', saveApiKey);
loadApiKey();
```

- [ ] **Step 3: 语法检查**

```bash
node -c translate-extension/options/options.js
```

Expected: no output

- [ ] **Step 4: Commit**

```bash
git add translate-extension/options/
git commit -m "feat: add options page for DeepSeek API key"
```

---

### Task 4: Content Script — 划词检测 + 弹窗渲染

**Files:**
- Create: `translate-extension/content/content.js`

- [ ] **Step 1: 编写 content.js**

写入 `translate-extension/content/content.js`：

```js
(function () {
  let popup = null;
  let loadingTimer = null;

  function isEnglish(text) {
    return /[a-zA-Z]/.test(text);
  }

  function createPopup() {
    if (popup) return popup;

    popup = document.createElement('div');
    popup.id = 'deepseek-trans-popup';
    popup.innerHTML = `
      <div class="dtp-original"></div>
      <div class="dtp-translation"></div>
      <div class="dtp-footer">
        <button class="dtp-copy-btn">复制</button>
        <span class="dtp-brand">DeepSeek 翻译</span>
      </div>
    `;
    document.body.appendChild(popup);

    popup.querySelector('.dtp-copy-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const text = popup.querySelector('.dtp-translation').textContent;
      navigator.clipboard.writeText(text).catch(() => {});
    });

    return popup;
  }

  function showPopup(x, y, original, translation) {
    const p = createPopup();
    p.querySelector('.dtp-original').textContent = original;
    p.querySelector('.dtp-translation').textContent = translation;
    p.style.display = 'block';

    // position near the selection, prefer above
    const rect = p.getBoundingClientRect();
    let top = y - rect.height - 12;
    let left = x;

    if (top < 8) {
      top = y + 12; // show below if not enough space above
    }
    if (left + rect.width > window.innerWidth - 8) {
      left = window.innerWidth - rect.width - 8;
    }
    if (left < 8) left = 8;

    p.style.top = top + 'px';
    p.style.left = left + 'px';
  }

  function hidePopup() {
    if (popup) popup.style.display = 'none';
  }

  function showLoading(x, y, original) {
    const p = createPopup();
    p.querySelector('.dtp-original').textContent = original;
    p.querySelector('.dtp-translation').textContent = '翻译中...';
    p.querySelector('.dtp-footer').style.display = 'none';
    p.style.display = 'block';

    const rect = p.getBoundingClientRect();
    let top = y - rect.height - 12;
    let left = x;
    if (top < 8) top = y + 12;
    if (left + rect.width > window.innerWidth - 8) left = window.innerWidth - rect.width - 8;
    if (left < 8) left = 8;
    p.style.top = top + 'px';
    p.style.left = left + 'px';
  }

  function showError(original, errorType) {
    const p = createPopup();
    p.querySelector('.dtp-original').textContent = original;

    if (errorType === 'no_key') {
      p.querySelector('.dtp-translation').innerHTML =
        '<span class="dtp-error-link">请先配置 DeepSeek API Key</span>';
      p.querySelector('.dtp-error-link').addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'openOptions' });
      });
    } else {
      p.querySelector('.dtp-translation').textContent = '翻译失败';
      setTimeout(hidePopup, 3000);
    }

    p.querySelector('.dtp-footer').style.display = 'none';
  }

  async function handleSelection() {
    const selection = window.getSelection();
    const text = selection.toString().trim();

    hidePopup();

    if (!text || text.length < 2 || !isEnglish(text)) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + window.scrollY;

    showLoading(x, y, text);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'translate',
        text: text
      });

      if (response.error) {
        showError(text, response.error);
      } else {
        showPopup(x, y, text, response.translation);
        const p = createPopup();
        p.querySelector('.dtp-footer').style.display = '';
      }
    } catch (err) {
      showError(text, 'api_error');
    }
  }

  document.addEventListener('mouseup', () => {
    setTimeout(handleSelection, 10);
  });

  document.addEventListener('mousedown', (e) => {
    if (popup && !popup.contains(e.target)) {
      hidePopup();
    }
  });
})();
```

- [ ] **Step 2: 语法检查**

```bash
node -c translate-extension/content/content.js
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add translate-extension/content/content.js
git commit -m "feat: add content script for text selection and popup"
```

---

### Task 5: Content CSS — 弹窗样式

**Files:**
- Create: `translate-extension/content/content.css`

- [ ] **Step 1: 编写 content.css**

写入 `translate-extension/content/content.css`：

```css
#deepseek-trans-popup {
  display: none;
  position: absolute;
  z-index: 2147483647;
  max-width: 360px;
  min-width: 120px;
  background: #1e1e2e;
  border: 1px solid #313244;
  border-radius: 10px;
  padding: 12px 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  line-height: 1.4;
  user-select: none;
  -webkit-user-select: none;
}

.dtp-original {
  font-size: 13px;
  color: #a6adc8;
  margin-bottom: 4px;
  word-break: break-word;
}

.dtp-translation {
  font-size: 17px;
  font-weight: 600;
  color: #89b4fa;
  word-break: break-word;
}

.dtp-footer {
  display: flex;
  align-items: center;
  margin-top: 10px;
  gap: 8px;
}

.dtp-copy-btn {
  padding: 2px 10px;
  border: 1px solid #45475a;
  border-radius: 4px;
  background: transparent;
  color: #a6adc8;
  font-size: 11px;
  cursor: pointer;
  line-height: 1.6;
}

.dtp-copy-btn:hover {
  background: #313244;
  color: #cdd6f4;
}

.dtp-brand {
  margin-left: auto;
  font-size: 10px;
  color: #585b70;
}

.dtp-error-link {
  color: #f9e2af;
  text-decoration: underline;
  cursor: pointer;
}

.dtp-error-link:hover {
  color: #f38ba8;
}
```

- [ ] **Step 2: Commit**

```bash
git add translate-extension/content/content.css
git commit -m "feat: add popup styles (dark theme)"
```

---

### Task 6: 集成验证

- [ ] **Step 1: 确认所有文件到位**

```bash
find translate-extension -type f | sort
```

Expected output:
```
translate-extension/_locales/zh_CN/messages.json
translate-extension/background/background.js
translate-extension/content/content.css
translate-extension/content/content.js
translate-extension/icons/README.txt
translate-extension/manifest.json
translate-extension/options/options.html
translate-extension/options/options.js
```

- [ ] **Step 2: 加载到 Chrome 验证**

打开 Chrome，进入 `chrome://extensions/`，开启"开发者模式"，点击"加载已解压的扩展程序"，选择 `translate-extension/` 目录。

验证清单：
1. 扩展出现在列表中，图标和名称正确
2. 点击"选项"能打开 API Key 配置页面
3. 配置有效的 DeepSeek API Key 后保存
4. 打开任意英文网页，选中英文文本，弹窗出现在光标附近
5. 弹窗显示正确的翻译结果
6. 点击"复制"按钮能复制译文
7. 点击页面其他区域弹窗消失
8. 选中非英文文本不触发弹窗
9. 未配置 API Key 时弹窗提示配置

- [ ] **Step 3: Commit**

```bash
git add translate-extension/icons/translate-extension/icons/README.txt
git commit -m "chore: add icon placeholder and verification checklist"
```
