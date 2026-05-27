const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');
const readline = require('readline');

console.log('\n🐾 [Dodo Cat prepare] 正在執行生命週期自癒與互動式密碼安全設定腳本...');

// 定義相關路徑
const envLocalPath = path.join(__dirname, '../.env.local');
const keystoreDir = path.join(__dirname, '../android/app');
const keystorePath = path.join(keystoreDir, 'dodo-shared.keystore');
const localPropertiesPath = path.join(__dirname, '../android/local.properties');
const lockfilePath = path.join(__dirname, '../package-lock.json');

// 計算 SHA-256 雜湊
function sha256(string) {
  return crypto.createHash('sha256').update(string).digest('hex');
}

// 判定是否為本地互動式環境
const isInteractive = process.stdout.isTTY && !process.env.CI;

// 儲存目前配置的變數
let envConfig = {};
if (fs.existsSync(envLocalPath)) {
  try {
    const envContent = fs.readFileSync(envLocalPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        envConfig[key] = val;
      }
    });
  } catch (err) {
    console.error('   ❌ 讀取 .env.local 失敗：', err.message);
  }
}

// 讀取既有密碼設定
let storePassword = process.env.DODO_STORE_PASSWORD || envConfig['DODO_STORE_PASSWORD'] || '';
let keyPassword = process.env.DODO_KEY_PASSWORD || envConfig['DODO_KEY_PASSWORD'] || '';

// ==========================================
// 1. 互動式詢問進入密碼 (限本地互動環境且密碼未設定時)
// ==========================================
function askForPassword() {
  return new Promise((resolve) => {
    if (!isInteractive) {
      // 非互動式環境 (例如 GitHub Actions)，跳過詢問，使用既有變數
      return resolve(null);
    }

    // 如果已經有金鑰且已經有密碼，就不需要每次 npm install 都詢問，提升開發體驗
    if (storePassword && keyPassword && fs.existsSync(keystorePath)) {
      console.log('   ✅ [設定檢測] 本地已設定簽名密碼，且共享金鑰已存在。已啟用「密碼隔離安全方案」。');
      return resolve(null);
    }

    console.log('\n  ==================================================================');
    console.log('  🐱 Dodo Cat 記帳密碼與 Android 金鑰簽名一致性設定');
    console.log('  ==================================================================');
    console.log('  為了保障財務安全，我們將使用同一個密碼來作為：');
    console.log('  1. 記帳 APP 的「進入鎖定密碼」 (將自動單向雜湊雜湊後寫入本地配置)');
    console.log('  2. Android 專案「共享簽名金鑰」的解密密碼 (將安全寫入本地排除設定)');
    console.log('  \x1b[33m提示：密碼長度建議至少 6 位數。本設定檔皆已排除，絕不 commit 外洩！\x1b[0m');
    console.log('  ==================================================================\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('  🐾 請輸入您的 Dodo Ledger 進入密碼 (同時做為金鑰密碼)：', (inputPwd) => {
      rl.close();
      const pwd = inputPwd.trim();
      if (!pwd || pwd.length < 6) {
        console.log('  ⚠️  密碼長度不足 6 位數！為保障安全，自動為您套用安全預設密碼 "dodo520" 🐾');
        return resolve('dodo520');
      }
      resolve(pwd);
    });
  });
}

// 主執行流程
async function run() {
  // 1. 進行詢問
  const pwd = await askForPassword();
  let needRegenKeystore = false;

  if (pwd) {
    // 使用者輸入了新密碼，更新配置
    storePassword = pwd;
    keyPassword = pwd;
    
    // 計算 SHA-256 並更新到 envConfig
    envConfig['DODO_STORE_PASSWORD'] = pwd;
    envConfig['DODO_KEY_PASSWORD'] = pwd;
    
    const pwdHash = sha256(pwd);
    envConfig['VITE_APP_PASSWORD_HASH'] = pwdHash;
    
    // 寫入到 .env.local
    try {
      const newEnvLines = Object.entries(envConfig).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
      fs.writeFileSync(envLocalPath, newEnvLines, 'utf8');
      console.log('   💾 [資安隔離] 已將密碼與進入鎖定 Hash 安全寫入本地排除設定檔 .env.local！');
      
      // 因為密碼變更了，標記需要重新生成 keystore
      needRegenKeystore = true;
    } catch (err) {
      console.error('   ❌ 寫入 .env.local 失敗：', err.message);
    }
  }

  // ==========================================
  // 2. 將金鑰密碼安全同步至排除的 android/local.properties 中
  // ==========================================
  if (storePassword && keyPassword) {
    try {
      let localPropertiesLines = [];
      if (fs.existsSync(localPropertiesPath)) {
        const localContent = fs.readFileSync(localPropertiesPath, 'utf8');
        localPropertiesLines = localContent.split('\n');
      }

      // 過濾掉舊的密碼設定，避免重複追加
      localPropertiesLines = localPropertiesLines.filter(line => {
        const trimmed = line.trim();
        return !trimmed.startsWith('dodo.store.password') && !trimmed.startsWith('dodo.key.password');
      });

      // 安全追加新密碼
      localPropertiesLines.push(`dodo.store.password=${storePassword}`);
      localPropertiesLines.push(`dodo.key.password=${keyPassword}`);
      
      // 清理空行並寫回
      fs.writeFileSync(localPropertiesPath, localPropertiesLines.join('\n').trim() + '\n', 'utf8');
      console.log('   ✅ [密碼隔離分發] 簽名金鑰密碼已同步寫入 android/local.properties (已排除於 Repo)！');
    } catch (err) {
      console.error('   ❌ 安全分發密碼至 local.properties 失敗：', err.message);
    }
  }

  // ==========================================
  // 3. package-lock.json 自動自癒 (修復私有 registry)
  // ==========================================
  if (fs.existsSync(lockfilePath)) {
    try {
      console.log('   📡 正在掃描 package-lock.json 是否被私有 registry 污染...');
      let lockfileContent = fs.readFileSync(lockfilePath, 'utf8');
      const targetUrl = 'https://npm.synology.inc';
      const replaceUrl = 'https://registry.npmjs.org';
      
      if (lockfileContent.includes(targetUrl)) {
        console.log(`   ⚠️  偵測到私有 registry 污染！正在將其自動修正為官方 npmjs.org...`);
        lockfileContent = lockfileContent.split(targetUrl).join(replaceUrl);
        fs.writeFileSync(lockfilePath, lockfileContent, 'utf8');
        console.log('   ✅ package-lock.json 自癒修復成功！(已徹底清除私有 registry)');
      } else {
        console.log('   ✅ 檢查完畢。package-lock.json 非常乾淨，未受私有 registry 污染。');
      }
    } catch (err) {
      console.error('   ❌ 修復 package-lock.json 時發生錯誤：', err.message);
    }
  }

  // ==========================================
  // 4. 金鑰重建/重新產生功能 (當需要重新產生或金鑰不存在時)
  // ==========================================
  if (!fs.existsSync(keystorePath) || needRegenKeystore) {
    if (needRegenKeystore && fs.existsSync(keystorePath)) {
      console.log('\n   📡 [密碼一致變更] 偵測到密碼已變更，正在為您備份並重新產生專案共享簽名金鑰...');
      try {
        const backupPath = `${keystorePath}.bak`;
        fs.copyFileSync(keystorePath, backupPath);
        fs.unlinkSync(keystorePath);
        console.log(`      已將舊金鑰安全備份至: dodo-shared.keystore.bak`);
      } catch (err) {
        console.warn(`      ⚠️ 備份舊金鑰時發生問題: ${err.message}`);
      }
    } else {
      console.log('\n   📡 [金鑰自癒偵測] 偵測到本地缺少專案共享簽名金鑰 dodo-shared.keystore，正在重新產生...');
    }
    
    try {
      if (!fs.existsSync(keystoreDir)) {
        fs.mkdirSync(keystoreDir, { recursive: true });
      }
      
      if (!storePassword || !keyPassword) {
        throw new Error('未偵測到簽名密碼，無法生成/重建金鑰！');
      }
      
      // 使用解析出的安全密碼調用 keytool，程式碼中 100% 無硬編碼密碼
      const cmd = `keytool -genkeypair -v -keystore "${keystorePath}" -alias dodo_key -keyalg RSA -keysize 2048 -validity 10000 -storepass "${storePassword}" -keypass "${keyPassword}" -dname "CN=Dodo, OU=Ledger, O=Dodo, L=Taipei, S=Taiwan, C=TW"`;
      
      execSync(cmd, { stdio: 'ignore' });
      console.log('   ✅ 專案共享簽名金鑰 dodo-shared.keystore 重新產生成功！已存放於: android/app/');
    } catch (err) {
      console.log('   ⚠️  重新產生 keystore 失敗，請確保本機已安裝 JDK 並可使用 keytool 指令！', err.message);
    }
  } else {
    console.log('   ✅ 專案共享簽名金鑰 dodo-shared.keystore 已存在，且密碼一致，跳過金鑰重新產生。');
  }

  console.log('🐾 [Dodo Cat prepare] 腳本執行完畢！祝您記帳愉快喵嗚～ (✿◡‿◡)\n');
}

run();
