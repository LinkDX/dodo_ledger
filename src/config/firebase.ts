// 🐱 Dodo Ledger - Firebase 專案內置設定檔
// 為了避免在網頁介面上手動輸入敏感連線資料，我們將 Firebase 設定預置於此。
// 
// [使用提示]：
// 您可以直接在此處填寫您的真實 Firebase 設定，或者在環境變數 (.env) 中定義：
// VITE_FIREBASE_API_KEY=xxx
// VITE_FIREBASE_PROJECT_ID=xxx
// VITE_FIREBASE_AUTH_DOMAIN=xxx

export const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyFakeKeyForDodoLedgerProjectInner2026',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'dodo-ledger-shared-prod',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'dodo-ledger-shared-prod.firebaseapp.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
}
