const fs = require('fs');
const path = require('path');

// 取得外部傳入的 Android 版本號，例如 "1.0.8"
const targetVersion = process.argv[2];
if (!targetVersion) {
  console.error("請提供目標 Android 版本號，例如: node extract-changelog.cjs 1.0.8");
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

// 精準匹配標題：## [Web 2.0.5 / Android 1.0.8 / Build 9] - 2026-05-28
// 或 ## [Android 1.0.8] - 2026-05-28 等
// 正則解析：標題必須以 ## 開頭，且中括號中要包含 "Android" 與目標版本號
const titleRegex = new RegExp(`^##\\s+\\[.*Android\\s+${targetVersion.replace(/\./g, '\\.')}.*\\]`);

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
  // 寫入到本地的 release-notes-body.md
  fs.writeFileSync(path.join(__dirname, '../release-notes-body.md'), resultLines.join('\n'), 'utf8');
  console.log(`成功提取 Android v${targetVersion} 的 Changelog！`);
} else {
  console.warn(`找不到 Android v${targetVersion} 的 Changelog，將使用預設內容。`);
  fs.writeFileSync(path.join(__dirname, '../release-notes-body.md'), `### 🐱 Dodo Ledger Android v${targetVersion}\n\n- 此版本由 GitHub Actions 自動建置與釋出。`, 'utf8');
}
