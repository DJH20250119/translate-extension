const apiKeyInput = document.getElementById('apiKey');
const saveBtn = document.getElementById('saveBtn');
const toast = document.getElementById('toast');

let toastTimer = null;

function showToast(msg, type) {
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = 'toast';
    toastTimer = null;
  }, 2500);
}

async function loadApiKey() {
  try {
    const result = await chrome.storage.sync.get(['deepseekApiKey']);
    if (result.deepseekApiKey) {
      apiKeyInput.value = result.deepseekApiKey;
    }
  } catch (err) {
    showToast('加载 API Key 失败: ' + err.message, 'error');
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
