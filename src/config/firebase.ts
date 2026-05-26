// 🐱 Dodo Ledger - Firebase 專案內置設定檔
// 為了避免在網頁介面上手動輸入敏感連線資料，我們將 Firebase 設定預置於此。
// 
// [使用提示]：
// 您可以直接在此處填寫您的真實 Firebase 設定，或者在環境變數 (.env) 中定義整個 JSON：
// VITE_FIREBASE_CONFIG={"apiKey":"xxx", "projectId":"xxx", ...}

const getFirebaseConfig = () => {
  const jsonConfig = import.meta.env.VITE_FIREBASE_CONFIG
  if (jsonConfig) {
    try {
      return JSON.parse(jsonConfig)
    } catch (e) {
      console.error('[Dodo Ledger] 解析 VITE_FIREBASE_CONFIG JSON 失敗：', e)
    }
  }
  
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyFakeKeyForDodoLedgerProjectInner2026',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'dodo-ledger-shared-prod',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'dodo-ledger-shared-prod.firebaseapp.com',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
  }
}

export const FIREBASE_CONFIG = getFirebaseConfig()
