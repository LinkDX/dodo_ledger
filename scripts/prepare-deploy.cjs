const readline = require('readline');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

// 💡 貓咪手把手 Firebase 金鑰指南
const printFirebaseGuide = () => {
  console.log(`
  ========================================================================
  如果您想要將記帳本同步到 Firebase 雲端資料庫，請依照以下步驟取得金鑰：

  1. 登入 Firebase Console：\x1b[36mhttps://console.firebase.google.com/\x1b[0m
  2. 進入「⚙️ 專案設定 (Project Settings)」。
  3. 往下滾動至「您的應用程式 (Your Apps)」區塊，找到 \x1b[36mfirebaseConfig\x1b[0m 物件。
  4. 複製整個包含 const firebaseConfig = { ... } 的 JavaScript 程式碼片段。

  💡 您可以直接將這一整包「多行程式碼」（包含所有註解與宣告）複製，
     並直接「一鍵貼上」給我！我會自動精準解析它喵！

  💡 \x1b[33m如果您不想使用雲端，只想用本地 LocalStorage，請直接一律按 Enter 留空跳過即可喵！\x1b[0m
  ========================================================================
  `);
};

// 輔支函數：計算 SHA-256 雜湊
const getSha256Hash = (text) => {
  return crypto.createHash('sha256').update(text).digest('hex');
};

// ⚡️ 極致強悍的 Firebase JS SDK Config 正則提取器 (無視常數、註解、宣告或排版)
const extractFirebaseConfig = (text) => {
  const keys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'];
  const config = {};
  let foundAny = false;

  keys.forEach(key => {
    // 支援屬性名被引號或無引號包覆，支援單雙引號的值
    const regex = new RegExp(`(?:['"]?${key}['"]?\\s*:\\s*["']([^"']+)["'])`, 'i');
    const match = text.match(regex);
    if (match && match[1]) {
      config[key] = match[1].trim();
      foundAny = true;
    }
  });

  return foundAny ? config : null;
};

let globalPassword = '';
let firebaseConfigStr = '';

const startSetup = () => {
  printCatArt();

  rl.question('🔑 請輸入您希望訪客在開啟 GitHub Pages 時，被要求輸入的「全域解鎖密碼」\n   (例如: dodo520，直接按 Enter 留空代表暫不啟用密碼防護鎖)： ', (pwd) => {
    globalPassword = pwd.trim();

    printFirebaseGuide();

    console.log('☁️ 請貼上整包 Firebase Config 物件內容 (支援直接複製貼上多行程式碼！)');
    console.log('   貼上後，\x1b[33m請按兩次 Enter 送出\x1b[0m (或在最後一筆後輸入 \x1b[36mend\x1b[0m 送出)：');
    console.log('------------------------------------------------------------------------');

    let lines = [];
    const handleLineInput = (line) => {
      const trimmed = line.trim();
      if (trimmed.toLowerCase() === 'end' || (trimmed === '' && lines.length > 0) || trimmed.includes('};')) {
        if (trimmed && trimmed.includes('};')) {
          lines.push(line);
        }
        rl.off('line', handleLineInput);
        firebaseConfigStr = lines.join('\n');
        rl.close();
        processConfig();
      } else {
        lines.push(line);
      }
    };

    rl.on('line', handleLineInput);
  });
};

const processConfig = () => {
  console.log('\n  ========================================================================');
  console.log('  🐾 正在為您計算與產生一鍵配置設定喵......');

  const envLines = [];
  const githubSecrets = [];

  // 1. 處理密碼防護
  if (globalPassword) {
    const pwdHash = getSha256Hash(globalPassword);
    console.log(`\n  ✅ 成功接收密碼！`);
    console.log(`     - 您的明文密碼是: ${globalPassword}`);
    console.log(`     - 自動生成的單向 SHA-256 雜湊是: \x1b[32m${pwdHash}\x1b[0m`);

    envLines.push(`VITE_APP_PASSWORD_HASH=${pwdHash}`);
    githubSecrets.push({ key: 'VITE_APP_PASSWORD_HASH', value: pwdHash });
  } else {
    console.log('\n  ⚠️ 未啟用密碼鎖。您的記帳網站部署後將處於公開狀態（任何人皆可免密碼直接點入）。');
  }

  // 2. 處理整包一鍵貼上的 Firebase 設定
  if (firebaseConfigStr && firebaseConfigStr.trim()) {
    const parsedConfig = extractFirebaseConfig(firebaseConfigStr);
    if (parsedConfig && parsedConfig.apiKey) {
      console.log(`\n  ✅ 成功解析 Firebase 設定！偵測到專案：\x1b[32m${parsedConfig.projectId}\x1b[0m`);

      const configJsonString = JSON.stringify(parsedConfig);

      // 寫入本地 .env.local 檔案以利測試
      envLines.push(`VITE_FIREBASE_CONFIG=${configJsonString}`);

      // 也一併寫入個別環境變數以提供向後相容
      envLines.push(`VITE_FIREBASE_API_KEY=${parsedConfig.apiKey}`);
      envLines.push(`VITE_FIREBASE_PROJECT_ID=${parsedConfig.projectId}`);
      envLines.push(`VITE_FIREBASE_AUTH_DOMAIN=${parsedConfig.authDomain}`);
      envLines.push(`VITE_FIREBASE_MESSAGING_SENDER_ID=${parsedConfig.messagingSenderId || ''}`);
      envLines.push(`VITE_FIREBASE_APP_ID=${parsedConfig.appId || ''}`);

      githubSecrets.push({ key: 'VITE_FIREBASE_CONFIG', value: configJsonString });
    } else {
      console.log('\n  ❌ 喵嗚！無法解析您貼上的 Firebase Config。');
      console.log('     請確保您貼上的內容中包含 apiKey, projectId 等欄位與引號值喵！');
    }
  }

  // 3. 🎯 自動檢測與生成 Android 專案專屬共享簽名金鑰 dodo-shared.keystore (安全防護)
  const keystoreDir = path.join(__dirname, '../android/app');
  const keystorePath = path.join(keystoreDir, 'dodo-shared.keystore');
  
  // 偵測密碼是否變更或缺少記錄 (與 .env.local 中的舊 Hash 與密碼記錄比較)
  let oldHash = '';
  let hasRawPassword = false;
  const existingEnvPath = path.join(__dirname, '../.env.local');
  if (fs.existsSync(existingEnvPath)) {
    const content = fs.readFileSync(existingEnvPath, 'utf8');
    const match = content.match(/VITE_APP_PASSWORD_HASH=([a-f0-9]+)/);
    if (match) oldHash = match[1];
    hasRawPassword = content.includes('DODO_SIGNING_PASSWORD');
  }
  
  const newHash = globalPassword ? getSha256Hash(globalPassword) : '';
  const passwordChanged = oldHash && newHash && oldHash !== newHash;
  // 如果 Hash 存在但沒有原始密碼記錄，代表可能是舊版腳本產生的，為了安全起見，若有輸入新密碼就重新產生
  const isStale = oldHash && !hasRawPassword && globalPassword;

  if (!fs.existsSync(keystorePath) || passwordChanged || isStale) {
    if (passwordChanged || isStale) {
      console.log(`\n  📡 [密碼一致性自癒] 偵測到密碼已變更或缺少同步記錄，正在為您重新產生專案共享簽名金鑰...`);
      if (fs.existsSync(keystorePath)) {
        const backupPath = `${keystorePath}.bak`;
        fs.copyFileSync(keystorePath, backupPath);
        fs.unlinkSync(keystorePath);
        console.log(`     已將舊金鑰安全備份至: android/app/dodo-shared.keystore.bak`);
      }
    } else {
      console.log('\n  📡 [資安防禦檢測] 偵測到本地尚無專案專屬共享簽名金鑰 dodo-shared.keystore！');
      console.log('     🐱 逗逗貓小管家正努力在後台調用 keytool 幫您一鍵秒速生成金鑰中，請稍候...');
    }

    try {
      if (!fs.existsSync(keystoreDir)) {
        fs.mkdirSync(keystoreDir, { recursive: true });
      }
      // 使用使用者剛才輸入的進入密碼，確保與 App 密碼完全一致
      const signingPwd = globalPassword || 'dodo520';
      const cmd = `keytool -genkeypair -v -keystore "${keystorePath}" -alias dodo_key -keyalg RSA -keysize 2048 -validity 10000 -storepass "${signingPwd}" -keypass "${signingPwd}" -dname "CN=Dodo, OU=Ledger, O=Dodo, L=Taipei, S=Taiwan, C=TW"`;
      execSync(cmd, { stdio: 'ignore' });
      console.log('     ✅ 共享簽名金鑰 dodo-shared.keystore 生成成功！已存放於: android/app/');
    } catch (err) {
      console.log('     ⚠️ 自動生成 keystore 失敗，請確保本機已安裝 JDK 並可使用 keytool 指令！', err.message);
    }
  } else {
    console.log('\n  📡 [資安防禦檢測] ✅ 本地專案共享簽名金鑰已存在。已啟用「金鑰與密碼隔離安全方案」。');
  }

  // 🔒 自動將 Android 簽名密碼安全地加入 GitHub Secrets 提示清單中
  // 直接沿用使用者剛才輸入的進入密碼，確保與 App 密碼、金鑰密碼三者完全一致
  githubSecrets.push({ key: 'DODO_SIGNING_PASSWORD', value: globalPassword || '(請填入您的進入密碼)' });

  // 4. 自動寫入本地 .env.local 檔案
  // 同時寫入原始密碼，以便與 prepare.cjs 保持同步與一致性
  const envConfig = {};
  const envLocalPath = path.join(__dirname, '../.env.local');
  
  // 先讀取現有設定
  if (fs.existsSync(envLocalPath)) {
    try {
      const content = fs.readFileSync(envLocalPath, 'utf8');
      content.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const val = parts.slice(1).join('=').trim();
          if (key) envConfig[key] = val;
        }
      });
    } catch (err) {
      console.warn('     ⚠️ 讀取現有 .env.local 失敗，將重新產生。');
    }
  }

  // 更新設定
  if (globalPassword) {
    const pwdHash = getSha256Hash(globalPassword);
    envConfig['VITE_APP_PASSWORD_HASH'] = pwdHash;
    envConfig['DODO_SIGNING_PASSWORD'] = globalPassword;
  }

  // 從 envLines 提取其他設定 (Firebase 等)
  envLines.forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      if (key) envConfig[key] = val;
    }
  });

  try {
    const finalEnvLines = Object.entries(envConfig).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
    fs.writeFileSync(envLocalPath, finalEnvLines, 'utf8');
    console.log(`\n  💾 \x1b[36m已自動一鍵更新本地配置檔案 (.env.local)\x1b[0m`);
    console.log('     您的本機開發測試已自動套用此安全鎖與雲端設定囉！');
  } catch (err) {
    console.error('     ❌ 寫入 .env.local 失敗：', err.message);
  }

  // 5. 印出超精美的 GitHub Secrets 指南
  console.log(`
  ========================================================================
  🐱 Dodo Cat 手把手教學 ── 如何在 GitHub 上一鍵安全設定？
  ========================================================================

  為了防止敏感密碼和金鑰外洩，請務必按照以下步驟將資訊存入 GitHub Secrets：

  1. 打開您的 GitHub Repository 網頁。
  2. 點擊右側選單的 \x1b[33m[Settings]\x1b[0m 頁籤。
  3. 在左側選單點擊 \x1b[33m[Secrets and variables]\x1b[0m -> 選擇 \x1b[33m[Actions]\x1b[0m。
  4. 點擊右側綠色的 \x1b[32m[New repository secret]\x1b[0m 按鈕。
  5. 複製下方提供的金鑰，分別新增進去：
  `);

  githubSecrets.forEach((sec, idx) => {
    console.log(`  \x1b[1m[ 項目 ${idx + 1} / ${githubSecrets.length} ]\x1b[0m`);
    console.log(`  👉 Secret \x1b[33mName\x1b[0m  (貼於 Name 欄位)  :  \x1b[36m${sec.key}\x1b[0m`);
    console.log(`  👉 Secret \x1b[32mValue\x1b[0m (貼於 Value 欄位，請複製下方綠色完整內容) :`);
    console.log(`\x1b[32m${sec.value}\x1b[0m`);
    console.log('  ------------------------------------------------------------------------\n');
  });

  console.log(`
  🎉 搞定！部署與編譯用的 GitHub Actions workflow 將會自動在建置時讀取這些一鍵貼上的 Secrets，
     讓您的 GitHub 原始碼完全不包含任何明文密碼，但靜態網頁與 Android APK 卻能極致安全且功能健全地運作！

     祝您部署與編譯順利喵嗚～ (✿◡‿◡)🐾
  ========================================================================
  `);
};

// 啟動
startSetup();
