#!/bin/bash

# 🌸 Dodo Ledger 逗逗貓一鍵編譯與測試驗證腳本 🌸

echo -e "\033[1;33m"
echo "   /\\_/\\"
echo "  ( =^P^=) ~ 喵！即將開始進行發布前的安全驗證與打包編譯！"
echo "   > * <"
echo -e "\033[0m"

# 1. TypeScript 語法編譯檢查
echo -e "\033[1;34m[1/3] [逗逗貓] 正在進行 TypeScript 嚴格語法檢驗...\033[0m"
npx vue-tsc --noEmit
if [ $? -ne 0 ]; then
  echo -e "\033[1;31m❌ [逗逗貓] 喵嗚！語法檢查失敗了，請修正 TypeScript 錯誤後再試！\033[0m"
  exit 1
fi
echo -e "\033[1;32m✓ TypeScript 語法檢查通過！\033[0m"

# 2. 自動化測試
echo -e "\033[1;34m[2/3] [逗逗貓] 正在執行 Vitest 自動化測試...\033[0m"
npm run test:run
if [ $? -ne 0 ]; then
  echo -e "\033[1;31m❌ [逗逗貓] 喵嗚嗚！自動化測試有未通過的項目，請先修正邏輯！\033[0m"
  exit 1
fi
echo -e "\033[1;32m✓ 自動化測試全部通過！\033[0m"

# 3. 生產環境打包編譯
echo -e "\033[1;34m[3/3] [逗逗貓] 正在使用 Vite 編譯高壓縮的生產環境網頁檔案...\033[0m"
npm run build
if [ $? -ne 0 ]; then
  echo -e "\033[1;31m❌ [逗逗貓] 喵！編譯打包失敗！\033[0m"
  exit 1
fi

echo -e "\033[1;32m"
echo "🎉 恭喜！Dodo Ledger 完美打包完成！"
echo "──────────────────────────────────────────────"
echo "  所有的靜態檔案已輸出至: ./dist"
echo "  只要推送到 GitHub，GitHub Actions CI/CD 將會為您自動發布！"
echo "──────────────────────────────────────────────"
echo -e "\033[0m"
