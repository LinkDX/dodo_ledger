#!/bin/bash

# ==============================================================================
# Dodo Ledger - 本地一鍵快速打包 Android Debug APK 腳本 (高適應力環境自愈版)
# ==============================================================================

# 一旦任何指令失敗，立即停止執行
set -e

# 定義 ANSI 彩色輸出字元
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # 重置顏色

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}    🐱 歡迎使用 Dodo Ledger Android 一鍵極速打包工具     ${NC}"
echo -e "${BLUE}======================================================${NC}"

# 0. 環境自動檢測與自愈程序 (Auto-Setup & Verification)
echo -e "${YELLOW}[Step 0] 正在為您檢測並自動配置打包環境...${NC}"

# A. 檢測並自動建置 android/local.properties
if [ ! -f "android/local.properties" ]; then
    echo -e "${YELLOW}👉 未檢測到 android/local.properties，正在嘗試為您自動尋找 Android SDK...${NC}"
    
    # 常見 Android SDK 路徑清單
    SDK_CANDIDATES=(
        "/usr/lib/android-sdk"
        "$HOME/Android/Sdk"
        "/opt/android-sdk"
        "/usr/local/share/android-sdk"
    )
    
    FOUND_SDK=""
    for sdk in "${SDK_CANDIDATES[@]}"; do
        if [ -d "$sdk" ]; then
            FOUND_SDK="$sdk"
            break
        fi
    done
    
    if [ -n "$FOUND_SDK" ]; then
        echo -e "${GREEN}✨ 成功在 $FOUND_SDK 找到 Android SDK！已為您自動建置 local.properties。${NC}"
        mkdir -p android
        echo "sdk.dir=$FOUND_SDK" > android/local.properties
    else
        echo -e "${RED}[警告] 系統找不到常見的 Android SDK 安裝位置。${NC}"
        echo -e "${YELLOW}請手動在 android/local.properties 中寫入 sdk.dir=[您的 SDK 路徑]${NC}"
    fi
fi

# B. 檢測與配置 ANDROID_HOME 環境變數
if [ -z "$ANDROID_HOME" ]; then
    if [ -f "android/local.properties" ]; then
        # 從 local.properties 中自動提取 sdk.dir 的值
        EXTRACTED_SDK=$(grep -oP '(?<=sdk.dir=).*' android/local.properties || true)
        if [ -n "$EXTRACTED_SDK" ]; then
            export ANDROID_HOME="$EXTRACTED_SDK"
            echo -e "${GREEN}✨ 已自動依據 local.properties 匯入 ANDROID_HOME=$ANDROID_HOME${NC}"
        fi
    fi
fi

# C. 檢測與自動安裝 Java 17 JDK
JAVA_17_PATH="/usr/lib/jvm/java-17-openjdk-amd64"
if [ ! -d "$JAVA_17_PATH" ]; then
    echo -e "${YELLOW}👉 未檢測到完整的 Java 17 JDK ($JAVA_17_PATH)，正在嘗試為您自動修復安裝...${NC}"
    
    # 檢查是否在具有 apt-get 的 Debian/Ubuntu 環境下且具備 root 權限
    if [ -x "$(command -v apt-get)" ]; then
        echo -e "${YELLOW}🔧 檢測到 Ubuntu/Debian 系統，正在啟動 apt-get 自動安裝 openjdk-17-jdk...${NC}"
        
        # 判斷是否需要 sudo
        if [ "$(id -u)" -eq 0 ]; then
            # 強制清理可能被背景自動更新卡住的 dpkg 鎖，以防編譯中斷
            killall -9 apt-get apt dpkg || true
            rm -f /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock
            dpkg --configure -a || true
            
            apt-get update -qq
            apt-get install -y -qq openjdk-17-jdk
        else
            if [ -x "$(command -v sudo)" ]; then
                sudo killall -9 apt-get apt dpkg || true
                sudo rm -f /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock
                sudo dpkg --configure -a || true
                
                sudo apt-get update -qq
                sudo apt-get install -y -qq openjdk-17-jdk
            else
                echo -e "${RED}[錯誤] 系統缺少 Java 17 JDK，且無 root 權限自動安裝。${NC}"
                echo -e "${YELLOW}請手動在系統中安裝 openjdk-17-jdk 以繼續。${NC}"
                exit 1
            fi
        fi
        
        if [ -d "$JAVA_17_PATH" ]; then
            echo -e "${GREEN}✨ Java 17 JDK 自動安裝修復成功！${NC}"
        fi
    else
        echo -e "${RED}[警告] 系統缺少 Java 17 JDK，且不支援 apt-get 自動安裝。${NC}"
        echo -e "${YELLOW}請確保更換後的新環境中已手動安裝 JDK 17，並將 JAVA_HOME 指向它。${NC}"
    fi
fi

# 匯入 JAVA_HOME 環境變數，確保 Gradle 編譯 100% 成功
if [ -d "$JAVA_17_PATH" ]; then
    export JAVA_HOME="$JAVA_17_PATH"
fi

# 1. 檢查 android/ 原生目錄是否存在
if [ ! -d "android" ]; then
    echo -e "${RED}[錯誤] 尚未檢測到 android/ 原生目錄！${NC}"
    echo -e "${YELLOW}請先執行第一階段初始化以生成 Android 容器。${NC}"
    exit 1
fi

# 2. 編譯 Vue 3 前端網頁資源
echo -e "\n${YELLOW}[Step 1/4] 正在編譯 Vue 3 網頁靜態資源 (npm run build)...${NC}"
npm run build

# 3. 同步資源與外掛至 Android 原生容器
echo -e "\n${YELLOW}[Step 2/4] 正在同步資源至 Android 容器 (npx cap sync)...${NC}"
npx cap sync android

# 4. 呼叫 Gradle 編譯 Debug APK
echo -e "\n${YELLOW}[Step 3/4] 正在呼叫 Gradle 編譯 Debug 測試版 APK...${NC}"
chmod +x android/gradlew
./android/gradlew -p ./android assembleDebug

# 5. 提取 APK 並放置於方便拿取的根目錄
echo -e "\n${YELLOW}[Step 4/4] 正在整理 APK 檔案...${NC}"
mkdir -p build-artifacts
cp android/app/build/outputs/apk/debug/app-debug.apk build-artifacts/dodo-ledger-debug.apk

echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN}✨ 打包完成！Dodo 貓理財助理已打包成功喵！${NC}"
echo -e "${GREEN}======================================================${NC}"
echo -e "🎉 您的 Android 測試版 APK 已安全放置於："
echo -e "   👉 ${YELLOW}build-artifacts/dodo-ledger-debug.apk${NC}"
echo -e "💡 您可以隨時將此 APK 傳送至手機中直接安裝測試囉！"
echo -e "${GREEN}======================================================${NC}"
