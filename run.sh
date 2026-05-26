#!/bin/bash

# 🌸 Dodo Ledger 逗逗貓一鍵啟動與開發重啟腳本 🌸

echo -e "\033[1;33m"
echo "   /\\_/\\"
echo "  ( o.o )  ~ 喵！歡迎使用 Dodo Ledger！"
echo "   > ^ <"
echo -e "\033[0m"
echo -e "\033[1;36m[逗逗貓] 正在為您整理記帳小天地...\033[0m"

# 1. 檢查 node_modules 是否存在，若無則自動安裝
if [ ! -d "node_modules" ]; then
  echo -e "\033[1;32m[逗逗貓] 哎呀！沒有發現 node_modules，讓我幫您抓老鼠（安裝依賴套件）...\033[0m"
  npm install
else
  echo -e "\033[1;32m[逗逗貓] 依賴套件都準備就緒囉！\033[0m"
fi

# 2. 啟動 Vite 本地開發伺服器
echo -e "\033[1;35m[逗逗貓] 伸個懶腰～即將啟動 Vite 開發伺服器！\033[0m"
echo -e "\033[1;36m[提示] 開瀏覽器打開控制台印出的本地網址就可以開始記帳囉！\033[0m"
echo ""

npm run dev -- --host
