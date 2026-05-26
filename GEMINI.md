# Dodo Ledger —— AI 協同開發手冊 (GEMINI)

本手冊專為 Gemini 系列模型（如 Antigravity 助理）或任何其他大型語言模型 (LLM) 設計，記錄了 Dodo Ledger 專案的開發設計共識與脈絡，以便在後續的功能擴展或 Android 移植中，維持完全一致的程式風格與品質。

---

## 1. 專案開發風格共識

當您（AI 助理）為本專案新增或修改程式碼時，請務必遵循以下規範：

### 1.1 Vue 3 程式風格
- **Composition API**：一律使用 `<script setup lang="ts">` 語法糖。
- **類型宣告**：嚴格使用 TypeScript，並在 `src/types/index.ts` 中定義完整的業務介面。
- **狀態管理**：全域狀態一律透過 `src/composables/useLedger.ts` 管理。元件內使用解構賦值獲取需要的響應式資料與方法：
  ```typescript
  import { useLedger } from '@/composables/useLedger'
  const { accounts, transactions, addTransaction } = useLedger()
  ```

### 1.2 樣式與動畫設計規範
- **CSS 隔離**：一律使用 SFC 的 `<style scoped>` 撰寫元件樣式。
- **設計系統變數**：在 `src/index.css` 定義了馬卡龍配色系統與圓角規格。請一律使用 `var(--color-...)` 形式，禁止硬編碼 (Hardcode) 顏色：
  - 背景色：`var(--color-bg-warm)`
  - 支出/粉紅：`var(--color-expense)`
  - 收入/薄荷綠：`var(--color-income)`
  - 轉帳/科技藍：`var(--color-transfer)`
  - 文字/深灰褐：`var(--color-text-dark)`
- **QQ 果凍效果動畫**：
  在需要點擊反饋的按鈕或卡片上，請套用果凍彈性動畫類別 `.btn-jelly` 或以下 CSS：
  ```css
  .btn-jelly:active {
    transform: scale(0.92);
    transition: transform 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
  ```

### 1.3 逗逗貓 (Dodo Cat) SVG 渲染規範
- 逗逗貓吉祥物實作於 `src/components/DodoCat.vue`。
- 其表情是透過 Vue 的 `computed` 屬性動態切換 SVG 內部路徑（例如眼睛的彎度、耳朵的傾斜度、嘴巴的形狀，或直接變換整張貓咪 SVG）。
- 當新增貓咪表情時，請遵循**「用簡單乾淨的扁平 SVG 線條」**來繪製，並加上 CSS `.cat-wiggle` 以提供貓咪慵懶擺尾的呼吸微動畫。

---

## 2. 未來 Android App (Kotlin / Jetpack Compose) 移植導引

當使用者要求將 Dodo Ledger 移植或擴展至 Android 時，您可以直接使用以下 Prompt 模組來引導 AI 助理進行高效率的代碼生成。

### 2.1 介面與資料層移植 Prompt
> **LLM 移植引導 Prompt 範本：**
> 
> ```markdown
> 你現在是高階 Android 專家。我們正在將一個名為 "Dodo Ledger" 的 Vue 3 記帳服務移植到 Android 原生系統。
> 請參考 Vue 3 的狀態管理 Composable `src/composables/useLedger.ts` 以及系統規格 `SPEC.md`。
> 
> 請執行以下任務：
> 1. 用 Kotlin 建立對應的 Firestore Data Class，並使用 Firebase Android SDK。
> 2. 建立一個 Android Repository 模式的 `LedgerRepository`，實作「LocalStorage 快取 + Firestore 雙向同步」的雙儲存層架構。
> 3. 特別注意：用 Kotlin 實作 SPEC.md 中規定的「信用卡額度當下全扣，分月攤還」以及「轉帳手續費獨立支出化」演算法。
> ```

### 2.2 UI 樣式與動畫移植 Prompt
> **LLM UI 移植引導 Prompt 範本：**
> 
> ```markdown
> 你現在是 Android UI 設計專家。請參考 Dodo Ledger 的 `src/index.css` 與 `DodoCat.vue`。
> 
> 請執行以下任務：
> 1. 在 Android 中，將 CSS 變數定義的馬卡龍色系（奶油黃、粉桃紅、薄荷綠）轉換為 Jetpack Compose 的 `Color.kt` 與 `Theme.kt`。
> 2. 使用 Compose 的 `Animatable` 與 `Spring` 彈簧物理動畫，重現 Web 端的「QQ 果凍按鈕點擊反饋（Jelly Effect）」。
> 3. 用 Compose `Canvas` 或 `Image` 配合 Lottie，重現逗逗貓在不同預算比例（玩毛線、流汗、遮眼哭哭）下的動態表情與泡泡對話框。
> ```

---

## 3. 自動化測試與 CI/CD 保護網
為了確保專案長期維護的健康度：
- **測試**：每次修改核心帳務計算、分期或轉帳邏輯時，必須執行 `npm run test:run`。
- **CI 提交**：在提交代碼前，請確認已通過 TypeScript 編譯檢查與 Vitest 自動化測試。這在 GitHub Actions 中有強制檢驗，若未通過將無法成功部署至 GitHub Pages。
- **更新 CHANGELOG**：每次完成新功能交付，請隨手在 `CHANGELOG.md` 中留下簡短的版本紀錄。
