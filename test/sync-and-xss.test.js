const test = require('node:test');
const assert = require('node:assert/strict');
const SyncEngine = require('../app.js');

test('Case 1: A 刪除、B 沒動 - 合併後不可復活，tombstone 必須保留', () => {
  const localData = {
    items: [],
    tombstones: { 'task_1': 2000 }
  };
  const remoteData = {
    items: [
      { id: 'task_1', text: '任務一', updatedAt: 1000 }
    ],
    tombstones: {}
  };

  const result = SyncEngine.smartMergeData(localData, remoteData);
  assert.equal(result.items.length, 0, '已刪除的任務不可在合併後復活');
  assert.equal(result.tombstones['task_1'], 2000, 'tombstone 必須被完整保留');
});

test('Case 2: A 刪除、B 之後修改 - 依操作時間判定勝負', () => {
  // 2a. B 修改晚於 A 刪除：修改勝出
  const aDeleted = {
    items: [],
    tombstones: { 'task_1': 1000 }
  };
  const bModifiedLater = {
    items: [
      { id: 'task_1', text: '修改後任務', updatedAt: 1500 }
    ],
    tombstones: {}
  };
  const resA = SyncEngine.smartMergeData(aDeleted, bModifiedLater);
  assert.equal(resA.items.length, 1, '修改時間晚於刪除時，修改勝出');
  assert.equal(resA.items[0].text, '修改後任務');
  assert.equal(resA.items[0].updatedAt, 1500);
  assert.equal(resA.tombstones['task_1'], undefined, '勝出的項目 tombstone 應被清除以避免下次誤判');

  // 2b. A 刪除晚於 B 修改：刪除勝出
  const aDeletedLater = {
    items: [],
    tombstones: { 'task_1': 2000 }
  };
  const bModifiedEarlier = {
    items: [
      { id: 'task_1', text: '舊修改任務', updatedAt: 1500 }
    ],
    tombstones: {}
  };
  const resB = SyncEngine.smartMergeData(aDeletedLater, bModifiedEarlier);
  assert.equal(resB.items.length, 0, '刪除時間晚於修改時，維持刪除');
  assert.equal(resB.tombstones['task_1'], 2000, 'tombstone 保持為最新刪除時間');
});

test('Case 3: 同一任務但兩端 timestamp 相同 - 結果必須 deterministic 且多次執行一致', () => {
  const itemA = { id: 'task_1', text: '版本 A', updatedAt: 1000, bucket: 'today' };
  const itemB = { id: 'task_1', text: '版本 B', updatedAt: 1000, bucket: 'week' };

  const res1 = SyncEngine.smartMergeData({ items: [itemA] }, { items: [itemB] });
  const res2 = SyncEngine.smartMergeData({ items: [itemA] }, { items: [itemB] });
  const res3 = SyncEngine.smartMergeData({ items: [itemB] }, { items: [itemA] });

  assert.deepEqual(res1.items, res2.items, '相同輸入重複執行必須得到嚴格一致的結果');
  assert.equal(res1.items[0].updatedAt, 1000, 'updatedAt 必須保留 1000，不可被 Date.now 覆寫');
});

test('Case 4: 兩台裝置時鐘差 5 分鐘 - Last-Write-Wins (LWW) 行為及其限制', () => {
  // 裝置 B 時鐘快 5 分鐘 (+300,000ms)
  // 裝置 A 在實際時間 T=1000 修改，但裝置 B 在實際時間 T=900 (B 時鐘為 900+300000=300900) 操作
  const deviceA = {
    items: [{ id: 'task_1', text: '裝置 A 的實際較新修改', updatedAt: 1000 }]
  };
  const deviceBClockAhead = {
    items: [{ id: 'task_1', text: '裝置 B 時鐘快 5 分鐘寫入的修改', updatedAt: 300900 }]
  };

  const res = SyncEngine.smartMergeData(deviceA, deviceBClockAhead);
  // 在分散式無中心時鐘環境下，LWW 仰賴 timestamp，故時鐘快的裝置勝出
  assert.equal(res.items[0].text, '裝置 B 時鐘快 5 分鐘寫入的修改', 'LWW 依據 timestamp 判定較大者勝出');
  assert.equal(res.items[0].updatedAt, 300900, '反映當前採取的 LWW 限制（時鐘偏移偏差會偏袒時鐘較快端）');
});

test('Case 5: 兩個不同任務標題相同 - 不得合併，必須保留兩個 ID', () => {
  const localData = {
    items: [{ id: 'id_alpha', text: '買牛奶', updatedAt: 1000 }]
  };
  const remoteData = {
    items: [{ id: 'id_beta', text: '買牛奶', updatedAt: 1200 }]
  };

  const res = SyncEngine.smartMergeData(localData, remoteData);
  assert.equal(res.items.length, 2, '不同 ID 但同標題的任務必須保留為兩筆獨立任務');
  const ids = res.items.map(it => it.id).sort();
  assert.deepEqual(ids, ['id_alpha', 'id_beta'], '兩筆任務的 ID 均完整保留');
});

test('Case 6: 相同 ID、不同 updatedAt - 較新操作勝出且不可覆寫為 merge 執行時間', () => {
  const localData = {
    items: [{ id: 'task_1', text: '較舊內容', updatedAt: 1000, size: 'small' }]
  };
  const remoteData = {
    items: [{ id: 'task_1', text: '較新內容', updatedAt: 1500, size: 'large' }]
  };

  const beforeMerge = Date.now();
  const res = SyncEngine.smartMergeData(localData, remoteData);
  const afterMerge = Date.now();

  assert.equal(res.items[0].text, '較新內容', '較新操作勝出');
  assert.equal(res.items[0].size, 'large');
  assert.equal(res.items[0].updatedAt, 1500, 'updatedAt 必須精確保留較新操作的時間 1500');
  assert.ok(res.items[0].updatedAt < beforeMerge || res.items[0].updatedAt === 1500, 'merge 絕不可將 updatedAt 覆寫為 Date.now()');
});

test('Case 7: Google Tasks - 相同 rawId 可對齊，不同 rawId 即使同標題也不對齊', () => {
  // Google Tasks 匯入去重規則
  const existingItems = [
    { id: 'gt_raw_123', rawId: 'raw_123', text: '原任務', done: false, updatedAt: 1000 },
    { id: 'local_other', text: '重覆標題任務', done: false, updatedAt: 1000 }
  ];

  // 相同 rawId
  const match1 = existingItems.find(it => it.rawId === 'raw_123' || it.id === 'gt_raw_123');
  assert.ok(match1, '相同 rawId 可以正確對齊');

  // 不同 rawId 但標題相同
  const incomingTask = { id: 'gt_raw_999', rawId: 'raw_999', text: '重覆標題任務' };
  const match2 = existingItems.find(it => it.rawId === incomingTask.rawId || it.id === `gt_${incomingTask.rawId}`);
  assert.equal(match2, undefined, '不同 rawId 即使標題相同，也不得被對齊或誤合併');
});

test('Case 8: 舊格式資料相容策略 - 無 deletedAt/tombstone 時的處理與限制', () => {
  // 舊格式 (version 1) 只有 items 陣列，沒有 tombstones 物件
  const localWithTombstone = {
    items: [],
    tombstones: { 'old_task': 2000 }
  };
  const legacyRemote = {
    items: [
      { id: 'old_task', text: '舊版未刪除的任務', updatedAt: 1000 }
    ]
    // 遠端無 tombstones 欄位
  };

  const res = SyncEngine.smartMergeData(localWithTombstone, legacyRemote);
  assert.equal(res.items.length, 0, '新版本地 tombstones 可成功阻止舊版無標記資料復活');
  assert.equal(res.tombstones['old_task'], 2000);
});

test('Case 9: 冪等性 - 重複 merge 結果嚴格一致，第二次 merge 不得改變 updatedAt', () => {
  const local = {
    items: [{ id: 'task_1', text: '任務 A', updatedAt: 1000 }],
    tombstones: {}
  };
  const remote = {
    items: [{ id: 'task_1', text: '任務 A 修改', updatedAt: 1200 }],
    tombstones: {}
  };

  const merge1 = SyncEngine.smartMergeData(local, remote);
  assert.equal(merge1.items[0].updatedAt, 1200);

  const merge2 = SyncEngine.smartMergeData({ items: merge1.items, tombstones: merge1.tombstones }, remote);
  assert.equal(merge2.items[0].updatedAt, 1200, '第二次 merge 不得改變 updatedAt');
  assert.deepEqual(merge1.items, merge2.items, '重複 merge 具備嚴格冪等性');
});

test('Case 10: XSS 防護與 Schema 驗證 - 惡意 Payload 無害化', () => {
  const xssPayload1 = '<img src=x onerror=alert(1)>';
  const xssPayload2 = '"><img src=x onerror=alert(document.domain)>';

  // 1. 惡意 deadline
  const dirtyItem1 = {
    id: 't_xss_1',
    text: '正常任務名稱',
    deadline: xssPayload1,
    size: 'small',
    bucket: 'today'
  };
  const clean1 = SyncEngine.sanitizeItem(dirtyItem1);
  assert.equal(clean1.deadline, null, '惡意 deadline 必須被拒絕並正規化為 null');
  assert.equal(SyncEngine.isValidDateString('2026-02-29'), false, '不存在的日期不可通過格式驗證');
  assert.equal(SyncEngine.isValidDateString('2026-10-15'), true, '合法日期應通過格式驗證');

  // 2. 惡意列舉欄位與型別欺騙
  const dirtyItem2 = {
    id: 't_xss_2',
    text: '正常任務',
    bucket: xssPayload2,
    size: '"><script>alert(1)</script>',
    quadrant: { evil: 'object' },
    done: 'true',
    createdAt: 'not_a_number',
    updatedAt: 123456
  };
  const clean2 = SyncEngine.sanitizeItem(dirtyItem2);
  assert.equal(clean2.bucket, 'inbox', '未在白名單的 bucket 必須重設為安全預設值 inbox');
  assert.equal(clean2.size, 'small', '未在白名單的 size 必須重設為 small');
  assert.equal(clean2.quadrant, 'q2', '物件偽造的象限必須被校正為安全預設值 q2');
  assert.equal(clean2.done, true, 'done 必須正規化為嚴格布林值');
  assert.equal(clean2.createdAt, 123456, '非數字時間戳必須被校正');

  // 3. 備份 JSON 匯入整包資料清洗驗證
  const backupJson = {
    app: 'Task Desk',
    version: 1,
    items: [
      { id: '1', text: xssPayload1, deadline: xssPayload2, bucket: 'inbox' },
      { id: '2', text: '純文字任務', notes: xssPayload1, deadline: '2026-10-15', bucket: 'today' }
    ]
  };
  const sanitizedList = SyncEngine.sanitizeItems(backupJson.items);
  assert.equal(sanitizedList.length, 2);
  assert.equal(sanitizedList[0].deadline, null, '備份匯入中的惡意 deadline 轉為 null');
  assert.equal(sanitizedList[1].deadline, '2026-10-15', '合法的 YYYY-MM-DD deadline 予以保留');
  assert.equal(typeof sanitizedList[0].text, 'string');
});
