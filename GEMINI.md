# Dodo Ledger AI 協同開發手冊 (GEMINI)

本檔提供本專案的實作共識，供 Gemini 或其他 LLM 在擴充功能、維護 Android、更新圖示與 CI/CD 時遵循。

---

## 0. 快速必讀

### 0.1 `npm install` / registry 污染
- 開發環境可能把 `package-lock.json` 污染成 `https://npm.synology.inc`，GitHub Actions 會因此 `ENOTFOUND`。
- **現況**：`npm run prepare` / `scripts/prepare.cjs` 會自動修正為 `https://registry.npmjs.org`。
- **手動驗證**：
  ```bash
  grep -c "synology" package-lock.json
  ```
  輸出應為 `0`。
- **必要時手動修復**：
  ```bash
  sed -i 's|https://npm.synology.inc|https://registry.npmjs.org|g' package-lock.json
  ```

### 0.2 文件同步
- 核心邏輯、UI、原生整合、CI/CD 變更時，同步更新 `CHANGELOG.md`、`SPEC.md`、`GEMINI.md`。

---

## 1. Web / Vue 開發規範

### 1.1 程式風格
- 一律使用 Vue 3 `<script setup lang="ts">`。
- 業務型別集中於 `src/types/index.ts`。
- 全域狀態一律經 `src/composables/useLedger.ts`；元件內以解構方式使用：
  ```ts
  import { useLedger } from '@/composables/useLedger'
  const { accounts, transactions, addTransaction } = useLedger()
  ```

### 1.2 樣式 / 動畫
- 元件樣式一律 `<style scoped>`。
- 顏色禁止硬編碼，請用 `src/index.css` 內的 `var(--color-...)`：
  - 背景：`--color-bg-warm`（`#FFF8EC`）
  - 支出：`--color-expense`
  - 收入：`--color-income`
  - 轉帳：`--color-transfer`
  - 文字：`--color-text-dark`
- 可點擊元件套用 `.btn-jelly`；等價效果如下：
  ```css
  .btn-jelly:active {
    transform: scale(0.92);
    transition: transform 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
  ```

### 1.3 Dodo Cat SVG 規範
- 實作位置：`src/components/DodoCat.vue`。
- 表情切換以 `computed` 控制 SVG path / 整張 SVG。
- 固定品牌色：
  - 輪廓：`#3D2B1F`
  - 貓身：`#FDF6EE`
  - 耳內 / 腮紅：`#F9C4C4`
  - 領圈：`#C3B1E1`
  - 錢包：`#A8E6CF`
- 鼻子固定為帶描邊粉桃倒三角。
- `nervous` 表情右耳必須用「底座 + 翻折蓋」雙 path，且不可隱藏內耳：
  - 底座：`M 140 90 L 150 71 L 125 62 L 115 70 Z`
  - 內耳：`M 140 85 L 147 73 L 127 65 Z`
  - 翻折蓋：`M 150 71 L 156 80 L 125 62 Z`
- 新增表情時維持簡潔扁平 SVG 線條，並加 `.cat-wiggle` 呼吸 / 擺尾動畫。

### 1.4 品牌圖示

| 項目 | 路徑 / 規範 |
|---|---|
| 主圖示 | `public/dodo-icon.svg`：全身版、奶油黃圓角背景 |
| Favicon | `public/favicon.svg`：32x32 精簡臉部版 |
| 固定調色盤 | 背景 `#FFF8EC`、貓身 `#FDF6EE`、耳內/腮紅 `#F9C4C4`、錢包 `#A8E6CF`、扣環 `#F4C842`、領圈 `#C3B1E1`、輪廓 `#3D2B1F` |

- 更新圖示後執行：
  ```bash
  npm run generate:icons
  npm run generate:splash
  ```
- 輸出位置：
  - `android/app/src/main/res/mipmap-*`
  - `android/app/src/main/res/drawable-*`

### 1.5 UI 元件原則
- 禁止使用原生 `select`、`alert`、`confirm` 等瀏覽器原生 UI。
- 一律使用自製 SFC + 馬卡龍配色 + Jelly 動畫。自訂選單（例如 `src/components/AccountDropdown.vue`）必須支援 RWD 寬度適配，當帳戶名稱過長時自動透過 `text-overflow: ellipsis` 進行「...」截斷，且與金額採上下雙行排版，防範手機畫面擠壓跑版。
- 全域 Dialog：
  - Confirm：`src/composables/useConfirm.ts` + `<CuteConfirmDialog />`
  - Alert：`src/composables/useAlert.ts` + `<CuteAlertDialog />`
- 兩個 Dialog 元件都必須放在 `App.vue` **最外層**，避免 `AppLock` / `UserSelection` 等分支畫面遮蔽。

---

## 2. Android / Capacitor 架構

### 2.1 基本資訊
- 套件名稱：`com.luke.dodoleddger`
- 設定檔：`capacitor.config.ts`
- 原生專案：`android/`
- 打包腳本：`./build-apk.sh`（自動處理 JDK 17、同步資源、編譯 release）
- 產物：
  - `build-artifacts/dodo-ledger-v{version}.apk`
  - `build-artifacts/dodo-ledger-latest.apk`

### 2.2 Android 版本管理
- 唯一來源：`android-version.json`
  ```json
  { "version": "1.0.0", "buildNumber": 1 }
  ```
- `android/app/build.gradle` 會讀取此檔同步 `versionName` / `versionCode`。
- 發版流程：修改 `android-version.json` 后 push，即觸發 GitHub Actions，發布：
  - `android-vX.Y.Z`
  - `latest`

### 2.3 離線優先 / 同步
- `src/services/db.ts` 啟用 Firestore + IndexedDB 離線快取。
- 衝突策略：`updatedAt` + 隨機 ID，採 Last-Write-Wins。
- `src/composables/useAppLock.ts` 使用 SharedPreferences 持久化解鎖狀態；手動鎖定或改密碼時立即重設。

### 2.4 Live Updates
- 入口：`src/composables/useLiveUpdates.ts`，於 `src/App.vue` `onMounted` 觸發。
- 版本對帳：`https://linkdx.github.io/dodo_ledger/version.json`
- 發現新版時下載 `app-update.zip` 到沙盒，並寫入 `current_hot_version.txt`。
- 下次冷啟動時，`MainActivity.java`：
  - 讀取版本指標
  - 以 `ZipInputStream` 原生解壓
  - 清掉 ZIP
  - 以 `this.bridge.setServerUrl()` 轉向沙盒 `index.html`
- 安全要求：
  - 必須保留 Zip Slip 路徑穿越防護
  - 斷網 / 伺服器異常時要降級為本地資源
  - 不依賴 Appflow / Capgo
- 覆蓋安裝自癒：
  - `MainActivity.java` 以 SharedPreferences 比對 `versionCode`
  - 若 APK 版本升高，主動清除 `current_hot_version.txt` 與 `update_pack_*`
  - `useLiveUpdates.ts` 同步刷新 `localStorage` 版本記錄

### 2.5 Capacitor 插件 / 網路
- 本地通知：`@capacitor/local-notifications`
- `CapacitorHttp` **禁止**在 `capacitor.config.ts` 開全域 patch；僅在需要繞過 CORS（如熱更新下載）時手動：
  ```ts
  import { CapacitorHttp } from '@capacitor/core'
  ```
- Capacitor 插件一律用動態 `import()`，保持 Web 相容：
  ```ts
  import('@capacitor/local-notifications').then(({ LocalNotifications }) => {
    LocalNotifications.schedule({ ... })
  })
  ```

### 2.6 App 內更新 / 覆蓋安裝
- 原生平台下，`Settings.vue` 顯示「📱 原生 Android 系統更新」卡片。
- 更新來源：GitHub REST API `releases?per_page=100`（**不用 `releases/latest`**，因最新 release 可能是純 Web 發布無 APK）。遍歷列表找第一個含 `.apk` 附件的 release。
- APK 下載：`@capacitor/filesystem` 的 `Filesystem.downloadFile()`，存至 `Directory.Cache`。
- 安裝：呼叫 `MainActivity.java` 註冊的 `DodoInstaller.installApk({ filePath })`。
- 原生層須使用 `FileProvider`、`FLAG_GRANT_READ_URI_PERMISSION`，避免 `FileUriExposedException`。
- `AndroidManifest.xml` 必須含：
  ```xml
  <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
  ```
- 以上原生變更都屬 **Android 原生變更**：必須重編 APK，且必須提升 `android-version.json` 版號。

### 2.7 原生移植提示
- 若要改寫為 Kotlin / Jetpack Compose，提示詞至少要涵蓋：
  1. 參考 `src/composables/useLedger.ts` 與 `SPEC.md`
  2. 建立 Firebase Data Class / Repository
  3. 實作「信用卡額度當下全扣、分月攤還」與「轉帳手續費獨立支出化」
  4. 把 `src/index.css` 色票、`DodoCat.vue`、`public/dodo-icon.svg` 移植到 Compose
  5. 重現 Jelly 動畫與逗逗貓動態表情

---

## 3. 測試、CI/CD、版本與稽核

### 3.1 測試 / 提交
- 修改核心帳務、分期、轉帳邏輯時，必跑：
  ```bash
  npm run test:run
  ```
- 提交前需通過 TypeScript 編譯與 Vitest。
- 每次交付功能後更新 `CHANGELOG.md`。

### 3.2 CI/CD 雙管線

| 管線 | 設定檔 | 觸發條件 | 產物 |
|---|---|---|---|
| Web | `.github/workflows/deploy.yml` | `src/**`、`public/**`、`index.html`、`package.json`、`package-lock.json` | GitHub Pages |
| Android | `.github/workflows/android.yml` | `android-version.json`、`android/**`、`build-apk.sh`、`capacitor.config.ts` | Release APK + version tag + `latest` |

### 3.3 Android 原生變更規則
- 只要改到 Android 管線觸發檔（尤其 `capacitor.config.ts`，含 revert）就算 **原生變更**。
- 必做：
  1. 更新 `android-version.json` 的 `version` 與 `buildNumber`
  2. 在 `CHANGELOG.md` 新增對應 Android 條目
  3. 提醒使用者需重新安裝 APK
- Web 與 Android 發版互不影響。

### 3.4 財務日誌 / 稽核
- `SystemLog` 只記核心財務與成員變更；**不要記** 摸貓、餵貓等娛樂操作。
- 記帳、刪除、還款、週期自動執行、成員 / 預算 / 分類變更時，第一時間呼叫 `addSystemLog`。
- 日誌寫入一律採 **append-only**（`appendLog` / 單文件 `setDoc`）；禁止讀全量後覆蓋，避免多裝置互蓋。
- `./view-logs` 維持 Firestore REST API 實作，不引入笨重 Firebase SDK。

### 3.5 多人並發規範
- 詳細規格見 [`SPEC_CONFLICT_RESOLUTION.md`](./SPEC_CONFLICT_RESOLUTION.md)。
- 核心原則：
  - 禁止對交易 / 帳戶使用 `writeCollection` 全量覆寫（初始化除外）
  - 餘額變更一律用 `increment()`
  - 交易 CRUD 一律包在 `atomicBatchWrite`
  - 週期記帳用 `claimDocument` 防重複執行

### 3.6 `package-lock.json` 規範
- 私有 registry 污染由 `scripts/prepare.cjs` 自動修復。
- 安裝新套件建議流程：
  ```bash
  npm install <new-package> --legacy-peer-deps
  grep -c "synology" package-lock.json
  git add package.json package-lock.json
  git commit -m "chore: 安裝 <new-package>"
  ```

### 3.7 APK 簽名
- 共用金鑰：`android/app/dodo-shared.keystore`（已 commit）。
- 密碼來源：
  - 本地：`npm install` 時輸入，`prepare.cjs` 同步至 `android/local.properties`（Git ignore）
  - CI：GitHub Secret `DODO_SIGNING_PASSWORD`
- `build.gradle` 禁止硬編碼密碼，僅可由環境變數 / `local.properties` 讀取。
- App 密碼、keystore 密碼、`DODO_SIGNING_PASSWORD` 刻意保持一致。
- `npm run prepare` 可在密碼變更 / 金鑰缺失時自動備份並重建 keystore。

### 3.8 CHANGELOG 規範
- 標題格式：
  - Web only：`## [Web X.Y.Z] - YYYY-MM-DD`
  - Android only：`## [Android A.B.C / Build N] - YYYY-MM-DD`
  - 雙端：`## [Web X.Y.Z / Android A.B.C / Build N] - YYYY-MM-DD`
- 判定：
  - 改 `src/`、`public/`、`package.json` => 含 Web
  - 改 `android/`、`capacitor.config.ts`、`android-version.json` => 含 Android
- 若前一版本 **已經 push / 發布至遠端倉庫**：
  - 當前若有任何新程式變更（不論多微小），**一律必須遞增版號**，絕對禁止將新變更併入已推送的舊版號中，以維持發布與 CI/CD 流水線的追蹤完整性。
- 若前一版本 **尚未 push**（純屬本地未推送的 commit 且尚未發布）：
  - 不需要遞增版號。
  - 直接把新內容併入前一筆 `CHANGELOG`，並可搭配 `git commit --amend`。
  - 維持 `package.json` / `android-version.json` 不變。
- 只有前版已發布（已 push），或此次是重大分發，才遞增版號。

### 3.9 SemVer
- **Patch**：向後相容的 bug fix / 微調 / 小修補。
- **Minor**：向後相容新功能，或重大 Android 原生變更（如 `MainActivity.java`、啟動畫面、圖示）；Android minor 升級代表需重新安裝 APK。
- **Major**：破壞相容的 API / 資料 Schema / 品牌大改版。

