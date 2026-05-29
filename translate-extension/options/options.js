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
