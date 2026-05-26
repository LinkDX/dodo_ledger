# Dodo Ledger 記帳服務 🐱💸

> 歡迎來到「Dodo Ledger」—— 這是一個溫馨插畫繪本風格、由超軟萌「逗逗貓」陪伴您記帳的個人理財服務。
> 第一版透過 Vite + Vue 3 + TypeScript 打造，支援免登入本地體驗，並能無縫升級 Firebase 雲端同步，保留後續移植 Android App 的完美彈性！

---

## 🎨 專案特色

1. **🐱 逗逗貓療癒看板**：首頁最上方是逗逗貓的大版面生活秀，貓咪會隨著您的預算消耗程度改變表情（玩毛線、流汗、貓爪遮眼哭哭），還會在自動週期扣款時伸懶腰喵喵叫報告！
2. **🧮 QQ 果凍計算機鍵盤**：胖乎乎的大按鈕自訂虛擬鍵盤，支援邊記邊算，點擊時更有果凍般的 QQ 彈性縮放反饋。
3. **📂 嚴謹雙層分類**：支援「主分類 ➜ 子分類」的雙層分類結構（如：餐飲 ➜ 早餐/午餐），滿足對帳務細緻度要求極高的您。
4. **💳 信用卡完整生命週期**：支援「額度當下全扣，分月攤還」嚴謹分期邏輯、未出帳/已出帳單自動歸屬、結帳日繳款日管理，以及一鍵扣繳連動還款交易。
5. **🔄 雙資料存取模式**：預設免登入、免填寫金鑰，直接在 LocalStorage 體驗完整功能，逗逗貓貼身相伴；隨時可在設定中輸入 Firebase 設定一鍵備份升級至雲端。
6. **🛡️ 業界級 DevOps 機制**：內建 Vitest 單元測試，配置 GitHub Actions CI/CD，發布到 GitHub Pages 前會進行 100% 自動化測試與 TypeScript 編譯驗證。

---

## 🚀 快速開始

為了簡化您的開發操作，我們提供了**一鍵自動化腳本**：

### 1. 本地啟動與開發重啟
您不需要手動輸入繁瑣的 `npm run dev`，我們提供了一鍵啟動腳本 `./run.sh`。
此腳本會自動為您安裝相依性套件（如果未安裝），並啟動/重啟 Vite 本地伺服器：
```bash
# 啟動或重啟開發環境
./run.sh
```

### 2. 本地手動部署
如果您需要手動將目前的成果打包並部署到 GitHub Pages，可以直接執行：
```bash
# 執行自動測試、建置並發布
./deploy.sh
```

---

## 🧪 自動化測試與 CI/CD

本專案採用 **Vitest** 作為測試引擎，核心的轉帳手續費折算、信用卡分期分攤算法皆有完整測試覆蓋。

- **執行測試**：`npm run test`
- **執行測試並產生報告**：`npm run test:run`

當您將專案推送至 GitHub 時，`.github/workflows/deploy.yml` 工作流會自動觸發：
`TS 編譯檢查` ➔ `Vitest 測試` ➔ `Vite 編譯建置` ➔ `自動部署至 gh-pages 分支`。如果測試未通過，將自動攔截發布，確保 GitHub Pages 線上版本永遠健康無 Bug！

---

## 📂 目錄結構

```text
├── .github/workflows/   # GitHub Actions CI/CD 設定
├── src/
│   ├── assets/          # 靜態資源 (馬卡龍配色插畫等)
│   ├── components/      # UI 元件 (DodoCat, Dashboard, CreditCardCenter)
│   ├── composables/     # 全域狀態管理 (useLedger.ts 核心業務邏輯)
│   ├── services/        # 資料存取層 (db.ts，LocalStorage 與 Firebase 雙核心)
│   ├── types/           # TypeScript 類型定義
│   ├── App.vue          # 主頁面與 Tab 導航
│   ├── index.css        # 設計系統與 QQ 果凍動畫樣式
│   └── main.ts          # 專案入口
├── tests/               # Vitest 自動化測試檔案
├── run.sh               # 一鍵啟動/重啟腳本
├── deploy.sh            # 一鍵打包部署腳本
├── SPEC.md              # 系統規格與演算法定義文件
├── GEMINI.md            # AI 協同開發手冊
└── CHANGELOG.md         # 版本變更日誌
```

---

## 📱 未來 Android 移植展望

本專案在架構上將 **資料處理 (`useLedger.ts`)** 與 **UI 元件** 徹底解耦：
- **方案 A (快速包殼)**：您可直接使用 Capacitor 將本 React/Vue SPA 專案封裝打包成 `.apk` 部署。
- **方案 B (原生 Compose)**：因為本專案的 Reactive 狀態設計與 **Kotlin Jetpack Compose** 極度契合，您可以參考 `GEMINI.md` 的 AI 提示詞引導，讓 AI 自動將 TypeScript 邏輯轉譯成 Android 原生 ViewModel 與 Canvas 動畫！
