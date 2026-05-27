import { ref } from 'vue'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'

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
      
      // 1. 向 GitHub Pages 自建託管端請求最新版本號 (設定 no-store 防緩存)
      const res = await fetch('https://linkdx.github.io/dodo_ledger/version.json', {
        cache: 'no-store'
      })
      
      if (!res.ok) {
        console.warn(`[LiveUpdate] 無法獲取 version.json (HTTP ${res.status})，略過更新。`)
        return
      }
      
      const remote = await res.json()
      
      // 2. 取得目前手機內已啟用的版本號，預設為 100
      const localVersion = parseInt(localStorage.getItem(HOT_VERSION_KEY) || '100', 10)
      
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
      // 離線斷網、飛航模式或伺服器斷線時，fetch 拋出 Error，在此自動優雅降級，絕不卡頓 App
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
      
      // A. 下載靜態更新包 (使用原生 fetch 確保繞過 CORS 與處理大型檔案)
      // 注意：在 Capacitor 6 中且已啟動 CapacitorHttp 插件時，fetch 會自動被 patched 使用原生請求
      const response = await fetch(downloadUrl)
      if (!response.ok) {
        throw new Error(`下載失敗 (HTTP ${response.status})`)
      }
      
      const blob = await response.blob()
      console.log(`[LiveUpdate] ✅ 更新包下載完成，大小: ${blob.size} bytes`)
      updateProgress.value = 50
      
      // B. 轉換為 Base64 (Capacitor Filesystem 規範)
      console.log('[LiveUpdate] 🔄 正在進行 Base64 編碼與沙盒寫入...')
      const reader = new FileReader()
      const base64DataPromise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64String = reader.result as string
          if (!base64String) {
            reject(new Error('Base64 編碼失敗'))
            return
          }
          resolve(base64String.split(',')[1]) // 移除 Data URL 前綴
        }
        reader.onerror = () => reject(new Error('讀取 Blob 失敗'))
        reader.readAsDataURL(blob)
      })
      
      const base64Data = await base64DataPromise
      updateProgress.value = 80
      
      // C. 寫入手機私有安全沙盒
      const zipFileName = `update_pack_${newVersionCode}.zip`
      console.log(`[LiveUpdate] 💾 正在寫入沙盒檔案: ${zipFileName}`)
      
      await Filesystem.writeFile({
        path: zipFileName,
        data: base64Data,
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
      // 發生錯誤時重設進度，避免卡在 10%
      updateProgress.value = 0
    }
  }

  return {
    isChecking,
    updateProgress,
    hasUpdate,
    newReleaseNote,
    updateError,
    checkForUpdates
  }
}

