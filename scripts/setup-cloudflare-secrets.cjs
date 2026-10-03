const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 搜尋專案根目錄下的 service account JSON
const rootDir = path.resolve(__dirname, '..');
const files = fs.readdirSync(rootDir);
const saFile = files.find(f => f.includes('adminsdk') && f.endsWith('.json'));

if (!saFile) {
  console.error('❌ 找不到 Firebase Service Account JSON 檔案！');
  process.exit(1);
}

const saPath = path.join(rootDir, saFile);
const saData = JSON.parse(fs.readFileSync(saPath, 'utf8'));

console.log(`\n🐾 找到金鑰檔案：${saFile}`);
console.log(`📁 專案 ID: ${saData.project_id}`);
console.log(`📧 服務帳戶: ${saData.client_email}\n`);

// 預設的使用者 Token 映射表
const defaultUsers = {
  "dodo_sec_luke_default": {
    "userId": "user_luke",
    "name": "Luke",
    "avatar": "cat-happy"
  },
  "dodo_sec_ai_bot": {
    "userId": "bot_agent",
    "name": "AI 記帳助理",
    "avatar": "cat-glasses"
  }
};

// 1. 自動寫入本地測試用 cloudflare-worker/.dev.vars
const devVarsContent = [
  `FIREBASE_PROJECT_ID="${saData.project_id}"`,
  `FIREBASE_CLIENT_EMAIL="${saData.client_email}"`,
  `FIREBASE_PRIVATE_KEY="${saData.private_key.replace(/\n/g, '\\n')}"`,
  `DODO_API_USERS='${JSON.stringify(defaultUsers)}'`
].join('\n');

const workerDir = path.join(rootDir, 'cloudflare-worker');
const devVarsPath = path.join(workerDir, '.dev.vars');
fs.writeFileSync(devVarsPath, devVarsContent, 'utf8');

console.log(`✅ 已為您生成本地測試設定檔：cloudflare-worker/.dev.vars (已被 .gitignore 保護)`);

// 2. 輸出部署指引
console.log(`\n========================================`);
console.log(`🚀 雲端 Cloudflare Worker 設定指令：`);
console.log(`========================================`);
console.log(`請在終端機切換至 cloudflare-worker 目錄後執行以下指令即可自動將 Secret 上傳至 Cloudflare：\n`);
console.log(`cd cloudflare-worker`);
console.log(`npx wrangler secret put FIREBASE_PROJECT_ID <<< "${saData.project_id}"`);
console.log(`npx wrangler secret put FIREBASE_CLIENT_EMAIL <<< "${saData.client_email}"`);
console.log(`printf '%s' "${saData.private_key}" | npx wrangler secret put FIREBASE_PRIVATE_KEY`);
console.log(`printf '%s' '${JSON.stringify(defaultUsers)}' | npx wrangler secret put DODO_API_USERS`);
console.log(`\n設定完成後執行部署：`);
console.log(`npx wrangler deploy\n`);
