/**
 * TaskDesk Focus Guardian - Content Script
 * 負責連接 TaskDesk 網頁應用與 Extension 後台 Service Worker
 */

(function () {
  // 監聽來自 TaskDesk 網頁應用的 postMessage
  window.addEventListener('message', (event) => {
    // 僅接收來自當前 window 的安全訊息
    if (event.source !== window || !event.data || typeof event.data !== 'object') return;

    const { type, action, payload } = event.data;

    if (type === 'TASKDESK_FOCUS_EVENT') {
      try {
        chrome.runtime.sendMessage({
          type: 'TASKDESK_FOCUS_EVENT',
          action: action,
          payload: payload
        });
      } catch (err) {
        // Extension context 可能失效
      }
    } else if (type === 'TASKDESK_PING_GUARDIAN') {
      try {
        chrome.runtime.sendMessage({ type: 'TASKDESK_PING_GUARDIAN' }, (response) => {
          window.postMessage({
            type: 'TASKDESK_GUARDIAN_PONG',
            installed: true,
            version: response?.version || '1.0.0',
            focusActive: !!response?.focusActive,
            guardianEnabled: !!response?.guardianEnabled
          }, '*');
        });
      } catch (err) {}
    }
  });

  // 網頁載入時主動發送 READY 訊號
  try {
    window.postMessage({
      type: 'TASKDESK_GUARDIAN_READY',
      installed: true,
      version: '1.0.0'
    }, '*');
  } catch (e) {}
})();
