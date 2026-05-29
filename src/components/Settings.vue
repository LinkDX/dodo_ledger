<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useAuth } from '../composables/useAuth'
import androidVersion from '../../android-version.json'
import { useConfirm } from '../composables/useConfirm'
import { useAlert } from '../composables/useAlert'
import pkg from '../../package.json'
import { getDatabaseService, FirestoreDatabaseService } from '../services/db'
import type { SystemLog } from '../types'
import { 
  Settings as SettingsIcon, 
  Sparkles, 
  CloudLightning,
  Cloud,
  CheckCircle,
  ShieldCheck,
  BadgeAlert,
  X,
  UserRound
} from 'lucide-vue-next'

// ─── App 原生更新與覆蓋安裝 ───
import { parseVersionFromApkName, compareVersions } from '../utils/version'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { registerPlugin } from '@capacitor/core'

const { currentProfile, updateProfileSettings, updateProfileAvatar } = useAuth()
const { showConfirm } = useConfirm()
const { showAlert } = useAlert()

// 🔒 Dodo Gatekeeper - 密碼鎖防護邏輯
import { useAppLock } from '../composables/useAppLock'
const { 
  hasLocalPassword, 
  isGlobalLockEnabled, 
  setupLocalPassword, 
  disableLocalPassword,
  lockApp 
} = useAppLock()

// ─── 版本資訊 ───
const appVersion = androidVersion.version
const webVersion = pkg.version

// ─── App 原生一鍵檢查與覆蓋安裝 ───
const isAppChecking = ref(false)
const appUpdateProgress = ref(0)
const hasAppUpdate = ref(false)
const appUpdateError = ref('')
const isLatestVersion = ref(false)
const hasNoRemoteApk = ref(false)
const remoteApkUrl = ref('')
const remoteApkName = ref('')
const remoteTagName = ref('')
const remoteReleaseNote = ref('')
const isDownloading = ref(false)
const nativeApkVersion = ref(appVersion)

const handleAppVersionCheck = async (showNoUpdateAlert = false) => {
  isAppChecking.value = true
  appUpdateError.value = ''
  hasAppUpdate.value = false
  isLatestVersion.value = false
  hasNoRemoteApk.value = false
  remoteReleaseNote.value = ''
  
  if (Capacitor.isNativePlatform()) {
    try {
      const info = await DodoInstaller.getAppVersion()
      if (info && info.versionName) {
        nativeApkVersion.value = info.versionName
      }
    } catch (e) {
      console.error('無法獲取原生版本資訊，維持先前快取：', e)
    }
  }
  try {
    // 💡 改為向 releases 列表請求，以防 latest release 是純 web 的無 APK 版本
    const res = await fetch('https://api.github.com/repos/LinkDX/dodo_ledger/releases?per_page=100')
    if (!res.ok) {
      throw new Error(`無法獲取版本清單 (${res.status})`)
    }
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) {
      hasNoRemoteApk.value = true
      return
    }

    // 尋找最新一個含有 APK 的 release (排除沒有 APK 的純 Web Release)
    let apkAsset: any = null
    let latestAppRelease: any = null

    for (const rel of data) {
      const asset = (rel.assets || []).find((a: any) => a.name && a.name.endsWith('.apk'))
      if (asset) {
        apkAsset = asset
        latestAppRelease = rel
        break
      }
    }

    if (!apkAsset || !latestAppRelease) {
      hasNoRemoteApk.value = true
      return
    }
    
    const tagName = latestAppRelease.tag_name || ''
    const remoteVer = parseVersionFromApkName(apkAsset.name)
    if (!remoteVer) {
      hasNoRemoteApk.value = true
      return
    }

    const localVer = nativeApkVersion.value
    const needUpdate = compareVersions(localVer, remoteVer)

    if (needUpdate) {
      hasAppUpdate.value = true
      remoteApkUrl.value = apkAsset.browser_download_url
      remoteApkName.value = apkAsset.name
      remoteTagName.value = tagName
      remoteReleaseNote.value = latestAppRelease.body || ''
    } else {
      isLatestVersion.value = true
      if (showNoUpdateAlert) {
        await showAlert(`✨ 報告主人！當前 App 版本 v${localVer} 已經是最新版囉！不用再更新喵🐾`)
      }
    }
  } catch (e: any) {
    console.error('App 版本檢查失敗：', e)
    let userFriendlyMsg = e.message || '未知對帳錯誤'
    if (e.name === 'TypeError' && e.message.includes('fetch')) {
      userFriendlyMsg = '無法連線至 GitHub 伺服器，請檢查您的網路狀態或稍後再試喵！'
    } else if (e.message.includes('403')) {
      userFriendlyMsg = 'GitHub API 請求過於頻繁 (403)，請稍後再試喵！'
    }
    appUpdateError.value = userFriendlyMsg
  } finally {
    isAppChecking.value = false
  }
}

const DodoInstaller = registerPlugin<any>('DodoInstaller')

const handleAppDownloadAndInstall = async () => {
  if (isDownloading.value) return
  isDownloading.value = true
  appUpdateError.value = ''
  appUpdateProgress.value = 0

  try {
    const result = await Filesystem.downloadFile({
      url: remoteApkUrl.value,
      path: remoteApkName.value,
      directory: Directory.Cache
    })

    // 調用原生一鍵安裝插件
    await DodoInstaller.installApk({ filePath: result.path })
  } catch (e: any) {
    console.error('下載或安裝 APK 失敗：', e)
    appUpdateError.value = e.message || '下載或安裝失敗，請檢查權限喵！'
  } finally {
    isDownloading.value = false
  }
}

onMounted(async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      const info = await DodoInstaller.getAppVersion()
      if (info && info.versionName) {
        nativeApkVersion.value = info.versionName
      }
    } catch (e) {
      console.error('無法獲取原生版本資訊，fallback 至內置資源版號：', e)
    }
    handleAppVersionCheck(false)
  }
})

// ─── 熱更新引擎實時監控 ───
import { Capacitor } from '@capacitor/core'
import { useLiveUpdates } from '../composables/useLiveUpdates'

const {
  isChecking: isHotChecking,
  updateProgress: hotUpdateProgress,
  hasUpdate: hasHotUpdate,
  updateError: hotUpdateError,
  checkForUpdates: runHotUpdateCheck,
  performImmediateReload
} = useLiveUpdates()

const localHotVersion = ref(localStorage.getItem('dodo_app_hot_version_code') || '100')

// 💡 監聽熱更新下載進度，完成後立刻詢問是否進行免重開的「即時熱重載」！
watch(hotUpdateProgress, async (newProgress) => {
  if (newProgress === 100 && Capacitor.isNativePlatform()) {
    const newestVersionCode = parseInt(localStorage.getItem('dodo_app_hot_version_code') || '100', 10)
    const confirm = await showConfirm(
      '✨ 發現新功能！熱更新套件已布署完成。是否要立即重新載入 App 套用新版？🐾',
      '🚀 立即套用新版本'
    )
    if (confirm) {
      const success = await performImmediateReload(newestVersionCode)
      if (!success) {
        await showAlert('⚠️ 無法立即重新載入。請手動完全關閉並重啟 App 以套用新版喵！🐾')
      }
    }
  }
})

const handleManualHotUpdate = async () => {
  await runHotUpdateCheck()
  // 更新成功後重新讀取本地版本號，讓 UI 同步
  localHotVersion.value = localStorage.getItem('dodo_app_hot_version_code') || '100'
}

const handleResetHotUpdate = async () => {
  if (await showConfirm('確定要清除所有熱更新快取並回退到 APK 內建版本嗎？', '🔄 回退內建版本')) {
    localStorage.removeItem('dodo_app_hot_version_code')
    localHotVersion.value = '100'
    await showAlert('✨ 已清除快取！請「重啟 App」以恢復至原始版本。🐾')
  }
}

// ─── 進階管理員彩蛋 ───
const webClickCount = ref(0)
const isAdminMode = ref(false)

const handleWebVersionClick = async () => {
  webClickCount.value++
  if (webClickCount.value >= 5) {
    isAdminMode.value = true
    await showAlert('🐱 喵！恭喜主人觸發神秘彩蛋！解鎖「逗逗貓超高級管理介面」！🐾')
    setTimeout(() => {
      document.getElementById('admin-panel')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }
}

// ─── 稽核日誌拉取 ───
const logsList = ref<SystemLog[]>([])
const isLogsLoading = ref(false)

const loadSystemLogs = async () => {
  isLogsLoading.value = true
  try {
    const dbService = getDatabaseService()
    const allLogs = await dbService.getLogs()
    logsList.value = allLogs ? allLogs.sort((a, b) => b.date - a.date) : []
  } catch (e) {
    console.error('無法載入稽核日誌：', e)
  } finally {
    isLogsLoading.value = false
  }
}

watch(isAdminMode, (newVal) => {
  if (newVal) {
    loadSystemLogs()
  }
})

const showLockModal = ref(false)
const lockActionType = ref<'enable' | 'disable' | 'change'>('enable')
const lockInputPwd = ref('')
const lockInputConfirm = ref('')
const lockModalError = ref('')

const openLockModal = (action: 'enable' | 'disable' | 'change') => {
  lockActionType.value = action
  lockInputPwd.value = ''
  lockInputConfirm.value = ''
  lockModalError.value = ''
  showLockModal.value = true
}

const handleLockSubmit = async () => {
  lockModalError.value = ''
  
  if (lockActionType.value === 'enable' || lockActionType.value === 'change') {
    if (lockInputPwd.value.length < 4 || lockInputPwd.value.length > 8) {
      lockModalError.value = '密碼長度必須介於 4 到 8 位數之間喵！'
      return
    }
    if (!/^\d+$/.test(lockInputPwd.value)) {
      lockModalError.value = '密碼只能包含數字喔喵！'
      return
    }
    if (lockInputPwd.value !== lockInputConfirm.value) {
      lockModalError.value = '兩次輸入的密碼不一致，請再確認一下喵！'
      return
    }
    
    await setupLocalPassword(lockInputPwd.value)
    showLockModal.value = false
    await showAlert('🔒 密碼設定成功！從現在起每次開啟本網頁，都會被安全保護囉！')
  } else if (lockActionType.value === 'disable') {
    const success = await disableLocalPassword(lockInputPwd.value)
    if (success) {
      showLockModal.value = false
      await showAlert('🔓 本地密碼保護已成功停用，金庫已解鎖。')
    } else {
      lockModalError.value = '密碼不正確，無法解鎖金庫喵！'
    }
  }
}

const handleImmediateLock = () => {
  lockApp()
}

// 0. 頭像選擇狀態
const AVATAR_OPTIONS = [
  '🐱','🐯','🐻','🐼','🐸','🦊','🐧','🐰',
  '🐹','🦝','🦉','🐮','🐷','🦁','🐺','🐨',
  '🍑','🧊','🍇','🌸','⭐','🌈','🎃','🍀'
]
const avatarSaved = ref(false)
const showAvatarModal = ref(false)

const handleSelectAvatar = async (emoji: string) => {
  await updateProfileAvatar(emoji)
  avatarSaved.value = true
  showAvatarModal.value = false // 選擇後自動關閉 modal
  setTimeout(() => { avatarSaved.value = false }, 2000)
}

// 1. 預算設定狀態
const budgetVal = ref<number>(currentProfile.value?.settings.monthlyBudget || 20000)
const isSavedSuccess = ref(false)

const handleSaveBudget = () => {
  updateProfileSettings({
    monthlyBudget: Number(budgetVal.value) || 20000
  })
  isSavedSuccess.value = true
  setTimeout(() => {
    isSavedSuccess.value = false
  }, 3000)
}

// 2. Firebase 雲端同步狀態
const isCurrentlyCloudMode = ref(getDatabaseService() instanceof FirestoreDatabaseService)

// 格式化千分位金額
const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('zh-TW', { style: 'decimal' }).format(val)
}
</script>

<template>
  <div class="settings-page pop-jelly">
    <div class="page-header">
      <h2 class="page-title"><SettingsIcon class="icon-inline" /> 設定與雲端備份</h2>
      <p class="page-subtitle">管理您的記帳預算，並一鍵備份同步至 Firebase 雲端</p>
    </div>

    <!-- 0. 頭像更換 -->
    <div class="settings-box card-jelly">
      <h3 class="box-title"><UserRound class="icon-inline" /> 更換我的頭像</h3>

      <div class="avatar-current-row">
        <span class="avatar-current-display">{{ currentProfile?.avatar }}</span>
        <div class="avatar-current-info">
          <span class="avatar-current-name">{{ currentProfile?.name }}</span>
          <button class="btn-jelly btn-action btn-change-avatar" @click="showAvatarModal = true" type="button">
            🐾 選擇新頭像
          </button>
        </div>
        <Transition name="fade-success">
          <span v-if="avatarSaved" class="save-success-badge pop-jelly">
            <CheckCircle :size="12" /> 已更新！
          </span>
        </Transition>
      </div>
    </div>

    <!-- 1. 每月收支預算設定 -->
    <div class="settings-box card-jelly">
      <h3 class="box-title"><Sparkles class="icon-inline" /> 理財月預算設定</h3>
      
      <div class="form-group">
        <label class="label-cute">本月記帳總預算 (TWD)</label>
        <div class="budget-input-row">
          <input 
            v-model="budgetVal" 
            type="number" 
            placeholder="20000" 
            class="input-jelly budget-input" 
          />
          <button class="btn-jelly btn-save-budget" @click="handleSaveBudget">
            儲存預算 🐾
          </button>
        </div>
        
        <Transition name="fade-success">
          <div v-if="isSavedSuccess" class="save-success-badge pop-jelly">
            <CheckCircle :size="12" /> 喵！預算更新成功！
          </div>
        </Transition>
      </div>

      <div class="budget-desc-card">
        <p class="desc-text">
          目前預算：<span class="desc-bold">${{ formatCurrency(currentProfile?.settings.monthlyBudget || 20000) }} 元</span>
        </p>
        <p class="desc-hint">
          * 逗逗貓會根據這個預算數值，在首頁療癒生活秀中展示微笑、流汗、或抓狂遮眼大哭的可愛狀態喔喵！
        </p>
      </div>
    </div>

    <!-- 📱 App 內一鍵檢查與原生覆蓋安裝 (僅在實體 Android 手機中渲染) -->
    <div v-if="Capacitor.isNativePlatform()" class="settings-box card-jelly pop-jelly">
      <h3 class="box-title">
        <Sparkles class="icon-inline" /> 📱 原生 Android 系統更新
      </h3>
      <p class="categories-preview-hint">
        直接向 GitHub 雲端安全對帳最新版本。發現新版本時可一鍵背景下載，並引導系統完成覆蓋安裝。
      </p>

      <div class="update-monitor-grid" style="background-color: var(--color-bg-warm); margin-bottom: 12px;">
        <div class="monitor-item">
          <span class="monitor-label">當前 App 版本：</span>
          <span class="monitor-value code-value">
            v{{ nativeApkVersion }}
            <span v-if="nativeApkVersion !== appVersion" style="font-size: 11px; opacity: 0.8; font-weight: normal; margin-left: 4px;">
              (熱更新: v{{ appVersion }})
            </span>
          </span>
        </div>
        
        <div v-if="hasAppUpdate" class="monitor-item pop-jelly">
          <span class="monitor-label" style="color: var(--color-expense);">最新可用版本：</span>
          <span class="monitor-value code-value" style="background-color: #FFF0ED; border-color: var(--color-expense); color: var(--color-expense);">
            {{ remoteTagName }}
          </span>
        </div>

        <div class="monitor-status-box pop-jelly" style="background-color: #FFFFFF;">
          <p class="status-msg">
            <span v-if="isAppChecking">🔍 正在向 GitHub 安全資料庫對帳中，請稍候...</span>
            <span v-else-if="isDownloading">📥 正在安全下載新版 APK 檔案中，請勿關閉 App...</span>
            <span v-else-if="hasAppUpdate" style="color: var(--color-expense); font-weight: 800;">
              🎉 發現最新版本 {{ remoteTagName }}！快點擊下方按鈕進行覆蓋升級吧！🐾
            </span>
            <span v-else-if="appUpdateError" class="status-error">
              ❌ 連線失敗：{{ appUpdateError }}。請檢查網路或稍後再試。
            </span>
            <span v-else-if="hasNoRemoteApk" style="color: var(--color-text-muted);">
              ⚠️ 遠端版本庫中目前沒有發現可用於安裝的 APK 檔案喵！
            </span>
            <span v-else>
              🟢 您的 Dodo Ledger App 目前已是最新版本，安全無虞！
            </span>
          </p>
        </div>
      </div>

      <!-- 📋 最新原生 App 的更新日誌說明 -->
      <div v-if="hasAppUpdate && remoteReleaseNote" class="monitor-status-box pop-jelly" style="background-color: #FFFFFF; border-style: dashed; border-color: var(--color-expense); text-align: left; margin-bottom: 12px; max-height: 180px; overflow-y: auto;">
        <p class="status-msg" style="font-weight: 800; font-size: 13px; color: var(--color-text-dark); margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
          📋 此次更新內容 (Changelog)：
        </p>
        <div style="font-size: 12px; color: var(--color-text-dark); line-height: 1.6; white-space: pre-wrap; word-break: break-all; padding-right: 4px;">
          {{ remoteReleaseNote }}
        </div>
      </div>

      <div class="monitor-actions-row">
        <!-- 下載並安裝按鈕 -->
        <button 
          v-if="hasAppUpdate"
          class="btn-jelly btn-lock-primary pop-jelly" 
          style="width: 100%; font-weight: 800; background-color: var(--color-income) !important;"
          :disabled="isDownloading"
          @click="handleAppDownloadAndInstall"
          type="button"
        >
          {{ isDownloading ? '📥 正在下載安裝包...' : '⚡ 立即一鍵覆蓋安裝' }}
        </button>

        <!-- 檢查更新按鈕 -->
        <button 
          v-else
          class="btn-jelly btn-save-budget" 
          style="width: 100%;"
          :disabled="isAppChecking"
          @click="handleAppVersionCheck(true)"
          type="button"
        >
          {{ isAppChecking ? '正在對帳中...' : '🔍 檢查 App 最新版本' }}
        </button>
      </div>
    </div>

    <!-- 🐾 2. 逗逗貓超高級管理介面 (神秘彩蛋) 🐾 -->
    <Transition name="expand-details">
      <div v-if="isAdminMode" id="admin-panel" class="admin-panel-container card-jelly pop-jelly">
        <div class="admin-panel-header">
          <h2 class="admin-title">🐾 逗逗貓超高級管理介面 🐾</h2>
          <p class="admin-subtitle">此處為系統最高權限稽核管理中心，僅限超級管理貓咪使用！🐾</p>
        </div>

        <!-- 📡 逗逗貓自建熱更新監控閣 -->
        <div class="settings-box card-jelly" style="background-color: #FFFDF9 !important;">
          <h3 class="box-title" style="color: var(--color-text-dark); margin-bottom: 6px;">
            📡 逗逗貓自建熱更新監控閣
          </h3>
          <p style="font-size: 11px; color: var(--color-text-muted); margin-bottom: 12px;">
            實時監控 Android 行動裝置的自建雙緩衝熱更新引擎狀態，確保金庫資源與雲端 100% 同步。
          </p>

          <div class="update-monitor-grid">
            <div class="monitor-item">
              <span class="monitor-label">連線狀態：</span>
              <span class="monitor-value status-online">🟢 正常連線至 linkdx.github.io</span>
            </div>
            <div class="monitor-item">
              <span class="monitor-label">本地熱更新版號：</span>
              <span class="monitor-value code-value">Code {{ localHotVersion }}</span>
            </div>
            <div class="monitor-item">
              <span class="monitor-label">當前加載平台：</span>
              <span class="monitor-value code-value">{{ Capacitor.isNativePlatform() ? '📱 Android 原生沙盒 WebView' : '💻 桌面瀏覽器 (Web Mode)' }}</span>
            </div>
            
            <!-- 實時狀態 -->
            <div class="monitor-status-box pop-jelly">
              <p class="status-msg">
                <span v-if="isHotChecking">🔍 正在與雲端伺服器對帳比對中，請稍候...</span>
                <span v-else-if="hotUpdateProgress > 0 && hotUpdateProgress < 100">
                  📥 正在背景默默下載最新網頁包：{{ hotUpdateProgress }}%
                </span>
                <span v-else-if="hotUpdateProgress === 100">
                  🎉 下載成功！熱更新套件已布署，您可立即套用或於下次啟動時生效！🐾
                </span>
                <span v-else-if="hotUpdateError" class="status-error">
                  ❌ 更新失敗：{{ hotUpdateError }}。請檢查網路連線或稍後再試。
                </span>
                <span v-else-if="hasHotUpdate">
                  ✨ 發現有可更新的網頁包，正在準備背景下載...
                </span>
                <span v-else>
                  🐱 已加載本地最新金庫版本，安全無虞！
                </span>
              </p>
              
              <!-- 進度條 -->
              <div v-if="hotUpdateProgress > 0 && hotUpdateProgress < 100" class="update-progress-bar-bg">
                <div class="update-progress-bar-fill" :style="{ width: hotUpdateProgress + '%' }"></div>
              </div>
            </div>
          </div>

          <div class="monitor-actions-row">
            <button 
              class="btn-jelly btn-action btn-check-update" 
              :disabled="isHotChecking || (hotUpdateProgress > 0 && hotUpdateProgress < 100)"
              @click="handleManualHotUpdate"
              type="button"
            >
              {{ isHotChecking ? '正在對帳...' : '🐾 手動檢查更新' }}
            </button>
            <button 
              class="btn-jelly btn-action btn-reset-update" 
              @click="handleResetHotUpdate"
              type="button"
            >
              🧹 清除熱更新快取
            </button>
          </div>
        </div>

        <!-- 移過來的卡片 1: Firebase 雲端備份防護 -->
        <div class="settings-box card-jelly">
          <h3 class="box-title">
            <CloudLightning class="icon-inline" /> Firebase 雲端備份防護
          </h3>

          <!-- 雲端狀態橫條 -->
          <div 
            class="cloud-status-badge card-jelly"
            :class="{ 'cloud-active': isCurrentlyCloudMode, 'cloud-inactive': !isCurrentlyCloudMode }"
          >
            <div class="status-left">
              <Cloud v-if="isCurrentlyCloudMode" :size="20" class="icon-cloud" />
              <CloudLightning v-else :size="20" class="icon-cloud" />
              <span class="status-text">
                儲存狀態: {{ isCurrentlyCloudMode ? '☁️ Firebase 雲端同步模式' : '📟 LocalStorage 本地儲存模式' }}
              </span>
            </div>
          </div>

          <!-- 雲端狀態說明 -->
          <div v-if="isCurrentlyCloudMode" class="cloud-connected-info pop-jelly">
            <div class="shield-success-card card-jelly">
              <ShieldCheck :size="32" class="icon-shield" />
              <h4>雲端防護已自動啟動！</h4>
              <p class="shield-desc">
                偵測到專案內置的 Firebase 金鑰設定。您的記帳資料已自動在 Firebase Firestore 進行安全的雲端即時同步備份與多人共同記帳保護，未來的 Android App 也將能無縫共享資料喔喵！🐾
              </p>
              
              <!-- 調試資訊 -->
              <div class="debug-id-info">
                <span class="debug-label">當前成員 ID：</span>
                <span class="debug-value">{{ currentProfile?.id || 'unknown' }}</span>
              </div>
            </div>
          </div>

          <div v-else class="cloud-connected-info pop-jelly">
            <div class="inner-config-card card-jelly" style="background-color: #FFF0ED !important; border-color: #FFAAAA !important; text-align: left;">
              <div class="config-icon">📟</div>
              <div class="config-details">
                <h4 class="config-title" style="color: #B4463E;">本地離線記帳中</h4>
                <p class="shield-desc" style="margin-top: 4px; color: var(--color-text-muted);">
                  目前未使用雲端。您的所有記帳與資產紀錄皆安全地儲存在您本機瀏覽器的 LocalStorage 裡。若要開啟多人雲端共同記帳，請在發布時配置 Firebase 金鑰，系統即會自動上雲同步喵！
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- 移過來的卡片 2: Dodo Gatekeeper 安全防護與密碼鎖 -->
        <div class="settings-box card-jelly">
          <h3 class="box-title">
            <ShieldCheck class="icon-inline" /> 🔒 應用安全防護門禁
          </h3>
          
          <p class="categories-preview-hint">
            為您的記帳本加上一道鎖，防止別人在同台電腦或透過網址直接進入您的私密金庫。
          </p>

          <div class="lock-status-card card-jelly" :class="{ 'lock-active-border': hasLocalPassword || isGlobalLockEnabled }">
            <div class="status-left-lock">
              <span class="status-icon">
                <ShieldCheck v-if="hasLocalPassword || isGlobalLockEnabled" :size="20" style="color: #2EB086" />
                <BadgeAlert v-else :size="20" style="color: #FF5A5A" />
              </span>
              <div class="status-info">
                <h4 class="status-title-text">
                  防護狀態：{{ isGlobalLockEnabled ? '全域金鑰保護中' : hasLocalPassword ? '本地密碼鎖啟用中' : '無密碼保護 (不安全)' }}
                </h4>
                <p class="status-desc-text">
                  {{ isGlobalLockEnabled ? '此系統已被全域環境變數鎖定，未授權者無法存取。' : hasLocalPassword ? '每次開啟本網頁時，都必須輸入您設定的專屬數字密碼。' : '目前任何人只要知道此網址即可直接進入並檢視您的資料，建議立刻開啟密碼鎖。' }}
                </p>
              </div>
            </div>
          </div>

          <div class="lock-actions-row">
            <!-- 情況 A: 全域鎖定中 -->
            <div v-if="isGlobalLockEnabled" class="global-lock-notice">
              🛡️ 系統已受全域打包金鑰防護，無法於此處修改密碼。
            </div>
            
            <!-- 情況 B: 本地密碼操作 -->
            <div v-else class="local-actions-flex">
              <button 
                v-if="!hasLocalPassword" 
                class="btn-jelly btn-lock-primary"
                @click="openLockModal('enable')"
              >
                🔑 開啟本地密碼鎖
              </button>
              
              <template v-else>
                <button 
                  class="btn-jelly btn-lock-secondary"
                  @click="openLockModal('change')"
                >
                  🔄 修改密碼
                </button>
                <button 
                  class="btn-jelly btn-lock-danger"
                  @click="openLockModal('disable')"
                >
                  🔓 關閉密碼鎖
                </button>
                <button 
                  class="btn-jelly btn-lock-test"
                  @click="handleImmediateLock"
                >
                  🐱 立即測試鎖定
                </button>
              </template>
            </div>
          </div>
        </div>

        <!-- 新增卡片 3: Dodo Cat 系統稽核日誌 -->
        <div class="settings-box card-jelly">
          <h3 class="box-title" style="justify-content: space-between; display: flex; width: 100%;">
            <span>📋 Dodo Cat 系統稽核日誌</span>
            <button class="btn-jelly btn-refresh-logs" @click="loadSystemLogs" :disabled="isLogsLoading" type="button">
              🔄 重新整理
            </button>
          </h3>
          
          <p class="categories-preview-hint">
            此日誌精準記錄了成員身分變更、財務設定與金庫存取紀錄。
          </p>

          <div v-if="isLogsLoading" class="logs-spinner-container">
            <div class="spinner"></div>
            <span style="font-size: 13px; font-weight: 800; margin-left: 8px;">日誌努力載入中...</span>
          </div>

          <div v-else-if="logsList.length === 0" class="empty-logs-hint">
            🐱 喵？目前沒有發現 any 稽核操作紀錄喔。
          </div>

          <div v-else class="logs-scroll-box">
            <div v-for="log in logsList" :key="log.id" class="log-item-card card-jelly">
              <div class="log-item-header">
                <div class="log-operator-info">
                  <span class="log-avatar">{{ log.operatorAvatar }}</span>
                  <span class="log-operator-name">{{ log.operator }}</span>
                </div>
                <span class="log-time">{{ new Date(log.date).toLocaleString() }}</span>
              </div>
              <div class="log-item-body">
                <span class="log-action-tag" :class="log.action">{{ log.action }}</span>
                <p class="log-desc">{{ log.description }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 最底部的版本標籤 (自定義 UI) -->
    <div class="version-section">
      <template v-if="Capacitor.isNativePlatform()">
        <span class="version-item">App Version: v{{ appVersion }}</span>
        <span class="version-separator">|</span>
      </template>
      <span class="version-item web-version-trigger btn-jelly" @click="handleWebVersionClick">
        Web Version: v{{ webVersion }}
      </span>
    </div>

    <!-- 🔒 密碼設定/驗證彈窗 Modal (Jelly Style) -->
    <Transition name="bubble-fade">
      <div v-if="showLockModal" class="lock-modal-overlay">
        <div class="lock-modal-card pop-jelly">
          <div class="modal-header">
            <h4>
              {{ lockActionType === 'enable' ? '🔑 開啟密碼保護' : lockActionType === 'change' ? '🔄 修改防護密碼' : '🔓 關閉密碼保護' }}
            </h4>
            <button class="btn-close-modal" @click="showLockModal = false">
              <X :size="18" />
            </button>
          </div>
          
          <div class="modal-body">
            <p class="modal-body-tip">
              {{ lockActionType === 'enable' ? '請設定一個 4 到 8 位數的「數字解鎖密碼」，此密碼將以安全雜湊儲存在您的瀏覽器中。' : lockActionType === 'change' ? '請輸入您的新數字密碼，並再次確認。' : '請輸入您當前的密碼以確認關閉安全鎖。' }}
            </p>
            
            <div class="form-group margin-top-sm">
              <label class="label-cute">
                {{ lockActionType === 'disable' ? '請輸入當前密碼' : '輸入新密碼 (4~8位數字)' }}
              </label>
              <input 
                v-model="lockInputPwd"
                type="password" 
                pattern="[0-9]*"
                inputmode="numeric"
                placeholder="••••" 
                class="input-jelly text-center" 
                maxlength="8"
                @keyup.enter="handleLockSubmit"
              />
            </div>
            
            <div v-if="lockActionType !== 'disable'" class="form-group">
              <label class="label-cute">再次確認新密碼</label>
              <input 
                v-model="lockInputConfirm"
                type="password" 
                pattern="[0-9]*"
                inputmode="numeric"
                placeholder="••••" 
                class="input-jelly text-center" 
                maxlength="8"
                @keyup.enter="handleLockSubmit"
              />
            </div>

            <div v-if="lockModalError" class="modal-error-msg pop-jelly">
              ⚠️ {{ lockModalError }}
            </div>
          </div>
          
          <div class="modal-footer">
            <button class="btn-jelly btn-cancel-cat" @click="showLockModal = false">
              取消 🐾
            </button>
            <button 
              class="btn-jelly btn-save-cat"
              :disabled="!lockInputPwd || (lockActionType !== 'disable' && !lockInputConfirm)" 
              @click="handleLockSubmit"
            >
              {{ lockActionType === 'disable' ? '確認關閉' : '儲存設定' }} 🐾
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ========== 更換頭像彈窗 (Teleport 可愛 Dialog) ========== -->
    <Teleport to="#app">
      <Transition name="fade">
        <div v-if="showAvatarModal" class="modal-overlay" @click="showAvatarModal = false">
          <div class="modal-card card-jelly pop-jelly" @click.stop>
            <div class="modal-header-row">
              <h3 class="modal-title">🐱 選擇我的可愛頭像</h3>
              <button class="btn-jelly btn-close-edit" @click="showAvatarModal = false" type="button">
                <X :size="14" />
              </button>
            </div>

            <div class="avatar-picker-grid">
              <button
                v-for="emoji in AVATAR_OPTIONS"
                :key="emoji"
                class="avatar-option btn-jelly"
                :class="{ 'avatar-active': currentProfile?.avatar === emoji }"
                @click="handleSelectAvatar(emoji)"
              >
                {{ emoji }}
              </button>
            </div>
            
            <div class="modal-actions">
              <button class="btn-jelly btn-cancel" @click="showAvatarModal = false" style="width: 100%" type="button">
                關閉 🐾
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* ========== 彈窗樣式 ========== */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(44, 30, 27, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  overflow-y: auto;
  backdrop-filter: blur(4px);
}

.modal-card {
  width: 100%;
  max-width: 360px;
  background-color: #FFFFFF;
  border: var(--border-width) solid var(--color-border) !important;
  border-radius: var(--border-radius-lg) !important;
  padding: 20px !important;
  margin: auto 0;
  box-shadow: var(--shadow-jelly-lg) !important;
}

.modal-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.modal-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--color-text-dark);
}

.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.btn-close-edit {
  width: 28px;
  height: 28px;
  padding: 0 !important;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg-warm) !important;
  border: var(--border-width) solid var(--color-border) !important;
}

.avatar-current-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.btn-change-avatar {
  padding: 4px 10px !important;
  font-size: 12px !important;
  background-color: var(--color-bg-warm) !important;
  font-weight: 800 !important;
  box-shadow: var(--shadow-jelly-sm) !important;
  border-radius: var(--border-radius-sm) !important;
}

.btn-change-avatar:hover {
  background-color: #FFFFFF !important;
}

/* ========== 熱更新監控閣樣式 ========== */
.update-monitor-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background-color: var(--color-bg-warm);
  padding: 12px;
  border-radius: var(--border-radius-md);
  border: 1.5px solid var(--color-border);
  margin-bottom: 12px;
}

.monitor-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  font-weight: 700;
}

.monitor-label {
  color: var(--color-text-muted);
}

.monitor-value {
  color: var(--color-text-dark);
}

.monitor-value.status-online {
  color: #2EB086;
  font-weight: 800;
}

.status-error {
  color: #FF6B6B;
  font-weight: 800;
  display: block;
}

.monitor-value.code-value {
  background-color: #FFFFFF;
  border: 1px solid var(--color-border);
  padding: 2px 6px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 800;
}

.monitor-status-box {
  background-color: #FFFFFF;
  border: 1.5px dashed var(--color-border);
  border-radius: var(--border-radius-sm);
  padding: 10px;
  margin-top: 6px;
  text-align: center;
}

.status-msg {
  font-size: 12px;
  font-weight: 800;
  color: var(--color-text-dark);
  margin: 0;
}

.update-progress-bar-bg {
  width: 100%;
  height: 8px;
  background-color: var(--color-bg-warm);
  border: 1.5px solid var(--color-border);
  border-radius: 4px;
  margin-top: 8px;
  overflow: hidden;
  position: relative;
}

.update-progress-bar-fill {
  height: 100%;
  background-color: var(--color-income);
  transition: width 0.1s linear;
}

.monitor-actions-row {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.btn-action {
  flex: 1;
  white-space: nowrap;
  font-size: 12px !important;
  padding: 8px 4px !important;
}

.btn-check-update {
  padding: 8px 12px !important;
  font-size: 13px !important;
  font-weight: 800 !important;
  background-color: var(--color-accent-gold) !important;
  box-shadow: var(--shadow-jelly-sm) !important;
}

.btn-reset-update {
  background-color: var(--color-bg-warm) !important;
  color: var(--color-text-muted) !important;
}

.btn-check-update:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: 1px 1px 0px 0px #2C1E1B !important;
}
.settings-page {
  padding: 16px;
  padding-bottom: 90px;
}

.page-header {
  margin-bottom: 20px;
}

.page-title {
  font-size: 22px;
  font-weight: 800;
  margin-bottom: 4px;
}

.page-subtitle {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-muted);
}

/* 設定卡片盒 */
.settings-box {
  padding: 16px !important;
  background-color: #FFFFFF;
  margin-bottom: 20px;
}

.box-title {
  font-size: 17px;
  font-weight: 800;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
}

.form-group {
  margin-bottom: 14px;
  width: 100%;
}

.label-cute {
  font-size: 14px;
  font-weight: 800;
  display: block;
  margin-bottom: 6px;
  padding-left: 4px;
}

/* 預算輸入 */
.budget-input-row {
  display: flex;
  gap: 10px;
}

.budget-input {
  flex: 1;
}

.btn-save-budget {
  background-color: var(--color-accent-gold) !important;
  font-size: 12px;
}

.save-success-badge {
  font-size: 14px;
  font-weight: 800;
  color: #2C8C67;
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.budget-desc-card {
  background-color: var(--color-bg-warm);
  border: 1.5px solid var(--color-border);
  border-radius: var(--border-radius-md);
  padding: 10px;
  margin-top: 14px;
}

.desc-text {
  font-size: 15px;
  font-weight: 800;
}

.desc-bold {
  color: #FF5A5A;
  font-size: 17px;
}

.desc-hint {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-muted);
  margin-top: 4px;
  line-height: 1.4;
}

/* Firebase 雲端面板 */
.cloud-status-badge {
  padding: 10px 14px !important;
  margin-bottom: 16px !important;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cloud-active {
  background-color: rgba(46, 176, 134, 0.15) !important;
}

.cloud-inactive {
  background-color: var(--color-bg-warm) !important;
}

.status-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-text {
  font-size: 14px;
  font-weight: 800;
}

.icon-cloud {
  color: var(--color-text-dark);
}

.status-indicator {
  width: 100px;
}

/* 已連線雲端 */
.shield-success-card {
  background-color: #E1F8EB !important;
  text-align: center;
  padding: 20px !important;
}

.icon-shield {
  color: #2EB086;
  margin-bottom: 8px;
}

.shield-desc {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
  color: var(--color-text-muted);
  margin-top: 6px;
}

.debug-id-info {
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px dashed var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
}

.debug-label {
  color: var(--color-text-muted);
  font-weight: 800;
}

.debug-value {
  font-family: monospace;
  background-color: var(--color-bg-warm);
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--color-text-dark);
}

.btn-disconnect {
  width: 100%;
  background-color: #FFFFFF !important;
  color: #FF5A5A !important;
  font-size: 12px;
  margin-top: 12px;
}

/* 未連線雲端 */
.btn-connect-cloud {
  width: 100%;
  background-color: var(--color-transfer) !important;
  font-size: 13px;
  margin-top: 12px;
}

.inner-config-card {
  background-color: var(--color-bg-warm) !important;
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px !important;
  margin-bottom: 12px !important;
  border-radius: var(--border-radius-md) !important;
  text-align: left;
}

.config-icon {
  font-size: 24px;
}

.config-details {
  flex: 1;
}

.config-title {
  font-size: 15px !important;
  font-weight: 800 !important;
  margin-bottom: 2px !important;
}

.config-sub {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-muted);
}

.config-code {
  background-color: rgba(44, 30, 27, 0.08);
  padding: 1px 4px;
  border-radius: 4px;
  font-family: monospace;
}

.config-sub-hint {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-muted);
  margin-top: 4px;
  line-height: 1.4;
}

/* 🐾 分類管理大師樣式 */
.categories-preview-hint {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-muted);
  line-height: 1.4;
  margin-bottom: 12px;
}

.category-tabs-row {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

.btn-cat-tab {
  flex: 1;
  font-size: 12px;
  background-color: var(--color-bg-warm) !important;
}

.btn-cat-tab.active {
  background-color: var(--color-accent-gold) !important;
  border-color: var(--color-border) !important;
  box-shadow: var(--shadow-jelly-sm) !important;
  transform: translateY(-1px);
}

.cat-accordion-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.cat-accordion-item {
  padding: 12px !important;
  margin-bottom: 0 !important;
  background-color: #FFFFFF;
}

.accordion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cat-icon-emoji {
  font-size: 16px;
}

.cat-name-bold {
  font-size: 15px;
  font-weight: 800;
}

.sub-count-tag {
  font-size: 13px !important;
  padding: 2px 8px !important;
  background-color: var(--color-bg-warm) !important;
  box-shadow: var(--shadow-jelly-sm-sm, 1px 1px 0 0 #2C1E1B) !important;
}

.btn-delete-cat {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--border-radius-sm);
  transition: background-color 0.15s ease;
}

.btn-delete-cat:hover {
  background-color: #FFDADA;
}

.btn-delete-cat :deep(svg) {
  stroke: #FF5A5A;
}

.accordion-body {
  border-top: 1.5px dashed var(--color-border);
  margin-top: 10px;
  padding-top: 12px;
  text-align: left;
}

.sub-pills-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.sub-cute-pill {
  background-color: #FFFFFF !important;
  font-size: 13px !important;
  padding: 4px 8px 4px 10px !important;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  box-shadow: var(--shadow-jelly-sm-sm, 1px 1px 0 0 #2C1E1B) !important;
}

.btn-remove-sub {
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border-radius: 50%;
}

.btn-remove-sub:hover {
  background-color: var(--color-bg-warm);
}

.btn-remove-sub :deep(svg) {
  stroke: #FF5A5A;
}

.empty-sub-hint {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-align: center;
  margin-bottom: 12px;
}

.add-sub-row {
  display: flex;
  gap: 8px;
}

.input-sub-cute {
  font-size: 14px !important;
  padding: 6px 10px !important;
  flex: 1;
}

.btn-add-sub {
  padding: 6px 10px !important;
  font-size: 14px !important;
  background-color: var(--color-income) !important;
}

.btn-add-main-trigger {
  width: 100%;
  background-color: var(--color-accent-gold) !important;
  font-size: 14px;
}

/* 新增主分類表單 */
.add-main-cat-form {
  padding: 14px !important;
  margin-bottom: 0 !important;
  text-align: left;
}

.add-main-cat-form h4 {
  font-size: 15px;
  font-weight: 800;
  margin-bottom: 10px;
}

.margin-top-sm {
  margin-top: 10px;
}

.icon-selector-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
}

.btn-icon-select {
  padding: 6px !important;
  font-size: 14px !important;
  background-color: #FFFFFF !important;
  min-width: unset !important;
}

.btn-icon-select.active {
  background-color: var(--color-accent-gold) !important;
  box-shadow: var(--shadow-jelly-sm) !important;
  transform: translateY(-1px);
}

.add-main-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}

.btn-cancel-cat {
  flex: 1;
  font-size: 12px;
  background-color: #FFFFFF !important;
}

.btn-save-cat {
  flex: 1;
  font-size: 12px;
  background-color: var(--color-income) !important;
}

.btn-save-cat:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}

/* 過渡動畫 */
.fade-success-enter-active,
.fade-success-leave-active {
  transition: opacity 0.3s ease;
}
.fade-success-enter-from,
.fade-success-leave-to {
  opacity: 0;
}

/* 🔒 Dodo Gatekeeper 鎖定設定區塊與 Modal 樣式 */
.lock-status-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px !important;
  background-color: var(--color-bg-warm) !important;
  margin-bottom: 16px !important;
  text-align: left;
}

.lock-active-border {
  background-color: rgba(46, 176, 134, 0.08) !important;
  border-color: #2EB086 !important;
}

.status-left-lock {
  display: flex;
  align-items: flex-start;
}

.status-info {
  margin-left: 10px;
}

.status-title-text {
  font-size: 15px;
  font-weight: 800;
  margin-bottom: 2px;
}

.status-desc-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.lock-actions-row {
  width: 100%;
}

.global-lock-notice {
  background-color: #F0F4F8;
  border: 1.5px solid var(--color-border);
  color: #556B83;
  padding: 10px;
  border-radius: var(--border-radius-md);
  font-size: 13px;
  font-weight: 800;
  text-align: center;
}

.local-actions-flex {
  display: flex;
  gap: 8px;
  width: 100%;
  flex-wrap: wrap;
}

.local-actions-flex button {
  flex: 1;
  min-width: 100px;
  font-size: 12px;
}

.btn-lock-primary {
  background-color: var(--color-accent-gold) !important;
}

.btn-lock-secondary {
  background-color: #FFFFFF !important;
}

.btn-lock-danger {
  background-color: #FFF0ED !important;
  color: #FF5A5A !important;
}

.btn-lock-test {
  background-color: #EEF8F3 !important;
  color: #2EB086 !important;
}

/* Modal Overlay */
.lock-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(44, 30, 27, 0.4);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.lock-modal-card {
  width: 100%;
  max-width: 360px;
  background-color: #FFFFFF;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-large);
  padding: 20px;
  box-shadow: var(--shadow-jelly-lg);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: var(--border-width) dashed var(--color-border);
  padding-bottom: 10px;
  margin-bottom: 12px;
}

.modal-header h4 {
  font-size: 16px;
  font-weight: 800;
  margin: 0;
}

.btn-close-modal {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
}

.btn-close-modal:hover {
  background-color: var(--color-bg-warm);
}

.modal-body {
  text-align: left;
}

.modal-body-tip {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-muted);
  line-height: 1.4;
  margin-bottom: 14px;
}

.text-center {
  text-align: center;
  letter-spacing: 4px;
  font-size: 18px;
  font-weight: 800;
}

.modal-error-msg {
  background-color: #FFF0ED;
  color: #FF5A5A;
  border: 1.5px solid var(--color-border);
  border-radius: var(--border-radius-sm);
  padding: 8px;
  font-size: 12px;
  font-weight: 800;
  margin-top: 10px;
  text-align: center;
}

.modal-footer {
  display: flex;
  gap: 10px;
  margin-top: 18px;
}

/* 頭像更換 */
.avatar-current-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.avatar-current-display {
  font-size: 2.2rem;
  line-height: 1;
}

.avatar-current-name {
  font-weight: 700;
  color: var(--color-text-dark);
}

.avatar-picker-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.avatar-option {
  width: 44px;
  height: 44px;
  font-size: 1.5rem;
  border-radius: 12px !important;
  padding: 0 !important;
  display: flex !important;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-warm);
}

.avatar-option.avatar-active {
  background: var(--color-accent-gold) !important;
  transform: scale(1.1);
  border-width: 3px;
}

/* 🐾 逗逗貓超高級管理介面樣式 🐾 */
.admin-panel-container {
  border: 3px solid #D4A373 !important; /* 金黃色手繪邊框 */
  background: linear-gradient(135deg, #FFFDF9 0%, #FFF5E6 100%) !important; /* 高貴淡金黃漸層 */
  padding: 16px !important;
  margin-bottom: 24px;
  box-shadow: var(--shadow-jelly-lg) !important;
}

.admin-panel-header {
  text-align: center;
  margin-bottom: 18px;
  border-bottom: 2px dashed #D4A373;
  padding-bottom: 12px;
}

.admin-title {
  font-size: 19px;
  font-weight: 800;
  color: #8C5E3C;
}

.admin-subtitle {
  font-size: 12px;
  font-weight: 700;
  color: #B2825B;
  margin-top: 4px;
}

/* Dodo Cat 系統稽核日誌 */
.btn-refresh-logs {
  background-color: var(--color-bg-warm) !important;
  font-size: 11px !important;
  padding: 4px 8px !important;
}

.logs-spinner-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.empty-logs-hint {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-muted);
  text-align: center;
  padding: 20px;
}

.logs-scroll-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 240px;
  overflow-y: auto;
  padding-right: 4px;
  margin-top: 6px;
}

.log-item-card {
  background-color: #FFFFFF !important;
  padding: 10px 12px !important;
  margin-bottom: 0 !important;
  box-shadow: var(--shadow-jelly-sm-sm, 1px 1px 0 0 #2C1E1B) !important;
  border: 1.5px solid var(--color-border) !important;
}

.log-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.log-operator-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.log-avatar {
  font-size: 16px;
}

.log-operator-name {
  font-size: 12px;
  font-weight: 800;
  color: var(--color-text-dark);
}

.log-time {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-text-muted);
}

.log-item-body {
  display: flex;
  align-items: center;
  gap: 8px;
}

.log-action-tag {
  font-size: 9px;
  font-weight: 800;
  padding: 1px 4px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  color: var(--color-text-dark);
}

/* 日誌動作標籤馬卡龍色調配 */
.log-action-tag.create_profile,
.log-action-tag.update_categories {
  background-color: #E1F8EB; /* 綠 */
}
.log-action-tag.delete_profile,
.log-action-tag.delete_transaction {
  background-color: #FFF0ED; /* 紅 */
}
.log-action-tag.add_transaction {
  background-color: #FFF9E6; /* 黃 */
}
.log-action-tag.update_budget,
.log-action-tag.update_avatar {
  background-color: #E3EFFF; /* 藍 */
}

.log-desc {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-text-dark);
  line-height: 1.3;
  margin: 0;
}

/* 底部版本標籤樣式 */
.version-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 10px;
  margin-bottom: 10px;
  padding: 10px 0;
}

.version-item {
  font-size: 11px;
  font-weight: 800;
  color: var(--color-text-muted);
}

.version-separator {
  font-size: 11px;
  color: rgba(44, 30, 27, 0.15);
}

.web-version-trigger {
  cursor: pointer;
  background-color: var(--color-bg-warm) !important;
  border: 1px solid var(--color-border) !important;
  border-radius: 20px !important;
  padding: 2px 8px !important;
  font-size: 11px;
  box-shadow: var(--shadow-jelly-sm-sm, 1px 1px 0 0 #2C1E1B) !important;
  transition: all 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.web-version-trigger:hover {
  background-color: #FFFFFF !important;
  transform: scale(1.05);
}

.web-version-trigger:active {
  transform: scale(0.92);
  box-shadow: var(--shadow-jelly-active) !important;
}
</style>

