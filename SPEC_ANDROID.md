# Dodo Ledger —— Android 原生/混合式 App 系統規格書 (SPEC_ANDROID)

本文件詳細記載 Dodo Ledger 記帳服務移植至 Android 端（基於 **Capacitor 離線優先與熱更新方案**）的技術規格、Android 專屬功能設計、安全鎖持久化邏輯、離線同步演算法與自動化 CI/CD 發布規格。

---

## 1. 系統技術架構與設定

- **運行容器**：[Capacitor 6.x](https://capacitorjs.com/) 封裝的 Android WebView 容器。
- **套件識別碼 (Application ID / Package Name)**：`com.luke.dodoleddger`
- **前端核心**：Vite + Vue 3 + TypeScript + Vanilla CSS (Scoped)
- **原生外掛整合**：
  - 本地持久化：`@capacitor/preferences` (橋接至 Android 的 `SharedPreferences`)
  - 系統本地通知：`@capacitor/local-notifications` (橋接至 Android 的 `NotificationManager`)

---

## 2. 離線優先 (Offline-First) 與資料雙向同步規格

為了提供無縫的離線記帳體驗，系統內建「雙層離線優先同步機制」，確保在斷網時能照常記帳，並在上線後自動安全合併。

### 2.1 內建持久化快取 (Firestore Local Cache)
- **資料庫連接**：Firestore Web SDK 啟用 IndexedDB 快取。
- **實作規格**：在 `src/services/db.ts` 中配置：
  ```typescript
  import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
  
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
  ```
- **離線狀態表現**：使用者在離線狀態下進行的一切增、刪、改操作，會「立即」寫入本地 IndexedDB 並觸發 UI 變更。一旦網路恢復，SDK 會在背景自動將變更佇列安全上傳。

### 2.2 免登入本地身分 (Profile) 轉綁定 Firebase 時的「手動批次同步」
當使用者在離線狀態下以「免登入本地身分」記帳，上線後決定註冊並綁定 Google/Firebase 帳號時，系統必須執行以下批次移轉程序：
1. **讀取本地端暫存**：自 LocalStorage 中撈出該身分（`userId`）下的所有 `accounts`、`transactions` 與 `recurring` 設定。
2. **生成稽核欄位**：在寫入雲端前，為每筆資料補上 `syncStatus = "synced"` 與 `updatedAt = Date.now()`。
3. **Firestore 批次寫入 (WriteBatch)**：使用 `writeBatch()` 將所有本地資料打包成單一事務一次性寫入雲端：
   ```typescript
   import { writeBatch, doc } from 'firebase/firestore';
   
   const batch = writeBatch(firestore);
   localTransactions.forEach(tx => {
     const txRef = doc(firestore, `ledgers/dodo_shared_ledger/transactions/${tx.id}`);
     batch.set(txRef, { ...tx, syncStatus: 'synced', updatedAt: Date.now() });
   });
   await batch.commit();
   ```
4. **清空本地暫存**：上傳成功後，清空本地端的 Key，並將 App 資料來源完全導向雲端。

### 2.3 衝突解決機制 (Conflict Resolution)
1. **UUID 主鍵**：所有實體在本地建立時一律使用隨機的 **UUID** 作為 `id`，保證離線建立的帳目在上網同步時 100% 絕不發生 ID 重複衝突。
2. **最後寫入者獲勝 (Last-Write-Wins, LWW)**：
   - 每筆資料皆攜帶 `updatedAt` 毫秒時間戳記。
   - 同步比對時，若雲端已存在相同 ID，則以 `updatedAt` 較新者覆寫較舊者。

---

## 3. App 安全鎖持久化解鎖規格 (免重複輸入)

Web 端的密碼解鎖狀態僅存在 `sessionStorage`，這在 App 經常被滑掉重開的環境下體驗不佳。Android 端安全鎖機制規格如下：

- **解鎖狀態記住機制**：
  - 當使用者於 App 首頁輸入正確密碼並驗證成功時，除了 `sessionStorage` 外，系統會同步將解鎖成功標籤寫入 `localStorage` (由 Capacitor 映射至 `SharedPreferences`)：
    `localStorage.setItem('dodo_app_lock_persistent_session', 'unlocked_authorized')`
  - **自動免解鎖**：App 重新啟動時，若該標籤存在且有效，且密碼雜湊未被更改，則自動略過密碼輸入頁，秒速進入記帳畫面。
- **解鎖狀態清除（安全防護）**：
  - 當使用者在 App 設定中點擊**「手動鎖定/登出」**，或執行**「變更密碼」**時，系統會立即執行：
    `localStorage.removeItem('dodo_app_lock_persistent_session')`
    下一次重開 App 時，必須重新輸入密碼解鎖。

---

## 4. 離線狀態下的「逗逗貓」表情與氣泡互動規格

Dodo Ledger 的首頁逗逗貓表情不能因為斷網而失效，規格如下：

- **本地預算比例計算**：
  - 即使離線，首頁加載時，`useLedger.ts` 依然從本地快取計算出當月的 `monthlyExpense` 與當前 Profile 的 `monthlyBudget` 消耗比（`budgetRatio`）。
- **表情照常變換**：
  - 當月預算消耗 $< 60\%$：**開心地玩毛線**（呼吸微動畫 `.cat-wiggle`）
  - 當月預算消耗 $60\% \sim 80\%$：**有些小緊張**（耳朵下垂）
  - 當月預算消耗 $80\% \sim 100\%$：**流汗驚嚇**（額頭冒汗滴）
  - 當月預算消耗 $> 100\%$：**遮眼大哭**（爪爪擦眼淚）
- **離線泡泡話語規格**：
  - 離線時，逗逗貓氣泡會多出特定提示句：
    *「喵～主人！我們目前是離線記帳狀態喔！等有了網路，我會主動把帳本打包安全送回雲端喵！」*

---

## 5. 週期性自動記帳與 Android 原生本地通知規格

配合「啟動時懶惰檢查 (Lazy-check on Startup)」機制，實作手機系統層級的通知體驗：

- **原生通知觸發條件**：
  - 當 App 啟動時，`checkAndTriggerRecurring()` 比對時間發現有離線期間「過期未自動扣款」之週期項目，並於本地補齊記帳後。
- **原生通知 API 整合**：
  - 使用 `@capacitor/local-notifications` 發送本地系統通知。
- **通知格式與體驗設計**：
  - **通知標題**：`🐱 逗逗貓理財報告`
  - **通知內容**：`喵～主人！剛剛我趁您不在，幫您付了 [項目] 共 [金額] 元喔！`
  - **音效與震動**：啟用系統預設通知音效，吸引使用者注意。

---

## 6. 自建 GitHub Pages 熱更新 (Live Updates) 規格

為了避免網頁版與 App 版版本不同步，設計 100% 免費且自主掌控的熱更新機制：

### 6.1 熱更新檔案結構 (位於 GitHub Pages 根目錄)
- **`version.json`**：記錄最新網頁包的版本資訊與下載路徑：
  ```json
  {
    "versionCode": 102,
    "versionName": "1.0.2",
    "downloadUrl": "https://luke.github.io/dodo_ledger/app-update.zip",
    "hash": "sha256-abc123xyz...",
    "releaseNote": "修復了逗逗貓大哭時的表情對齊問題，並優化了分期帳戶的計算速度喵！"
  }
  ```
- **`app-update.zip`**：由 `npm run build` 編譯出之最新 `dist` 資料夾的完整壓縮包。

### 6.2 雙緩衝無感更新流程 (Double-Buffering)
1. **本地秒開**：App 啟動時，WebView 優先載入目前本地端私有沙盒（Sandbox）目錄下的網頁資源。
2. **背景比對**：啟動後，App 在背景發送非同步 GET 請求至 `https://luke.github.io/dodo_ledger/version.json`。
3. **安全下載**：若發現遠端 `versionCode` 大於本地，且處於 WiFi/行動網路下，App 會自動在背景下載 `app-update.zip`。
4. **雜湊校驗**：下載完成後，計算檔案 SHA-256 Hash 值。若與 `version.json` 聲明一致，則解壓至沙盒中新目錄，並更新 App 的「下一次啟動載入路徑」指標。
5. **套用與降級**：使用者下一次打開 App 或切回前景時即可體驗最新功能。離線或下載失敗時，直接忽略，不影響當前使用。

---

## 7. 本地快速建置與測試指南 (CLI)

我們為本專案設計了極速建置腳本 `./build-apk.sh`，方便您隨時在本地一鍵產生 APK。

### 7.1 本地一鍵產生測試 APK
於專案根目錄下執行：
```bash
chmod +x build-apk.sh
./build-apk.sh
```
該腳本會自動完成：
1. 編譯 Vue 前端資源 (`npm run build`)。
2. 同步資源至 Android 容器 (`npx cap sync android`)。
3. 呼叫 Gradle 編譯出 Debug APK 檔。
4. 將產出的 APK 自動複製並重新命名，放置於專案根目錄的 `build-artifacts/dodo-ledger-debug.apk`。
