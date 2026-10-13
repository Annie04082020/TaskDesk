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

const TASKDESK_ALLOWED_ORIGINS = [
  'https://annie04082020.github.io',
  'http://localhost',
  'http://127.0.0.1'
];

function isAllowedTaskDeskUrl(urlStr) {
  if (!urlStr) return false;
  try {
    const parsed = new URL(urlStr);
    if (!TASKDESK_ALLOWED_ORIGINS.includes(parsed.origin)) return false;
    if (parsed.hostname === 'annie04082020.github.io') {
      return parsed.pathname === '/TaskDesk/' || parsed.pathname.startsWith('/TaskDesk/');
    }
    return true;
  } catch (e) {
    return false;
  }
}

function isExtensionUrl(urlStr) {
  if (!urlStr) return false;
  try {
    return new URL(urlStr).origin === chrome.runtime.getURL('').slice(0, -1);
  } catch (e) {
    return false;
  }
}

function getHostname(urlStr) {
  try {
    return new URL(urlStr).hostname.toLowerCase();
  } catch (e) {
    return '';
  }
}

function getPassKeyForUrl(urlStr, blockedDomains) {
  const hostname = getHostname(urlStr);
  if (!hostname) return '';
  const matchedDomain = (blockedDomains || DEFAULT_BLOCKED_DOMAINS).find(domain => {
    const clean = String(domain || '').trim().toLowerCase();
    return clean && (hostname === clean || hostname.endsWith('.' + clean));
  });
  return matchedDomain || hostname;
}

function hasActiveDomainPass(urlStr, blockedDomains, passByDomain) {
  const key = getPassKeyForUrl(urlStr, blockedDomains);
  return !!(key && passByDomain && passByDomain[key] && Date.now() < passByDomain[key]);
}

function getCurrentPassUntil(passByDomain) {
  const now = Date.now();
  return Object.values(passByDomain || {}).filter(ts => ts && ts > now).sort((a, b) => b - a)[0] || null;
}

function normalizeFocusPayload(payload) {
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
  const data = await chrome.storage.local.get(['focusActive', 'activeTask', 'guardianEnabled', 'passByDomain']);
  if (!data.guardianEnabled) {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#64748b' });
    return;
  }

  const passUntil = getCurrentPassUntil(data.passByDomain);
  if (passUntil && Date.now() < passUntil) {
    const remainSec = Math.max(0, Math.ceil((passUntil - Date.now()) / 1000));
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
    'passByDomain',
    'distractionLogs'
  ]);

  // 未開啟專注或已關閉守護，直接放行
  if (!data.focusActive || !data.guardianEnabled) return;

  const blockedList = data.blockedDomains || DEFAULT_BLOCKED_DOMAINS;
  if (hasActiveDomainPass(targetUrl, blockedList, data.passByDomain)) return;

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
    if (!isAllowedTaskDeskUrl(sender.url)) {
      sendResponse({ success: false, error: 'unauthorized_sender' });
      return true;
    }
    if (!['START', 'STOP', 'PAUSE', 'RESUME'].includes(message.action)) {
      sendResponse({ success: false, error: 'invalid_action' });
      return true;
    }
    handleFocusEvent(message.action, normalizeFocusPayload(message.payload));
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'TASKDESK_GET_GUARDIAN_STATUS') {
    if (!isAllowedTaskDeskUrl(sender.url)) {
      sendResponse({ available: false, error: 'unauthorized_sender' });
      return true;
    }
    chrome.storage.local.get(['focusActive', 'guardianEnabled', 'blockedDomains', 'passByDomain']).then(data => {
      const passUntil = getCurrentPassUntil(data.passByDomain);
      sendResponse({
        available: true,
        guardianEnabled: data.guardianEnabled !== false,
        focusActive: !!data.focusActive,
        blockedDomainCount: Array.isArray(data.blockedDomains) ? data.blockedDomains.length : 0,
        emergencyPassActive: !!(passUntil && Date.now() < passUntil)
      });
    });
    return true;
  }

  if (message.type === 'TASKDESK_PING_GUARDIAN') {
    if (!isAllowedTaskDeskUrl(sender.url)) {
      sendResponse({ available: false, error: 'unauthorized_sender' });
      return true;
    }
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
    if (!isExtensionUrl(sender.url)) {
      sendResponse({ success: false, error: 'unauthorized_sender' });
      return true;
    }
    // 申請指定網域臨時通行
    const duration = Number.isFinite(message.durationMinutes) ? message.durationMinutes : 3;
    const safeDurationMinutes = Math.min(120, Math.max(1, Math.floor(duration)));
    const passDurationMs = safeDurationMinutes * 60 * 1000;
    const until = Date.now() + passDurationMs;
    chrome.storage.local.get(['blockedDomains', 'passByDomain']).then(data => {
      const key = getPassKeyForUrl(message.targetUrl || sender.url, data.blockedDomains || DEFAULT_BLOCKED_DOMAINS);
      const passByDomain = data.passByDomain || {};
      if (key) passByDomain[key] = until;
      chrome.storage.local.set({ passByDomain, emergencyPassUntil: null }).then(() => {
        updateBadge();
        sendResponse({ success: true, until: until, domain: key || '' });
      });
    }).catch(() => {
      updateBadge();
      sendResponse({ success: true, until: until });
    });
    return true;
  }

  if (message.type === 'GET_STATE') {
    if (!isExtensionUrl(sender.url)) {
      sendResponse({ success: false, error: 'unauthorized_sender' });
      return true;
    }
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
      emergencyPassUntil: null,
      passByDomain: {}
    });
    await updateBadge();
  } else if (action === 'STOP') {
    await chrome.storage.local.set({
      focusActive: false,
      activeTask: null,
      emergencyPassUntil: null,
      passByDomain: {}
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

// 定時巡檢 (清除到期的 domain pass)
chrome.alarms.create('checkPassExpiry', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkPassExpiry') {
    const data = await chrome.storage.local.get(['emergencyPassUntil', 'passByDomain']);
    const passByDomain = data.passByDomain || {};
    const now = Date.now();
    let changed = false;
    Object.keys(passByDomain).forEach(domain => {
      if (!passByDomain[domain] || passByDomain[domain] <= now) {
        delete passByDomain[domain];
        changed = true;
      }
    });
    if (data.emergencyPassUntil && Date.now() >= data.emergencyPassUntil) {
      data.emergencyPassUntil = null;
      changed = true;
    }
    if (changed) {
      await chrome.storage.local.set({ emergencyPassUntil: data.emergencyPassUntil || null, passByDomain });
    }
    await updateBadge();
  }
});
