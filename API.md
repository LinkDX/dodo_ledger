# 🐾 Dodo Ledger 自動化記帳 API 規格手冊

Dodo Ledger (逗逗記帳) 採用 **GitHub Zero Host（GitHub Pages 靜態網站 + Firebase Firestore 雲端資料庫）** 架構。
本手冊說明如何透過輕量級的 **Cloudflare Worker 邊緣無伺服器 API**，讓第三方服務（如 iOS 捷徑、LINE Bot、Telegram Bot、n8n、Zapier）以及 **各類 AI Agent（Claude, GPTs, Antigravity 等）** 直接自動記帳。

---

## 目錄
1. [架構概覽](#1-架構概覽)
2. [驗證與記帳人身分機制 (User Authentication)](#2-驗證與記帳人身分機制-user-authentication)
3. [線上機器可讀文件 (供 AI Agent 索引)](#3-線上機器可讀文件-供-ai-agent-索引)
4. [API 端點詳細說明](#4-api-端點詳細說明)
   - [健康檢查 `GET /api/health`](#41-健康檢查-get-apihealth)
   - [取得帳本元資料 `GET /api/metadata`](#42-取得帳本元資料-get-apimetadata)
   - [新增記帳交易 `POST /api/transactions`](#43-新增記帳交易-post-apitransactions)
5. [AI Agent 自動記帳最佳實踐 (Prompt & Flow)](#5-ai-agent-自動記帳最佳實踐-prompt--flow)
6. [Cloudflare Worker 部署指南](#6-cloudflare-worker-部署指南)

---

## 1. 架構概覽

```mermaid
flowchart LR
    subgraph Clients["呼叫端 / 外部服務"]
        AI[AI Agent<br/>(Claude/GPT)]
        Shortcuts[iOS 捷徑 / Siri]
        Bot[LINE / TG Bot]
        N8N[n8n / Webhook]
    end

    subgraph Edge["Cloudflare Workers (0 成本邊緣層)"]
        CF[Dodo Ledger API<br/>Token 鑑權 & 智慧名稱匹配]
    end

    subgraph Cloud["Google Firebase (原系統資料庫)"]
        FS[(Firestore 雲端資料庫<br/>ledgers/dodo_shared_ledger)]
    end

    subgraph Apps["Dodo Ledger 前端"]
        Web[GitHub Pages 網頁版]
        Android[Android App]
    end

    AI -->|HTTPS Bearer Token| CF
    Shortcuts -->|HTTPS Bearer Token| CF
    Bot -->|HTTPS Bearer Token| CF
    N8N -->|HTTPS Bearer Token| CF

    CF -->|Firestore REST Batch Commit| FS
    FS -.->|onSnapshot 即時同步| Web
    FS -.->|onSnapshot 即時同步| Android
```

### 特色亮點
- **維持 0 伺服器主機成本**：Cloudflare Workers 免費版每日提供 100,000 次請求額度，無需綁定信用卡。
- **帳務原子性 (Atomic Transaction)**：呼叫記帳 API 時，Worker 會發送 Firestore 原子事務批次，**同時建立交易記錄並更新對應帳戶餘額**，絕不產生帳面餘額漂移。
- **即時全端同步**：透過 Firestore `onSnapshot`，網頁端與 Android 手機端能在幾百毫秒內看見最新記帳，並呈現可愛彈跳動畫。

---

## 2. 驗證與記帳人身分機制 (User Authentication)

Dodo Ledger 為多人共同記帳架構，具有家庭/團隊成員的概念（`UserProfile`）。為了解決外部 API 的安全防護與記帳人身分歸屬，系統採用 **「Token-to-User 映射機制」**：

### 2.1 運作原理
1. 在 Cloudflare Worker 中儲存一組機密環境變數 `DODO_API_USERS`（JSON 格式）。
2. 每位成員（或專屬 AI Agent）擁有專屬的 API Token。
3. 呼叫 API 時於 HTTP Header 帶入：
   ```http
   Authorization: Bearer <API_TOKEN>
   ```
4. Worker 收到請求後，依 Token 直接辨識出對應的使用者資訊，並自動寫入交易的 `createdBy` 與 `createdByAvatar`。

### 2.2 Token 設定範例 (`DODO_API_USERS`)
```json
{
  "dodo_sec_luke_9a8b": {
    "userId": "user_luke_001",
    "name": "Luke",
    "avatar": "cat-happy"
  },
  "dodo_sec_ann_77c2": {
    "userId": "user_ann_002",
    "name": "Ann",
    "avatar": "cat-coffee"
  },
  "dodo_sec_bot_agent_x3": {
    "userId": "bot_agent",
    "name": "AI 記帳助理",
    "avatar": "cat-glasses"
  }
}
```

### 2.3 安全與使用優勢
- **免傳記帳人參數**：呼叫端不能（也不需要）隨意傳入別人的名字，徹底杜絕冒名竄改。
- **權限隔離**：若某個 AI Agent 金鑰洩漏，只需撤銷該單一 Token，其餘家庭成員不受影響。
- **邊緣極速比對**：Token 在 Cloudflare 邊緣直接記憶體驗證，零資料庫查詢成本。

---

## 3. 線上機器可讀文件 (供 AI Agent 索引)

為了讓 AI Agent、GPT Actions、LangChain 或自動化工具能自主獲取 API 規格，Dodo Ledger 透過 GitHub Pages 發布了兩份標準機器可讀檔案：

1. **OpenAPI 3.1 規範**：
   - 網址：`https://<owner>.github.io/dodo_ledger/api-spec.json`
   - 適用：OpenAI Custom GPTs Actions、Swagger UI、Postman、n8n 等各類支援標準 OpenAPI 的工具。
2. **AI Agent 簡要索引 (llms.txt)**：
   - 網址：`https://<owner>.github.io/dodo_ledger/llms.txt`
   - 適用：LLM / AI Agent 快速檢索核心路徑與語意規範。

---

## 4. API 端點詳細說明

### 4.1 健康檢查 `GET /api/health`
檢查 Worker 邊緣節點是否正常運行。
- **認證**：無需認證
- **Response `200 OK`**:
  ```json
  {
    "status": "ok",
    "timestamp": 1727956800000
  }
  ```

---

### 4.2 取得帳本元資料 `GET /api/metadata`
取得目前帳本內所有的**帳戶名稱、ID、即時餘額**以及**收支分類清單**。AI Agent 在幫忙記帳前，應先呼叫此端點以掌握可用的帳戶與分類。

- **Header**:
  ```http
  Authorization: Bearer dodo_sec_luke_9a8b
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "operator": {
      "userId": "user_luke_001",
      "name": "Luke",
      "avatar": "cat-happy"
    },
    "data": {
      "accounts": [
        {
          "id": "acc_cash_01",
          "name": "錢包現金",
          "type": "cash",
          "balance": 2500,
          "currency": "TWD"
        },
        {
          "id": "acc_esun_02",
          "name": "玉山銀行",
          "type": "bank",
          "balance": 48200,
          "currency": "TWD"
        }
      ],
      "categories": [
        {
          "id": "cat_food",
          "name": "餐飲",
          "type": "expense",
          "subCategories": ["早餐", "午餐", "晚餐", "飲料/點心", "買菜食材", "聚餐"]
        },
        {
          "id": "cat_traffic",
          "name": "交通",
          "type": "expense",
          "subCategories": ["捷運/公車", "計程車", "加油/充電", "高鐵/火車"]
        }
      ]
    }
  }
  ```

---

### 4.3 新增記帳交易 `POST /api/transactions`
執行一筆原子記帳（支援支出、收入、轉帳）。系統會自動建立交易、計算並更新帳戶餘額、寫入系統稽核日誌。

- **Header**:
  ```http
  Authorization: Bearer dodo_sec_luke_9a8b
  Content-Type: application/json
  ```

#### 智慧名稱匹配特性
- `account` 欄位支援 **模糊名稱匹配**。例如傳入 `"現金"`，Worker 會自動匹配到 `"錢包現金"`；傳入 `"玉山"` 會匹配到 `"玉山銀行"`，大幅降低 AI 或外部腳本傳參難度。

#### 參數規格表
| 欄位 | 類型 | 必填 | 說明 | 範例 |
|---|---|---|---|---|
| `type` | string | 是 | 交易類型：`expense` (支出)、`income` (收入)、`transfer` (轉帳) | `"expense"` |
| `amount` | number | 是 | 金額 (必須 > 0) | `150` |
| `account` | string | 是 | 帳戶名稱或 ID（支出/轉帳來源，收入時若無 `toAccount` 則作為入帳帳戶） | `"現金"` 或 `"acc_cash_01"` |
| `toAccount` | string | 否 | 轉入帳戶名稱或 ID（僅轉帳或收入類型使用） | `"玉山銀行"` |
| `fee` | number | 否 | 轉帳手續費（僅 `transfer` 適用） | `15` |
| `category` | string | 否 | 主分類名稱 (預設為「其他支出」或「其他收入」) | `"餐飲"` |
| `subCategory` | string | 否 | 子分類名稱 | `"午餐"` |
| `note` | string | 否 | 交易備註或品項名稱 | `"排骨便當加紅茶"` |
| `tags` | string[] | 否 | 自訂標籤陣列 | `["外食", "平日"]` |
| `date` | string/number | 否 | 日期時間（支援 ISO 字串或時間戳記，預設為當下） | `"2026-10-03T12:30:00+08:00"` |

#### Request 範例 (支出)
```bash
curl -X POST https://dodo-ledger-api.linkatzelda.workers.dev/api/transactions \
  -H "Authorization: Bearer <YOUR_API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "expense",
    "amount": 120,
    "account": "現金",
    "category": "餐飲",
    "subCategory": "午餐",
    "note": "排骨便當"
  }'
```

#### Response `200 OK`
```json
{
  "success": true,
  "data": {
    "transactionId": "tx_1727956801234_abc",
    "type": "expense",
    "amount": 120,
    "category": "餐飲",
    "subCategory": "午餐",
    "accountName": "錢包現金",
    "newBalance": 2380,
    "note": "排骨便當",
    "operator": "Luke",
    "date": 1727956800000
  }
}
```

---

## 5. AI Agent 自動記帳最佳實踐 (Prompt & Flow)

若您正在開發 Custom GPT、Claude Project 或將 Dodo Ledger API 接入 AI Agent：

### 推薦 System Prompt 設定
```markdown
你是 Dodo Ledger (逗逗記帳) 的智慧記帳管家。
當使用者用自然語言告訴你花費或收入時，請遵循以下步驟：
1. 若尚未掌握使用者的帳戶清單，先呼叫 `GET /api/metadata` 取得帳本資訊。
2. 從使用者的句子中精準提取：
   - 金額 (amount)
   - 支出或收入 (type)
   - 扣款帳戶 (account)
   - 分類 (category) 與 子分類 (subCategory)
   - 備註 (note)
3. 呼叫 `POST /api/transactions` 完成記帳。
4. 記帳完成後，以活潑溫馨、帶有逗逗貓口氣 (如「喵嗚～主人記帳成功囉！錢包現金剩餘 $2,380」) 的方式回覆使用者。
```

---

## 6. Cloudflare Worker 部署指南

本專案於 `cloudflare-worker/` 目錄內提供了開箱即用的 Worker 原始碼。

### 步驟 1：取得 Firebase Service Account 金鑰
1. 前往 [Firebase Console](https://console.firebase.google.com/) -> 專案設定 -> **服務帳戶 (Service Accounts)**。
2. 點擊「產生新的私密金鑰 (Generate new private key)」，下載 JSON 檔案。
3. 記下 JSON 中的：
   - `project_id`
   - `client_email`
   - `private_key`

### 步驟 2：設定 Cloudflare Worker 密鑰
進入 `cloudflare-worker/` 目錄，透過 Wrangler CLI 或 Cloudflare 儀表板設定 Secrets：

```bash
cd cloudflare-worker

# 1. 安裝相依套件
npm install

# 2. 設定 Firebase 認證金鑰
npx wrangler secret put FIREBASE_PROJECT_ID
# 輸入你的 Firebase Project ID

npx wrangler secret put FIREBASE_CLIENT_EMAIL
# 輸入 firebase-adminsdk-xxx@...iam.gserviceaccount.com

npx wrangler secret put FIREBASE_PRIVATE_KEY
# 貼上完整 Private Key (含 -----BEGIN PRIVATE KEY-----)

# 3. 設定成員 Token 映射表
npx wrangler secret put DODO_API_USERS
# 貼上 JSON，例如：
# {"dodo_sec_luke_123": {"userId":"luke","name":"Luke","avatar":"cat-happy"}}
```

### 步驟 3：部署上線
```bash
npx wrangler deploy
```
部署完成後即可獲得專屬 URL：`https://dodo-api.<your-subdomain>.workers.dev`！
可立即使用 cURL 測試 `/api/health` 與 `/api/metadata`。
