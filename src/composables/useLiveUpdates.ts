import { ref } from 'vue'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'

const HOT_VERSION_KEY = 'dodo_app_hot_version_code'

export function useLiveUpdates() {
  const isChecking = ref(false)
  const updateProgress = ref(0)
  const hasUpdate = ref(false)
  const newReleaseNote = ref('')

  /**
   * 🔍 檢查是否有新版本並自動在背景默默升級 (離線保護)
   */
  const checkForUpdates = async () => {
    if (!Capacitor.isNativePlatform()) return
    
    try {
      isChecking.value = true
      
      // 1. 向 GitHub Pages 自建託管端請求最新版本號 (設定 no-store 防緩存)
      const res = await fetch('https://linkdx.github.io/dodo_ledger/version.json', {
        cache: 'no-store'
      })
      if (!res.ok) return
      
      const remote = await res.json()
      
      // 2. 取得目前手機內已啟用的版本號，預設為 100
      const localVersion = parseInt(localStorage.getItem(HOT_VERSION_KEY) || '100', 10)
      
      // 3. 若雲端版本大於本機版本，啟動背景雙緩衝下載
      if (remote.versionCode > localVersion) {
        hasUpdate.value = true
        newReleaseNote.value = remote.releaseNote || ''
        
        console.log(`[LiveUpdate] 🐱 發現新版 ${remote.versionName}！啟動背景無感下載...`)
        await downloadAndApplyUpdate(remote.downloadUrl, remote.versionCode)
      }
    } catch (e) {
      // 離線斷網、飛航模式或伺服器斷線時，fetch 拋出 Error，在此自動優雅降級，絕不卡頓 App
      console.log('[LiveUpdate] 離線中或無法連線至熱更新伺服器，自動降級為使用本地最新快取版。')
    } finally {
      isChecking.value = false
    }
  }

  /**
   * 📥 背景無感下載與沙盒寫入
   */
  const downloadAndApplyUpdate = async (downloadUrl: string, newVersionCode: number) => {
    try {
      updateProgress.value = 10
      
      // A. 下載靜態更新包
      const response = await fetch(downloadUrl)
      if (!response.ok) throw new Error('Failed to download zip')
      
      const blob = await response.blob()
      updateProgress.value = 50
      
      // B. 轉換為 Base64 (Capacitor Filesystem 規範)
      const reader = new FileReader()
      const base64DataPromise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64String = reader.result as string
          resolve(base64String.split(',')[1]) // 移除 Data URL 前綴
        }
        reader.readAsDataURL(blob)
      })
      
      const base64Data = await base64DataPromise
      updateProgress.value = 80
      
      // C. 寫入手機私有安全沙盒
      const zipFileName = `update_pack_${newVersionCode}.zip`
      await Filesystem.writeFile({
        path: zipFileName,
        data: base64Data,
        directory: Directory.Data
      })
      
      // D. 更新本地版本指標。下一次開啟 App 時，Webview 就會自動套用新版。
      localStorage.setItem(HOT_VERSION_KEY, newVersionCode.toString())
      updateProgress.value = 100
      
      console.log(`[LiveUpdate] ✨ 新版本 ${newVersionCode} 打包完成！將於重啟 App 後啟用。`)
    } catch (e) {
      console.error('[LiveUpdate] 背景下載更新包失敗：', e)
    }
  }

  return {
    isChecking,
    updateProgress,
    hasUpdate,
    newReleaseNote,
    checkForUpdates
  }
}
