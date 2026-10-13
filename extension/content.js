/**
 * TaskDesk Focus Guardian - Content Script
 * 負責連接 TaskDesk 網頁應用與 Extension 後台 Service Worker
 */

(function () {
  function isAllowedTaskDeskPage() {
    const allowedOrigins = [
      'https://annie04082020.github.io',
      'http://localhost',
      'http://127.0.0.1'
    ];
    if (!allowedOrigins.includes(window.location.origin)) return false;
    if (window.location.hostname === 'annie04082020.github.io') {
      return window.location.pathname === '/TaskDesk/' || window.location.pathname.startsWith('/TaskDesk/');
    }
    return true;
  }

  function normalizePayload(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    const allowedBuckets = ['inbox', 'today', 'week', 'keep', 'release'];
    const allowedSizes = ['micro', 'small', 'medium', 'large'];
    return {
      id: typeof payload.id === 'string' ? payload.id.slice(0, 120) : '',
      text: typeof payload.text === 'string' ? payload.text.slice(0, 300) : '',
      bucket: typeof payload.bucket === 'string' && allowedBuckets.includes(payload.bucket) ? payload.bucket : 'inbox',
      size: typeof payload.size === 'string' && allowedSizes.includes(payload.size) ? payload.size : 'small'
    };
  }

  if (!isAllowedTaskDeskPage()) return;

  // 監聽來自 TaskDesk 網頁應用的 postMessage
  window.addEventListener('message', (event) => {
    // 僅接收來自當前 window 的安全訊息
    if (event.source !== window || !event.data || typeof event.data !== 'object') return;

    const { type, action, payload } = event.data;

    if (type === 'TASKDESK_FOCUS_EVENT') {
      if (!['START', 'STOP', 'PAUSE', 'RESUME'].includes(action)) return;
      try {
        chrome.runtime.sendMessage({
          type: 'TASKDESK_FOCUS_EVENT',
          action: action,
          payload: normalizePayload(payload)
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
          }, window.location.origin);
        });
      } catch (err) {}
    } else if (type === 'TASKDESK_GET_GUARDIAN_STATUS') {
      try {
        chrome.runtime.sendMessage({ type: 'TASKDESK_GET_GUARDIAN_STATUS' }, (response) => {
          window.postMessage({
            type: 'TASKDESK_GUARDIAN_STATUS',
            installed: !!response?.available,
            guardianEnabled: !!response?.guardianEnabled,
            focusActive: !!response?.focusActive,
            blockedDomainCount: Number(response?.blockedDomainCount) || 0,
            emergencyPassActive: !!response?.emergencyPassActive
          }, window.location.origin);
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
    }, window.location.origin);
  } catch (e) {}
})();
