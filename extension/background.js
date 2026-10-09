/**
 * TaskDesk Focus Guardian - Background Service Worker (Manifest V3)
 * 專注守護者核心：跨分頁阻擋干擾網站、維護背景專注狀態、支援雙向通訊
 */

const DEFAULT_BLOCKED_DOMAINS = [
  'youtube.com',
  'youtu.be',
  'bilibili.com',
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'reddit.com',
  'tiktok.com',
  'threads.net',
  'netflix.com',
  'twitch.tv',
  'dcard.tw',
  'ptt.cc',
  'weibo.com'
];

// 初始化儲存庫預設值
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(['blockedDomains', 'guardianEnabled', 'distractionLogs']);
  if (!data.blockedDomains) {
    await chrome.storage.local.set({ blockedDomains: DEFAULT_BLOCKED_DOMAINS });
  }
  if (data.guardianEnabled === undefined) {
    await chrome.storage.local.set({ guardianEnabled: true });
  }
  if (!data.distractionLogs) {
    await chrome.storage.local.set({ distractionLogs: [] });
  }
  await updateBadge();
});

// 檢查網址是否命中黑名單
function isBlockedUrl(urlStr, blockedDomains) {
  if (!urlStr) return false;
  try {
    const parsed = new URL(urlStr);
    // 忽略擴充功能內部網址與空白頁
    if (parsed.protocol === 'chrome-extension:' || parsed.protocol === 'edge-extension:' || parsed.protocol === 'about:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    return blockedDomains.some(domain => {
      const clean = domain.trim().toLowerCase();
      if (!clean) return false;
      return hostname === clean || hostname.endsWith('.' + clean);
    });
  } catch (e) {
    return false;
  }
}

// 更新工具列徽章 (Badge)
async function updateBadge() {
  const data = await chrome.storage.local.get(['focusActive', 'activeTask', 'guardianEnabled', 'emergencyPassUntil']);
  if (!data.guardianEnabled) {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#64748b' });
    return;
  }

  if (data.emergencyPassUntil && Date.now() < data.emergencyPassUntil) {
    const remainSec = Math.max(0, Math.ceil((data.emergencyPassUntil - Date.now()) / 1000));
    chrome.action.setBadgeText({ text: `${Math.ceil(remainSec / 60)}m` });
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' }); // 琥珀色提示通行中
    return;
  }

  if (data.focusActive) {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#0ea5e9' }); // 專注藍色
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// 監聽分頁跳轉，攔截分心網址
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const targetUrl = changeInfo.url || tab.url;
  if (!targetUrl) return;

  const data = await chrome.storage.local.get([
    'focusActive',
    'activeTask',
    'guardianEnabled',
    'blockedDomains',
    'emergencyPassUntil',
    'distractionLogs'
  ]);

  // 未開啟專注或已關閉守護，直接放行
  if (!data.focusActive || !data.guardianEnabled) return;

  // 若處於緊急通行放行時間窗口內，直接放行
  if (data.emergencyPassUntil && Date.now() < data.emergencyPassUntil) return;

  const blockedList = data.blockedDomains || DEFAULT_BLOCKED_DOMAINS;
  if (isBlockedUrl(targetUrl, blockedList)) {
    // 記錄一次分心衝動紀錄
    try {
      const logs = data.distractionLogs || [];
      const parsedUrl = new URL(targetUrl);
      logs.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
        url: targetUrl,
        domain: parsedUrl.hostname,
        taskText: data.activeTask ? data.activeTask.text : '目前專注任務',
        timestamp: Date.now()
      });
      if (logs.length > 200) logs.length = 200;
      await chrome.storage.local.set({ distractionLogs: logs });
    } catch (e) {}

    // 重新導向至沈浸攔截頁面
    const blockedPageUrl = chrome.runtime.getURL('blocked.html') +
      `?target=${encodeURIComponent(targetUrl)}&task=${encodeURIComponent(data.activeTask?.text || '正在進行的任務')}`;

    chrome.tabs.update(tabId, { url: blockedPageUrl });
  }
});

// 監聽來自 content script 或 popup 的訊息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  if (message.type === 'TASKDESK_FOCUS_EVENT') {
    handleFocusEvent(message.action, message.payload);
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'TASKDESK_PING_GUARDIAN') {
    chrome.storage.local.get(['focusActive', 'activeTask', 'guardianEnabled']).then(data => {
      sendResponse({
        available: true,
        version: '1.0.0',
        focusActive: !!data.focusActive,
        guardianEnabled: !!data.guardianEnabled,
        activeTask: data.activeTask || null
      });
    });
    return true;
  }

  if (message.type === 'GUARDIAN_REQUEST_PASS') {
    // 申請緊急通行 3 分鐘
    const passDurationMs = (message.durationMinutes || 3) * 60 * 1000;
    const until = Date.now() + passDurationMs;
    chrome.storage.local.set({ emergencyPassUntil: until }).then(() => {
      updateBadge();
      sendResponse({ success: true, until: until });
    });
    return true;
  }

  if (message.type === 'GET_STATE') {
    chrome.storage.local.get(null).then(allData => {
      sendResponse({ success: true, data: allData });
    });
    return true;
  }
});

// 處理來自 TaskDesk 網頁的專注事件
async function handleFocusEvent(action, payload) {
  if (action === 'START') {
    await chrome.storage.local.set({
      focusActive: true,
      activeTask: payload || null,
      focusStartTime: Date.now(),
      emergencyPassUntil: null
    });
    await updateBadge();
  } else if (action === 'STOP') {
    await chrome.storage.local.set({
      focusActive: false,
      activeTask: null,
      emergencyPassUntil: null
    });
    await updateBadge();
  } else if (action === 'PAUSE') {
    // 暫停專注
    await updateBadge();
  } else if (action === 'RESUME') {
    await chrome.storage.local.set({
      focusActive: true
    });
    await updateBadge();
  }
}

// 定時巡檢 (清除到期的 emergencyPass)
chrome.alarms.create('checkPassExpiry', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkPassExpiry') {
    const data = await chrome.storage.local.get(['emergencyPassUntil']);
    if (data.emergencyPassUntil && Date.now() >= data.emergencyPassUntil) {
      await chrome.storage.local.set({ emergencyPassUntil: null });
      await updateBadge();
    }
  }
});
