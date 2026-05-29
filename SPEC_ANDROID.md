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
2. **背景比對**：啟動後，App 在背景發送非同步 GET 請求至 `https://linkdx.github.io/dodo_ledger/version.json`，對帳核對最新版本。
3. **安全下載**：若發現遠端 `versionCode` 大於本地，App 會自動在背景下載 `app-update.zip`。
4. **指標傳遞**：下載完成後，App 在背景將 `app-update.zip` 寫入沙盒根目錄，同時生成 `current_hot_version.txt` 版本指標文字檔以傳遞版本信號。
5. **原生極速解壓與重定向**：下一次 App 開啟（冷啟動）時，原生 Android `MainActivity.java` 會在啟動第一時間讀取 `current_hot_version.txt` 內指明的版號，比對解壓目錄。若對應解壓目錄不存在，原生端會調用 Java 底層 `ZipInputStream` 進行極速解壓（耗時僅約 20ms）並清除 `.zip` 原始包以防硬碟塞滿，同時內建 **Zip Slip 漏洞路徑穿越防護** 機制。解壓無誤後，WebView 會動態重定向 `setServerUrl()` 載入沙盒 `index.html`，實現完美的無感熱更新閉環。
6. **優雅降級**：離線、伺服器異常或下載失敗時，直接忽略，自動降級讀取本地最新成功的沙盒快取或 APK 預置 bundled 版本，絕不卡頓 App。

### 6.3 覆蓋安裝版本自愈機制 (Crossover Installation Self-Healing)
為防範使用者在覆蓋安裝新版 APK 後，因手機沙盒中殘留舊版熱更新資源（`current_hot_version.txt`）而導致 WebView 被無條件重定向至舊網頁，`MainActivity.java` 內置了 `SharedPreferences` 版本比對器：
1. **原生覆蓋偵測**：App 啟動最前端會讀取當前 APK 的 `versionCode`（即 `buildNumber`），並與 `SharedPreferences` 中儲存的 `last_apk_version_code` 進行比對。
2. **自動掃除舊沙盒**：若偵測到 `當前 APK versionCode > 歷史紀錄`，判定為覆蓋安裝（或首次安裝）。原生端將主動掃除 `current_hot_version.txt` 版本指標與所有手機沙盒內的 `update_pack_*` 舊版網頁資源目錄。
3. **安全回退與儲存**：掃除完畢後，WebView 會安全回退並加載當前 APK 內置最新預置資源，並將新的 `versionCode` 寫入 `SharedPreferences`。
4. **網頁端雙重防護**：網頁端 `useLiveUpdates.ts` 啟動後亦會比對當前程式碼內置的 Web 版本號（`package.json` 的 `builtInVersionCode`）與 `localStorage` 的 `dodo_app_hot_version_code` 紀錄。一旦發現內置版本較新，便自動升級 `localStorage` 的紀錄為最新內置版，保障版本監控閣數據一致性，並阻斷重複下載舊包的 Bug。

### 6.4 App 內即時熱重載（Hot Reload）規格
為了提供極致的熱更新體驗，本專案打破了「必須關閉 App 重開才能生效」的限制，支援 App 內免重開一鍵即時熱重載：
1. **原生插件橋接**：於自訂的 `DodoInstallerPlugin` 插件中註冊 `@PluginMethod public void performHotReload(PluginCall call)`。
2. **即時背景解壓縮**：當 Web 端背景下載熱更新 ZIP 壓縮包成功（進度達到 `100%`），Web 端會呼叫 `performHotReload({ versionCode })`。原生端收到請求後，會立即在原生背景執行 ZIP 解壓縮與原始包清除，不需要等待冷啟動。
3. **動態路徑切換與 WebView 重載**：解壓完成後，原生端會在 UI 執行緒（Main Thread）中呼叫 `activity.getBridge().setServerBasePath(localPath)`，將 WebView 本地伺服器的根路徑動態指引向新的沙盒解壓目錄，並緊接著執行 `activity.getBridge().getWebView().reload()` 對 WebView 進行熱重載。
4. **貼心互動引導**：Web 端在 `Settings.vue` 內置進度 watcher，一旦背景下載進度達到 `100%`，系統會主動彈出馬卡龍色「🚀 立即套用新版本」對話框，詢問使用者是否立即熱重載，並在使用者確認後觸發，實現 1 秒內無縫套用最新網頁資源的流暢閉環。

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

---

## 8. Android APK 簽名安全隔離架構

為了確保「同一把金鑰持續簽名所有版本 APK」且「密碼絕不進入 Git 倉庫」，本專案採用雙層密碼安全隔離方案。

### 8.1 共享簽名金鑰 (Shared Keystore)
- **金鑰檔案**：`android/app/dodo-shared.keystore`（已 commit 至 Git Repo）
- **金鑰別名 (Alias)**：`dodo_key`
- **設計理由**：金鑰本身（二進位）為公開倉庫可見，但其解鎖密碼完全隔離在環境變數中，安全性符合業界標準。相較於金鑰 commit 前的問題（每次本地建置使用不同的 debug key 導致「無法覆蓋安裝 App」），此方案從根本消滅了簽名衝突。

### 8.2 密碼隔離三層架構

```
本地端                      CI/CD (GitHub Actions)
─────────────────────────  ──────────────────────────────
.env.local (Git 排除)       Repository Secrets
  DODO_STORE_PASSWORD         DODO_SIGNING_PASSWORD
  DODO_KEY_PASSWORD             ↓ (env 區塊注入)
       ↓ (prepare.cjs 同步)  DODO_STORE_PASSWORD
android/local.properties    DODO_KEY_PASSWORD
  dodo.store.password
  dodo.key.password
       ↓ (Gradle 讀取)
android/app/build.gradle
  signingConfigs.shared
```

### 8.3 `npm run prepare` 生命週期自癒腳本規格

`scripts/prepare.cjs` 在每次 `npm install` 後自動觸發，執行以下動作：

| 步驟 | 行為 | 環境 |
|---|---|---|
| **1. 密碼初始化** | 若尚未設定，詢問進入密碼；計算 SHA-256 Hash 寫入 `.env.local`，明文同步至 `android/local.properties` | 本地 TTY |
| **2. 金鑰重建** | 若密碼變更或金鑰缺失，備份舊金鑰並用新密碼重新產生 `dodo-shared.keystore` | 本地 TTY |
| **3. package-lock 自癒** | 掃描並將私有 registry `npm.synology.inc` 自動替換為官方 `registry.npmjs.org` | 本地 + CI |
| **4. CI 跳過互動** | 非 TTY 環境（`process.env.CI`）自動跳過詢問，直接讀取環境變數 | CI/CD |

### 8.4 密碼一致性設計
本專案刻意讓三個密碼完全一致，降低管理複雜度：

| 用途 | 儲存位置 | 格式 |
|---|---|---|
| **App 進入鎖定** | `.env.local` → `VITE_APP_PASSWORD_HASH` | SHA-256 單向雜湊 |
| **Android 金鑰密碼** | `android/local.properties` → `dodo.signing.password` | 明文（Git 排除檔） |
| **CI/CD 簽名密碼** | GitHub Secrets → `DODO_SIGNING_PASSWORD` | 明文（加密 Secret） |
| **金鑰自癒追蹤** | `.env.local` → `DODO_SIGNING_PASSWORD` | 明文（Git 排除檔） |

### 8.5 GitHub Actions 所需 Secrets

進行首次設定時，請至 GitHub Repository → Settings → Secrets and variables → Actions，新增以下單一 Secret：

| Secret 名稱 | 值 | 說明 |
|---|---|---|
| `DODO_SIGNING_PASSWORD` | 您的進入密碼 | 同時作為 keystore 與 key 的解鎖密碼 |

---

## 9. App 內一鍵檢查最新版本與原生覆蓋安裝規格

本專案自 Web 2.0.5 與 Android 1.0.8 (Build 9) 起，實作了一套基於原生 Java 自訂外掛的 **「App 內安全對帳、一鍵下載 APK 並覆蓋安裝」** 閉環機制。

### 9.1 原生 DodoInstaller 插件規格
在 Android 原生層，我們於 `MainActivity.java` 中手動註冊並實作了自訂的 Capacitor 原生插件 `DodoInstaller`：
- **插件名稱**：`DodoInstaller`
- **外掛方法**：`installApk(call: PluginCall)`
- **內部實作原理**：
  1. 接收前端下載到快取沙盒底下的 APK 檔案本地絕對路徑參數 `filePath`。
  2. 去除可能的 `file://` 前綴以獲得標準本機路徑。
  3. 驗證該實體檔案是否存在，若不存在則主動拒絕 `call.reject()`。
  4. 進行 Android SDK 版本校驗。若為 Android 7.0 (API 24, Nougat) 或以上，呼叫 `FileProvider.getUriForFile` 並指定 `${applicationId}.fileprovider` Authority，將路徑安全轉換為共享的內容 URI，並同時賦予 `Intent.FLAG_GRANT_READ_URI_PERMISSION` 讀取授權；若為舊版 Android，則直接轉換為 `Uri.fromFile`，完美阻斷 `FileUriExposedException` 漏洞。
  5. 構建並發起 `Intent(Intent.ACTION_VIEW)`，將 `DataAndType` 設定為該 `apkUri` 與標準 Android 安裝 MIME 類型 `application/vnd.android.package-archive`。
  6. 為 Intent 附加 `Intent.FLAG_ACTIVITY_NEW_TASK` 旗標以開啟獨立的安裝 Activity，並呼叫 `getContext().startActivity()` 喚起系統覆蓋安裝畫面。
  7. 呼叫 `call.resolve()` 回報成功。

### 9.2 AndroidManifest.xml 安裝權限配置
為支援 Android 系統拉起覆蓋安裝，必須於 `android/app/src/main/AndroidManifest.xml` 的 `<manifest>` 根節點下正式註冊下列安裝套件權限：
```xml
<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
```
此權限在 Android 原生層屬於**原生變更**。凡是涉及此原生修改，必須提升 `android-version.json` 中的版號，並要求使用者重新下載新版 APK 進行初始安裝。

### 9.3 遠端版本對帳與防禦性渲染 (Web 配合層)
- **防禦性渲染**：在設定頁面 `Settings.vue` 中，該更新卡片以 `v-if="Capacitor.isNativePlatform()"` 包裹，保證**僅在實體 Android 手機環境下渲染**，桌面瀏覽器則隱藏。
- **動態對帳流程**：
  1. 進入設定頁時，會在 `onMounted` 裡發起非同步 GitHub Release API 請求 (`https://api.github.com/repos/LinkDX/dodo_ledger/releases?per_page=100`)。
     > ⚠️ **不使用 `releases/latest`**：最新 release 可能是純 Web 發布（只含 `app-update.zip`，無 APK）。因此改用 releases 列表，並加 `?per_page=100` 確保不遺漏超過 30 筆的歷史版本。
  2. 遍歷 releases 列表（依發布時間由新到舊），找到**第一個含有 `.apk` 附件的 release**，略過所有純 Web release。利用正規表達式 `/v(\d+\.\d+\.\d+)/` 從檔名提取版本號（如 `dodo-ledger-v1.0.8.apk -> 1.0.8`）。
  3. 將本地端當前執行的 APK 版本（讀取自 `androidVersion.version`）與遠端版本利用三段式 Semantic Version 比對演算法 (`compareVersions`) 進行核對。
  4. 若遠端較新，則展示薄荷綠（`var(--color-income)`）的「立即一鍵覆蓋安裝」果凍按鈕。
  5. 點擊按鈕後，調用 `@capacitor/filesystem` 的 `Filesystem.downloadFile()` 方法，默默將 remote APK `browser_download_url` 的資源下載到私有沙盒 `Directory.Cache` 底下。
  6. 下載完成後，隨即呼叫原生插件 `DodoInstaller.installApk({ filePath: result.path })`，拉起系統覆蓋升級，形成完美的更新閉環。


