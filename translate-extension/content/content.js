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
