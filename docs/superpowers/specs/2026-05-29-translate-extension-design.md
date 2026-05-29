# 划词翻译插件 — 设计文档

## 概述

Chrome/Edge 浏览器扩展，选中英文文本后在光标附近弹出翻译浮层，通过 DeepSeek API（chat completions）实现英译中。

## 需求

| 项 | 决定 |
|---|---|
| 浏览器 | Chrome / Edge（Chromium，Manifest V3） |
| 翻译服务 | DeepSeek API（chat completions） |
| 语言方向 | 英 → 中 |
| 触发方式 | 鼠标选中文本 |
| 弹窗位置 | 选中文字附近（tooltip 风格） |
| API 密钥 | 用户通过选项页自行配置，存入 chrome.storage |

## 架构

```
content.js  ──chrome.runtime.sendMessage──>  background.js  ──HTTPS──>  DeepSeek API
  │                                              │
  ├─ 捕获选中文字                               ├─ Bearer Token 鉴权
  ├─ 检测英文                                   ├─ prompt: 英译中
  └─ 计算光标位置                               └─ 返回译文
  └─ 显示/隐藏浮层
```

- **Content Script（content.js）**：注入页面，监听 `mouseup` 事件，获取选中文本，检测是否含英文，发送翻译请求，在光标附近渲染浮层
- **Service Worker（background.js）**：接收翻译请求，通过 Bearer Token 调用 DeepSeek chat completions API，返回翻译结果。API Key 从 chrome.storage 读取
- 两者通过 `chrome.runtime.sendMessage` 通信

## 文件结构

```
translate-extension/
├── manifest.json
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── content/
│   ├── content.js
│   └── content.css
├── background/
│   └── background.js
├── options/
│   ├── options.html
│   └── options.js
└── _locales/
    └── zh_CN/
        └── messages.json
```

## 浮层 UI

```
┌─────────────────────────────────┐
│  jumps over                     │  ← 原文（灰色小字）
│  跳过                           │  ← 译文（蓝色大字）
│  📋 复制           DeepSeek 翻译 │  ← 操作区
└─────────────────────────────────┘
```

- 深色主题
- 出现在选中文字上方或下方（根据屏幕空间自适应）
- 点击页面其他区域自动消失
- 提供复制译文按钮

## 错误处理

| 场景 | 处理 |
|---|---|
| 未配置密钥 | 弹窗提示"请先配置 DeepSeek API Key"，点击跳转选项页 |
| API 调用失败 | 弹窗显示"翻译失败"，3 秒自动消失 |
| 非英文文本 | 不触发翻译（检测是否包含英文字母） |
| 超时 | 5 秒超时，不显示 loading 过久 |
| 选中为空/过短 | 忽略（最短 2 个字符） |

## 选项页

- 右键扩展图标 → "选项" 进入
- 输入框：API Key（密码框，单字段）
- 保存后写入 `chrome.storage.sync`
- 首次安装未配置时，弹窗引导跳转选项页

## 权限

```json
{
  "permissions": ["storage"],
  "host_permissions": ["https://api.deepseek.com/*"]
}
```

- `storage`：存储 API 密钥
- `host_permissions`：仅限 DeepSeek API 域名
- 不需要 `activeTab`（content script 通过 manifest 中 `matches` 匹配所有页面）

## 不包含

- 发音朗读（TTS）
- 生词收藏/复习
- 全文翻译
- 多语言切换
- 弹窗外的其他 UI（如底部条、内联插入）
