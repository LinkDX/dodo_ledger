import { ref } from 'vue'
import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import pkg from '../../package.json'

const HOT_VERSION_KEY = 'dodo_app_hot_version_code'

export function useLiveUpdates() {
  const isChecking = ref(false)
  const updateProgress = ref(0)
  const hasUpdate = ref(false)
  const newReleaseNote = ref('')
  const updateError = ref<string | null>(null)

  /**
   * 🔍 檢查是否有新版本並自動在背景默默升級 (離線保護)
   */
  const checkForUpdates = async () => {
    if (!Capacitor.isNativePlatform()) return
    
    try {
      isChecking.value = true
      updateError.value = null
      
      console.log('[LiveUpdate] 🔍 正在與 GitHub Pages 進行版本對帳...')
      
      // 1. 向 GitHub Pages 自建託管端請求最新版本號 (使用 CapacitorHttp 繞過 CORS)
      const options = {
        url: 'https://linkdx.github.io/dodo_ledger/version.json',
        headers: { 'Cache-Control': 'no-cache' }
      }
      
      const response = await CapacitorHttp.get(options)
      
      if (response.status !== 200) {
        console.warn(`[LiveUpdate] 無法獲取 version.json (HTTP ${response.status})，略過更新。`)
        return
      }
      
      const remote = response.data
      
      // 2. 取得目前手機內已啟用的版本號，預設為 100
      let localVersion = parseInt(localStorage.getItem(HOT_VERSION_KEY) || '100', 10)
      
      // 💡 雙重保險：若目前程式碼內建的版本比 localStorage 裡的紀錄還要新，說明是剛升級的 APK 內置資源，自動升級 localStorage 紀錄
      const parts = pkg.version.split('.')
      const major = parseInt(parts[0] || '1', 10)
      const minor = parseInt(parts[1] || '0', 10)
      const patch = parseInt(parts[2] || '0', 10)
      const builtInVersionCode = major * 10000 + minor * 100 + patch
      
      if (builtInVersionCode > localVersion) {
        console.log(`[LiveUpdate] 💡 偵測到內置網頁版本 (${builtInVersionCode}) 新於熱更新紀錄 (${localVersion})，自動升級 localStorage 紀錄。`)
        localStorage.setItem(HOT_VERSION_KEY, builtInVersionCode.toString())
        localVersion = builtInVersionCode
      }
      
      console.log(`[LiveUpdate] 雲端版本: ${remote.versionCode}, 本地版本: ${localVersion}`)
      
      // 3. 若雲端版本大於本機版本，啟動背景雙緩衝下載
      if (remote.versionCode > localVersion) {
        hasUpdate.value = true
        newReleaseNote.value = remote.releaseNote || ''
        
        console.log(`[LiveUpdate] 🐱 發現新版 ${remote.versionName} (Code ${remote.versionCode})！啟動背景無感下載...`)
        await downloadAndApplyUpdate(remote.downloadUrl, remote.versionCode)
      } else {
        console.log('[LiveUpdate] 🐱 目前已是最新網頁版本。')
      }
    } catch (e: any) {
      console.error('[LiveUpdate] 檢查更新時發生錯誤：', e)
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
      updateError.value = null
      
      console.log(`[LiveUpdate] 📥 開始下載更新包：${downloadUrl}`)
      
      // A. 下載靜態更新包 (使用 CapacitorHttp 原生下載，繞過 CORS 且不影響全域 fetch)
      const options = {
        url: downloadUrl,
        responseType: 'blob' as const
      }
      
      const response = await CapacitorHttp.get(options)
      if (response.status !== 200) {
        throw new Error(`下載失敗 (HTTP ${response.status})`)
      }
      
      // Capacitor 處理 blob responseType 時會將其轉換為 base64 string
      const base64Data = response.data
      console.log(`[LiveUpdate] ✅ 更新包下載完成 (Base64 格式)`)
      updateProgress.value = 50
      
      // 確保它是乾淨的 base64 (移除 Data URL 前綴)
      const finalBase64 = typeof base64Data === 'string' && base64Data.includes('base64,') 
        ? base64Data.split('base64,')[1] 
        : base64Data
      
      updateProgress.value = 80
      
      // C. 寫入手機私有安全沙盒
      const zipFileName = `update_pack_${newVersionCode}.zip`
      console.log(`[LiveUpdate] 💾 正在寫入沙盒檔案: ${zipFileName}`)
      
      await Filesystem.writeFile({
        path: zipFileName,
        data: finalBase64,
        directory: Directory.Data
      })

      // C2. 寫入實體版本指標文字檔，供原生 Android (MainActivity.java) 啟動時作為解壓與載入的依據
      await Filesystem.writeFile({
        path: 'current_hot_version.txt',
        data: newVersionCode.toString(),
        directory: Directory.Data,
        encoding: Encoding.UTF8
      })
      
      // D. 更新本地版本指標。下一次開啟 App 時，Webview 就會自動套用新版。
      localStorage.setItem(HOT_VERSION_KEY, newVersionCode.toString())
      updateProgress.value = 100
      
      console.log(`[LiveUpdate] ✨ 新版本 ${newVersionCode} 下載完成並已布署至沙盒！將於重啟 App 後啟用。🐾`)
    } catch (e: any) {
      console.error('[LiveUpdate] 背景下載更新包失敗：', e)
      updateError.value = e.message || '下載失敗'
      updateProgress.value = 0
    }
  }

  /**
   * 🚀 立即套用熱更新（App 內即時重載）
   */
  const performImmediateReload = async (newVersionCode: number) => {
    if (!Capacitor.isNativePlatform()) return
    try {
      console.log(`[LiveUpdate] 🚀 請求原生端執行熱重載，目標版本: ${newVersionCode}`)
      
      // 動態載入自訂原生插件 DodoInstaller
      // @ts-ignore
      const { registerPlugin } = await import('@capacitor/core')
      const DodoInstaller = registerPlugin<any>('DodoInstaller')
      
      await DodoInstaller.performHotReload({ versionCode: newVersionCode.toString() })
      console.log('[LiveUpdate] ✅ 原生端熱重載已完成')
    } catch (e) {
      console.error('[LiveUpdate] 原生端熱重載失敗：', e)
      updateError.value = '無法立即重新載入，請手動重啟 App。'
    }
  }

  return {
    isChecking,
    updateProgress,
    hasUpdate,
    newReleaseNote,
    updateError,
    checkForUpdates,
    performImmediateReload
  }
}
