const fs = require('fs');
const path = require('path');

// 取得外部傳入的參數
let type = 'android';
let targetVersion = process.argv[2];

if (process.argv.length >= 4) {
  type = process.argv[2].toLowerCase();
  targetVersion = process.argv[3];
}

if (!targetVersion) {
  console.error("請提供版本號，例如: node extract-changelog.cjs android 1.0.8");
  process.exit(1);
}

const changelogPath = path.join(__dirname, '../CHANGELOG.md');
if (!fs.existsSync(changelogPath)) {
  console.error("找不到 CHANGELOG.md 檔案！");
  process.exit(1);
}

const content = fs.readFileSync(changelogPath, 'utf8');
const lines = content.split('\n');

let isExtracting = false;
const resultLines = [];

// 根據類型選擇匹配正則
// Web: ## [Web 2.0.8 ...]
// Android: ## [.*Android 1.0.9 ...]
const typePattern = type === 'web' ? 'Web' : 'Android';
const titleRegex = new RegExp(`^##\\s+\\[.*${typePattern}\\s+${targetVersion.replace(/\./g, '\\.')}.*\\]`);

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (titleRegex.test(line)) {
    isExtracting = true;
    resultLines.push(line); // 保留標題
    continue;
  }
  
  // 如果已經在提取中，遇到下一個 ## 標題就結束
  if (isExtracting && /^##\s+/.test(line)) {
    break;
  }
  
  if (isExtracting) {
    resultLines.push(line);
  }
}

if (resultLines.length > 0) {
  fs.writeFileSync(path.join(__dirname, '../release-notes-body.md'), resultLines.join('\n'), 'utf8');
  console.log(`成功提取 ${typePattern} v${targetVersion} 的 Changelog！`);
} else {
  console.warn(`找不到 ${typePattern} v${targetVersion} 的 Changelog，將使用預設內容。`);
  const defaultBody = type === 'web' 
    ? `### 🌸 Dodo Ledger Web v${targetVersion}\n\n- 網頁版本全新發布囉！\n- Android App 將自動下載並透過熱更新無感套用最新網頁功能。`
    : `### 🤖 Dodo Ledger Android v${targetVersion}\n\n- 此版本由 GitHub Actions 自動建置與釋出。`;
  fs.writeFileSync(path.join(__dirname, '../release-notes-body.md'), defaultBody, 'utf8');
}
