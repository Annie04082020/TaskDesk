# Task Desk (個人任務工作桌)

一個低壓力、高專注的個人任務管理工作桌。將腦袋中的想法快速倒入收集箱，並將任務精確分流為「這週」、「保溫」與「放生」三堆。

---

## 設計原則

1. **工具只呈現與限制，不指揮**：語氣維持客觀中性，不提供「你該去做了」等催促用語或遊戲化懲罰機制。
2. **決定權在使用者**：「現在做這個」由使用者主動指定，系統不強制排序或自動指派。
3. **降低開啟壓力**：預設僅展開「這週」的任務，其餘分類預設收合，點擊後才呈現。
4. **規則皆可自訂**：「這週」任務上限（預設 3 件，可自由增減）、分類標籤、狀態諮詢條件等皆可自訂。
5. **零後端、零付費服務**：資料皆存放於使用者裝置的本機儲存空間（LocalStorage），無資料外洩風險。

---

## 核心功能

### 1. 三堆分流架構
* **收集箱 (Inbox)**：快速記錄未整理的靈感與待辦事項。
* **這週 (Week)**：設有嚴格數量上限（預設 3 件）。使用者可指派其中一項為「現在做這個」，置頂凸顯。
* **保溫 (Keep)**：尚不急著執行、但保留追蹤的任務。
* **放生 (Release)**：目前不打算執行或已暫停的事項，移出注意力範圍。

### 2. 狀態諮詢（幫我選）
當不知從何著手時，系統會根據當前情境提供篩選建議：
* 所在位置（在家 / 在學校 / 任意）
* 體力狀態（低 / 中 / 高）
* 腦力狀態（低 / 中 / 高）
* 可用時間（15 分 / 30 分 / 1 小時 / 更久）
* 後續行程安排

篩選後列出最適合執行的候選任務，並支援以對話方式進一步微調。

### 3. Google Tasks 與批次匯入
* 支援由 Google Takeout 匯出的 `Tasks.json` 檔案直接匯入。
* 支援複製純文字清單（一行一項）快速貼上。
* 可選擇過濾已完成項目，並依關鍵字或規則自動標記任務類型。

### 4. 跨裝置手動同步
* **GitHub Gist 同步**：透過 Personal Access Token，於電腦與手機間雙向合併最新資料（依據時間戳記聰明解析）。
* **裝置代碼直傳**：免設定 Token，直接將本機資料轉換為單一同步字串，貼至另一裝置即可合併。

### 5. 隱私防護與外觀適配
* **本機 PIN 碼鎖定**：採用 Web Crypto API (SHA-256) 本機加密比對，防止公開部署或他人借用設備時窺探任務內容。
* **外觀風格**：深色模式（Deep Space Tech Dark），搭配 JetBrains Mono 等字型。
* **螢幕挖孔避讓**：提供頂部安全邊距調整滑桿，可針對 Zenfone 10 等具備前鏡頭挖孔的機型微調 Navbar 高度。

---

## 技術架構

* **前端核心**：純 HTML5、CSS3、Vanilla JavaScript（無第三方框架依賴）。
* **離線與安裝支援**：PWA (Service Worker + Web App Manifest)。
* **原生行動端封裝**：Capacitor 7 (Android)。
* **自動化工作流程**：GitHub Actions（自動部署 GitHub Pages 與打包 Release APK）。

---

## 本地開發與建置

### 1. 啟動本機預覽
專案為靜態 Web 應用，可直接透過任何靜態檔案伺服器執行：

```bash
# 使用 Python 內建伺服器
python -m http.server 8080

# 或使用 Node.js
npx serve .
```

開啟瀏覽器前往 `http://localhost:8080` 即可使用。

### 2. 打包 Web 靜態資源
將根目錄的核心網頁檔案同步至 `www/` 目錄：

```bash
node build.js
```

### 3. 封裝 Android APK
專案已配置 Capacitor 支援：

```bash
# 安裝依賴套件
npm install

# 同步資源至 Android 專案
npx cap sync android

# 使用 Android Studio 開啟
npx cap open android
```

若環境中已安裝 Android SDK 與 JDK 21，亦可直接使用 Gradle 指令建置：

```bash
cd android
./gradlew assembleDebug
```

產生的 APK 檔案位於 `android/app/build/outputs/apk/debug/app-debug.apk`。

---

## 資料安全性

本工具所有資料（包含任務項目、備註、個人設定、API Key 與 Token）均僅儲存於使用者瀏覽器或 WebView 的 LocalStorage 中，不會傳輸至任何未經使用者設定的第三方伺服器。

---

## 授權條款

MIT License
