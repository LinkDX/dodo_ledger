# 🐾 Dodo Ledger Cloudflare Worker 邊緣自動記帳 API

本目錄為 Dodo Ledger 的 Serverless 邊緣 API 實作，部署在 Cloudflare Workers 上，提供外部服務、AI Agent (Claude / GPT)、iOS 捷徑或 Webhook 進行安全、原子性的自動記帳。

---

## 🛠️ 事前準備：取得 Firebase 服務帳戶私密金鑰 (Service Account)

1. 開啟 [Firebase Console](https://console.firebase.google.com/)。
2. 進入你的 Dodo Ledger 專案 -> 點擊左上角 ⚙️「專案設定」 -> 選擇「**服務帳戶 (Service Accounts)**」頁籤。
3. 點擊「**產生新的私密金鑰 (Generate new private key)**」並確認下載 JSON 檔案。
4. 打開下載的 JSON 檔案，你會看到：
   - `project_id`
   - `client_email`
   - `private_key` (以 `-----BEGIN PRIVATE KEY-----` 開頭的字串)

---

## 🚀 部署步驟

### 1. 安裝 Cloudflare Wrangler CLI (若尚未安裝)
```bash
npm install
```

### 2. 設定 Worker 機密環境變數 (Secrets)
執行以下指令逐一設定（若未登入 Cloudflare，Wrangler 會引導您至瀏覽器進行免費登入）：

```bash
# 設定 Firebase Project ID (例如 dodo-ledger-prod)
npx wrangler secret put FIREBASE_PROJECT_ID

# 設定 Firebase Client Email (例如 firebase-adminsdk-xxx@dodo-ledger-prod.iam.gserviceaccount.com)
npx wrangler secret put FIREBASE_CLIENT_EMAIL

# 設定 Firebase Private Key (直接貼上完整金鑰，包含 BEGIN 與 END 行)
npx wrangler secret put FIREBASE_PRIVATE_KEY

# 設定成員 Token 映射表 (JSON 格式，每個 Token 綁定一個成員)
npx wrangler secret put DODO_API_USERS
```

#### `DODO_API_USERS` 設定範例：
```json
{
  "dodo_sec_luke_123": {
    "userId": "user_luke",
    "name": "Luke",
    "avatar": "cat-happy"
  },
  "dodo_sec_bot_999": {
    "userId": "user_bot",
    "name": "AI 記帳助理",
    "avatar": "cat-glasses"
  }
}
```

### 3. 一鍵部署上線
```bash
npm run deploy
```
終端機將輸出部署後的專屬 URL：
`https://dodo-ledger-api.<your-cloudflare-subdomain>.workers.dev`

---

## 🧪 快速驗證

### 1. 健康檢查
```bash
curl https://<YOUR_WORKER_URL>/api/health
# 回傳: {"status":"ok","timestamp":1727956800000}
```

### 2. 查詢帳本帳戶與分類
```bash
curl https://<YOUR_WORKER_URL>/api/metadata \
  -H "Authorization: Bearer dodo_sec_luke_123"
```

### 3. 測試新增一筆記帳
```bash
curl -X POST https://<YOUR_WORKER_URL>/api/transactions \
  -H "Authorization: Bearer dodo_sec_luke_123" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "expense",
    "amount": 90,
    "account": "現金",
    "category": "餐飲",
    "subCategory": "早餐",
    "note": "熱壓吐司加冰美式"
  }'
```

手機打開 Dodo Ledger App 或重新整理網頁，即可看到即時更新的記帳記錄與餘額變化！
