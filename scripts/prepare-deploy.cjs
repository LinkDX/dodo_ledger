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

// 💡 貓咪手把手 Firebase 金鑰指南
const printFirebaseGuide = () => {
  console.log(`
  ========================================================================
  🐱 逗逗貓手把手教學 ── 如何取得與貼上您的 Firebase 完整 JS 設定？
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

// ⚡️ 極致強悍的 Firebase JS SDK Config 正則提取器 (降維打擊：無視常數、註解、宣告或排版)
const extractFirebaseConfig = (text) => {
  const keys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'];
  const config = {};
  let foundAny = false;

  keys.forEach(key => {
    // 支援屬性名被引號或無引號包覆，支援單雙引號的值
    // 匹配例如: apiKey: "AIzaSy..." 或 "apiKey": 'AIzaSy...' 或 apiKey : 'AIzaSy...',
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
      // 結束條件：
      // 1. 使用者輸入了 'end'
      // 2. 或是已經收集到了內容，且輸入了空行 (連續按了兩次 Enter)
      // 3. 或是輸入包含了 '};' (偵測到 JS 的結尾)
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

      // GitHub Secrets 端僅需新增一個超精簡的 VITE_FIREBASE_CONFIG JSON 即可！
      githubSecrets.push({ key: 'VITE_FIREBASE_CONFIG', value: configJsonString });
    } else {
      console.log('\n  ❌ 喵嗚！無法解析您貼上的 Firebase Config。');
      console.log('     [調試資訊] 接收到的輸入長度為: ' + firebaseConfigStr.length + ' 字元。');
      console.log('     請確保您貼上的內容中包含 apiKey, projectId 等欄位與引號值喵！');
    }
  }

  // 3. 自動寫入本地 .env.local 檔案
  const envLocalPath = path.join(__dirname, '../.env.local');
  try {
    if (envLines.length > 0) {
      fs.writeFileSync(envLocalPath, envLines.join('\n') + '\n');
      console.log(`\n  💾 \x1b[36m已自動一鍵生成本地配置檔案 (.env.local)\x1b[0m`);
      console.log('     您的本機開發測試（npm run dev）已自動套用此組安全鎖與雲端設定囉！');
    } else {
      if (fs.existsSync(envLocalPath)) {
        fs.unlinkSync(envLocalPath);
      }
    }
  } catch (err) {
    console.error('     ❌ 寫入 .env.local 失敗：', err.message);
  }

  // 4. 印出超精美的 GitHub Secrets 指南 (100% 完整金鑰不截斷，免受表格邊框干擾)
  console.log(`
  ========================================================================
  🐱 Dodo Cat 手把手教學 ── 如何在 GitHub 上一鍵安全設定？
  ========================================================================
  
  為了防止金鑰外洩，請務必按照以下步驟將資訊存入 GitHub Secrets：
  
  1. 打開您的 GitHub Repository 網頁。
  2. 點擊上方的 \x1b[33m[Settings]\x1b[0m 頁籤。
  3. 在左側選單中尋找 \x1b[33m[Secrets and variables]\x1b[0m -> 點擊 \x1b[33m[Actions]\x1b[0m。
  4. 點擊右側綠色的 \x1b[32m[New repository secret]\x1b[0m 按鈕。
  5. 複製下方提供的金鑰，分別新增進去：
  `);

  if (githubSecrets.length === 0) {
    console.log('     🐾 目前無任何金鑰需要設定。直接發布即可運作（LocalStorage 純本地儲存模式）！');
  } else {
    githubSecrets.forEach((sec, idx) => {
      console.log(`  \x1b[1m[ 項目 ${idx + 1} / ${githubSecrets.length} ]\x1b[0m`);
      console.log(`  👉 Secret \x1b[33mName\x1b[0m  (貼於 Name 欄位)  :  \x1b[36m${sec.key}\x1b[0m`);
      console.log(`  👉 Secret \x1b[32mValue\x1b[0m (貼於 Value 欄位，請「雙擊整行」複製下方綠色完整內容) :`);
      console.log(`\x1b[32m${sec.value}\x1b[0m`);
      console.log('  ------------------------------------------------------------------------\n');
    });
  }

  console.log(`
  🎉 搞定！部署用的 GitHub Actions workflow 將會自動在建置時讀取這些一鍵貼上的 Secrets，
     讓您的 GitHub 原始碼完全沒有任何明文金鑰，但靜態網頁卻能極致安全且功能健全地運作！
     
     祝您部署順利喵嗚～ (✿◡‿◡)🐾
  ========================================================================
  `);
};

// 啟動
startSetup();
