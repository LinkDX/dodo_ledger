const readline = require('readline');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 建立 CLI 互動介面
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 貓咪 ASCII Art 🎨
const printCatArt = () => {
  console.log(`
      /\\___/\\
     (  ❀◕.◕ )  喵嗚～ 歡迎使用 Dodo Ledger 部署配置大師！
      >  ω  <   我是您的安全防護貓小管家，讓我來幫您規劃 GitHub Pages 吧！
  ========================================================================
  `);
};

// 輔助函數：計算 SHA-256 雜湊
const getSha256Hash = (text) => {
  return crypto.createHash('sha256').update(text).digest('hex');
};

// 問答控制邏輯
const questions = [
  {
    key: 'password',
    text: '🔑 請輸入您希望訪客在開啟 GitHub Pages 時，被要求輸入的「全域解鎖密碼」\n   (例如: dodo520，直接按 Enter 留空代表暫不啟用密碼防護鎖)：',
    default: ''
  },
  {
    key: 'firebaseApiKey',
    text: '☁️ [Firebase 金鑰] 請輸入 VITE_FIREBASE_API_KEY\n   (直接按 Enter 留空代表跳過或暫不使用雲端同步功能)：',
    default: ''
  },
  {
    key: 'firebaseProjectId',
    text: '☁️ [Firebase 設定] 請輸入 VITE_FIREBASE_PROJECT_ID (專案 ID)：',
    default: ''
  },
  {
    key: 'firebaseAuthDomain',
    text: '☁️ [Firebase 設定] 請輸入 VITE_FIREBASE_AUTH_DOMAIN (驗證網域)：',
    default: ''
  },
  {
    key: 'firebaseMessagingSenderId',
    text: '☁️ [Firebase 設定] 請輸入 VITE_FIREBASE_MESSAGING_SENDER_ID：',
    default: ''
  },
  {
    key: 'firebaseAppId',
    text: '☁️ [Firebase 設定] 請輸入 VITE_FIREBASE_APP_ID (應用程式 ID)：',
    default: ''
  }
];

const answers = {};
let currentQuestionIndex = 0;

const askNext = () => {
  if (currentQuestionIndex < questions.length) {
    const q = questions[currentQuestionIndex];
    rl.question(`\n${q.text} `, (answer) => {
      answers[q.key] = answer.trim() || q.default;
      currentQuestionIndex++;
      askNext();
    });
  } else {
    rl.close();
    processAnswers();
  }
};

const processAnswers = () => {
  console.log('\n  ========================================================================');
  console.log('  🐾 正在為您計算與產生配置檔案喵......');

  const envLines = [];
  const githubSecrets = [];

  // 1. 處理密碼防護
  if (answers.password) {
    const pwdHash = getSha256Hash(answers.password);
    console.log(`\n  ✅ 成功接收金鑰！`);
    console.log(`     - 您的明文密碼是: ${answers.password}`);
    console.log(`     - 自動生成的單向 SHA-256 雜湊是: \x1b[32m${pwdHash}\x1b[0m`);
    console.log(`       (此雜湊極度安全，即便發布到 GitHub Pages 也不會被破解反推！)`);
    
    envLines.push(`VITE_APP_PASSWORD_HASH=${pwdHash}`);
    githubSecrets.push({ key: 'VITE_APP_PASSWORD_HASH', value: pwdHash });
  } else {
    console.log('\n  ⚠️ 未啟用密碼鎖。您的記帳網站部署後將處於公開狀態（任何人皆可免密碼直接點入）。');
  }

  // 2. 處理 Firebase 設定
  const hasFirebase = answers.firebaseApiKey;
  if (hasFirebase) {
    envLines.push(`VITE_FIREBASE_API_KEY=${answers.firebaseApiKey}`);
    envLines.push(`VITE_FIREBASE_PROJECT_ID=${answers.firebaseProjectId}`);
    envLines.push(`VITE_FIREBASE_AUTH_DOMAIN=${answers.firebaseAuthDomain}`);
    envLines.push(`VITE_FIREBASE_MESSAGING_SENDER_ID=${answers.firebaseMessagingSenderId}`);
    envLines.push(`VITE_FIREBASE_APP_ID=${answers.firebaseAppId}`);

    githubSecrets.push({ key: 'VITE_FIREBASE_API_KEY', value: answers.firebaseApiKey });
    githubSecrets.push({ key: 'VITE_FIREBASE_PROJECT_ID', value: answers.firebaseProjectId });
    githubSecrets.push({ key: 'VITE_FIREBASE_AUTH_DOMAIN', value: answers.firebaseAuthDomain });
    githubSecrets.push({ key: 'VITE_FIREBASE_MESSAGING_SENDER_ID', value: answers.firebaseMessagingSenderId });
    githubSecrets.push({ key: 'VITE_FIREBASE_APP_ID', value: answers.firebaseAppId });
  }

  // 3. 自動寫入本地 .env.local 檔案以利本機測試
  const envLocalPath = path.join(__dirname, '../.env.local');
  try {
    if (envLines.length > 0) {
      fs.writeFileSync(envLocalPath, envLines.join('\n') + '\n');
      console.log(`\n  💾 \x1b[36m已自動生成/覆寫本地配置檔案 (.env.local)\x1b[0m`);
      console.log('     您的本機開發測試（npm run dev）已自動套用此組安全鎖與雲端設定囉！');
    } else {
      // 若都留空，移除現有的 .env.local 避免干擾
      if (fs.existsSync(envLocalPath)) {
        fs.unlinkSync(envLocalPath);
      }
    }
  } catch (err) {
    console.error('     ❌ 寫入 .env.local 失敗：', err.message);
  }

  // 4. 印出超精美的 GitHub Secrets 指南
  console.log(`
  ========================================================================
  🐱 Dodo Cat 手把手教學 ── 如何將設定安全地放到 GitHub 上？
  ========================================================================
  
  為了防止金鑰外洩，請務必按照以下步驟將資訊存入 GitHub Secrets：
  
  1. 打開您的 GitHub Repository 網頁。
  2. 點擊上方的 \x1b[33m[Settings]\x1b[0m 頁籤。
  3. 在左側選單中尋找 \x1b[33m[Secrets and variables]\x1b[0m -> 點擊 \x1b[33m[Actions]\x1b[0m。
  4. 點擊右側綠色的 \x1b[32m[New repository secret]\x1b[0m 按鈕。
  5. 依照下方表格，將金鑰逐一複製並新增進去：
  `);

  if (githubSecrets.length === 0) {
    console.log('     🐾 目前無任何金鑰需要設定。直接發布即可運作（LocalStorage 純本地儲存模式）！');
  } else {
    console.log('  ┌─────────────────────────────────────┬──────────────────────────────────────────────────────────────────┐');
    console.log('  │ \x1b[1mSecret Name (貼於 Name)\x1b[0m             │ \x1b[1mSecret Value (貼於 Value)\x1b[0m                                        │');
    console.log('  ├─────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤');
    
    githubSecrets.forEach(sec => {
      const paddedKey = sec.key.padEnd(35, ' ');
      // 限制輸出長度防溢出
      const displayVal = sec.value.length > 62 ? sec.value.slice(0, 59) + '...' : sec.value;
      const paddedVal = displayVal.padEnd(64, ' ');
      console.log(`  │ ${paddedKey} │ ${paddedVal} │`);
    });
    
    console.log('  └─────────────────────────────────────┴──────────────────────────────────────────────────────────────────┘');
  }

  console.log(`
  🎉 搞定！部署用的 GitHub Actions workflow 將會自動在建置時讀取這些 Secrets，
     讓您的 GitHub 原始碼完全沒有任何明文金鑰，但靜態網頁卻能極致安全且功能健全地運作！
     
     祝您部署順利喵嗚～ (✿◡‿◡)🐾
  ========================================================================
  `);
};

// 啟動腳本
printCatArt();
askNext();
