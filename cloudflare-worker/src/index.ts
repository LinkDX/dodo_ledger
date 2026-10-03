/**
 * 🐱 Dodo Ledger (逗逗記帳) - Cloudflare Worker 邊緣自動記帳 API
 * 
 * 核心特色：
 * 1. Zero Host / Serverless 零伺服器成本運行 (每日 100,000 次免費呼叫)
 * 2. Token-to-User 邊緣身分綁定 (防竄改記帳人、權限完全隔離)
 * 3. Firestore REST Commit 原子交易批次 (同時建立交易 + 更新帳戶餘額 + 記錄日誌)
 * 4. 智慧帳戶名稱模糊對應 (傳入「現金」自動匹配「錢包現金」)
 */

export interface Env {
  FIREBASE_PROJECT_ID: string
  FIREBASE_CLIENT_EMAIL: string
  FIREBASE_PRIVATE_KEY: string
  DODO_API_USERS: string // JSON string mapping token -> { userId, name, avatar }
}

interface UserProfileMeta {
  userId: string
  name: string
  avatar: string
}

interface FirestoreAccount {
  id: string
  name: string
  type: string
  balance: number
  currency: string
}

interface FirestoreCategory {
  id: string
  name: string
  type: string
  subCategories: string[]
}

// 記憶體快取 Google Access Token (避免每次請求重複獲取)
let cachedAccessToken: { token: string; expiresAt: number } | null = null

// ─── 1. Google OAuth2 JWT & Service Account 簽章工具 ───

/** 將 PEM 格式的 Private Key 轉為 ArrayBuffer */
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const cleanPem = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\\n/g, '')
    .replace(/\s+/g, '')
  const binary = atob(cleanPem)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

/** Base64URL 編碼 */
function base64UrlEncode(str: string): string {
  const base64 = btoa(str)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** 使用 Web Crypto API 生成 Google OAuth2 Access Token */
async function getGoogleAccessToken(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60) {
    return cachedAccessToken.token
  }

  const header = { alg: 'RS256', typ: 'JWT' }
  const claimSet = {
    iss: env.FIREBASE_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedClaim = base64UrlEncode(JSON.stringify(claimSet))
  const unsignedToken = `${encodedHeader}.${encodedClaim}`

  const keyBuffer = pemToArrayBuffer(env.FIREBASE_PRIVATE_KEY)
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const encoder = new TextEncoder()
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(unsignedToken)
  )

  const signedJwt = `${unsignedToken}.${bufferToBase64Url(signature)}`

  // 向 Google 換取 OAuth2 Access Token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt
    })
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    throw new Error(`獲取 Google Access Token 失敗: ${errText}`)
  }

  const tokenData = (await tokenRes.json()) as { access_token: string; expires_in: number }
  cachedAccessToken = {
    token: tokenData.access_token,
    expiresAt: now + (tokenData.expires_in || 3600)
  }

  return cachedAccessToken.token
}

// ─── 2. Firestore Document 轉換輔助函數 ───

function parseFirestoreValue(val: any): any {
  if (val.stringValue !== undefined) return val.stringValue
  if (val.integerValue !== undefined) return parseInt(val.integerValue, 10)
  if (val.doubleValue !== undefined) return parseFloat(val.doubleValue)
  if (val.booleanValue !== undefined) return val.booleanValue
  if (val.arrayValue !== undefined) return (val.arrayValue.values || []).map(parseFirestoreValue)
  if (val.mapValue !== undefined) {
    const res: any = {}
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      res[k] = parseFirestoreValue(v)
    }
    return res
  }
  return null
}

function parseFirestoreDoc(doc: any): any {
  const fields = doc.fields || {}
  const res: any = {}
  for (const [k, v] of Object.entries(fields)) {
    res[k] = parseFirestoreValue(v)
  }
  return res
}

function toFirestoreFields(obj: any): any {
  const fields: any = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue
    if (typeof v === 'string') fields[k] = { stringValue: v }
    else if (typeof v === 'number') {
      if (Number.isInteger(v)) fields[k] = { integerValue: v.toString() }
      else fields[k] = { doubleValue: v }
    } else if (typeof v === 'boolean') fields[k] = { booleanValue: v }
    else if (Array.isArray(v)) {
      fields[k] = { arrayValue: { values: v.map(item => toFirestoreFields({ item }).item) } }
    } else if (typeof v === 'object') {
      fields[k] = { mapValue: { fields: toFirestoreFields(v) } }
    }
  }
  return fields
}

// ─── 3. 業務資料庫查詢與事務 ───

const LEDGER_BASE_PATH = 'ledgers/dodo_shared_ledger'

async function fetchAccounts(projectId: string, token: string): Promise<FirestoreAccount[]> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${LEDGER_BASE_PATH}/accounts?pageSize=100`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return []
  const data = (await res.json()) as any
  return (data.documents || []).map((d: any) => {
    const parsed = parseFirestoreDoc(d)
    const id = d.name.split('/').pop()
    return { ...parsed, id: parsed.id || id }
  })
}

async function fetchCategories(projectId: string, token: string): Promise<FirestoreCategory[]> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${LEDGER_BASE_PATH}/categories?pageSize=100`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return []
  const data = (await res.json()) as any
  return (data.documents || []).map((d: any) => {
    const parsed = parseFirestoreDoc(d)
    const id = d.name.split('/').pop()
    return { ...parsed, id: parsed.id || id }
  })
}

// ─── 4. 使用者鑑權 (Token-to-User) ───

function authenticateUser(req: Request, env: Env): UserProfileMeta | null {
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  try {
    const usersMap: Record<string, UserProfileMeta> = JSON.parse(env.DODO_API_USERS || '{}')
    return usersMap[token] || null
  } catch (e) {
    console.error('解析 DODO_API_USERS 失敗:', e)
    return null
  }
}

// ─── 5. CORS 與 JSON 回應工具 ───

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS
    }
  })
}

// ─── 6. 主路由處理 ───

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)

    // 處理 CORS Preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    // 1. 健康檢查
    if (url.pathname === '/api/health' && req.method === 'GET') {
      return jsonResponse({ status: 'ok', timestamp: Date.now() })
    }

    // 鑑權檢查 (除 health 外所有端點皆需驗證)
    const user = authenticateUser(req, env)
    if (!user) {
      return jsonResponse(
        {
          success: false,
          error: '未授權：無效或未提供有效的 API Token。請在 Header 帶入 Authorization: Bearer <TOKEN>'
        },
        401
      )
    }

    try {
      const googleToken = await getGoogleAccessToken(env)

      // 2. 取得帳本元資料 GET /api/metadata
      if (url.pathname === '/api/metadata' && req.method === 'GET') {
        const [accounts, categories] = await Promise.all([
          fetchAccounts(env.FIREBASE_PROJECT_ID, googleToken),
          fetchCategories(env.FIREBASE_PROJECT_ID, googleToken)
        ])

        return jsonResponse({
          success: true,
          operator: user,
          data: {
            accounts: accounts.map(a => ({
              id: a.id,
              name: a.name,
              type: a.type,
              balance: a.balance || 0,
              currency: a.currency || 'TWD'
            })),
            categories: categories.map(c => ({
              id: c.id,
              name: c.name,
              type: c.type,
              subCategories: c.subCategories || []
            }))
          }
        })
      }

      // 3. 自動記帳 POST /api/transactions
      if (url.pathname === '/api/transactions' && req.method === 'POST') {
        const body: any = await req.json().catch(() => null)
        if (!body) {
          return jsonResponse({ success: false, error: '無效的 JSON 請求內容' }, 400)
        }

        const type = (body.type || 'expense').toLowerCase()
        const amount = Number(body.amount)
        if (isNaN(amount) || amount <= 0) {
          return jsonResponse({ success: false, error: '金額 amount 必須為大於 0 的數值' }, 400)
        }

        // 讀取當前帳戶做模糊匹配
        const accounts = await fetchAccounts(env.FIREBASE_PROJECT_ID, googleToken)
        if (accounts.length === 0) {
          return jsonResponse({ success: false, error: '系統中目前無可用帳戶，請先於 Dodo Ledger App 中建立帳戶' }, 400)
        }

        // 智慧帳戶匹配函數
        const matchAccount = (query?: string): FirestoreAccount | null => {
          if (!query) return null
          const q = query.trim().toLowerCase()
          // 1. 精準 ID 或完全符合名稱
          const exact = accounts.find(a => a.id === query || a.name.toLowerCase() === q)
          if (exact) return exact
          // 2. 包含名稱模糊匹配
          const partial = accounts.find(a => a.name.toLowerCase().includes(q) || q.includes(a.name.toLowerCase()))
          return partial || null
        }

        const fromAccQuery = body.account || body.fromAccountId
        const toAccQuery = body.toAccount || body.toAccountId

        const fromAcc = matchAccount(fromAccQuery)
        const toAcc = matchAccount(toAccQuery)

        // 依類型檢查帳戶有效性
        if (type === 'expense' && !fromAcc) {
          return jsonResponse({
            success: false,
            error: `找不到支出帳戶：'${fromAccQuery || ''}'。可用帳戶清單：${accounts.map(a => a.name).join('、')}`
          }, 400)
        }

        if (type === 'income' && !fromAcc && !toAcc) {
          return jsonResponse({
            success: false,
            error: `收入必須指定入帳帳戶。可用帳戶清單：${accounts.map(a => a.name).join('、')}`
          }, 400)
        }

        if (type === 'transfer' && (!fromAcc || !toAcc)) {
          return jsonResponse({
            success: false,
            error: '轉帳操作必須同時提供來源帳戶 (account) 與目的帳戶 (toAccount)'
          }, 400)
        }

        // 決定主要關聯帳戶
        const primaryAcc = (type === 'income' ? (toAcc || fromAcc) : fromAcc)!
        const targetToAcc = type === 'transfer' ? toAcc : (type === 'income' ? primaryAcc : undefined)
        const targetFromAcc = type === 'transfer' ? fromAcc : (type === 'expense' ? primaryAcc : undefined)

        // 產生時間戳記與 ID
        const dateNum = body.date
          ? (typeof body.date === 'string' ? new Date(body.date).getTime() : Number(body.date))
          : Date.now()
        const now = Date.now()
        const txId = `tx_${now}_${Math.random().toString(36).substring(2, 7)}`
        const logId = `log_${now}_${Math.random().toString(36).substring(2, 7)}`

        // 建立交易物件
        const fee = Number(body.fee) || 0
        const txData: any = {
          id: txId,
          type,
          amount,
          fee: fee > 0 ? fee : undefined,
          category: body.category || (type === 'income' ? '其他收入' : '其他支出'),
          subCategory: body.subCategory || '',
          fromAccountId: targetFromAcc?.id || undefined,
          toAccountId: targetToAcc?.id || undefined,
          date: isNaN(dateNum) ? now : dateNum,
          note: body.note || '',
          tags: Array.isArray(body.tags) ? body.tags : [],
          createdBy: user.name,
          createdByAvatar: user.avatar,
          updatedAt: now
        }

        // 組裝 Firestore Commit 批次操作 (保證原子性)
        const docRoot = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`
        const writes: any[] = []

        // 1. 寫入交易紀錄
        writes.push({
          update: {
            name: `${docRoot}/${LEDGER_BASE_PATH}/transactions/${txId}`,
            fields: toFirestoreFields(txData)
          }
        })

        // 2. 帳戶餘額更新 (Transform increment)
        if (type === 'expense' && targetFromAcc) {
          writes.push({
            transform: {
              document: `${docRoot}/${LEDGER_BASE_PATH}/accounts/${targetFromAcc.id}`,
              fieldTransforms: [
                {
                  fieldPath: 'balance',
                  increment: { doubleValue: -amount }
                },
                {
                  fieldPath: 'updatedAt',
                  setToServerValue: 'REQUEST_TIME'
                }
              ]
            }
          })
        } else if (type === 'income' && targetToAcc) {
          writes.push({
            transform: {
              document: `${docRoot}/${LEDGER_BASE_PATH}/accounts/${targetToAcc.id}`,
              fieldTransforms: [
                {
                  fieldPath: 'balance',
                  increment: { doubleValue: amount }
                },
                {
                  fieldPath: 'updatedAt',
                  setToServerValue: 'REQUEST_TIME'
                }
              ]
            }
          })
        } else if (type === 'transfer' && targetFromAcc && targetToAcc) {
          // 來源帳戶扣除 (金額 + 手續費)
          writes.push({
            transform: {
              document: `${docRoot}/${LEDGER_BASE_PATH}/accounts/${targetFromAcc.id}`,
              fieldTransforms: [
                {
                  fieldPath: 'balance',
                  increment: { doubleValue: -(amount + fee) }
                },
                {
                  fieldPath: 'updatedAt',
                  setToServerValue: 'REQUEST_TIME'
                }
              ]
            }
          })
          // 目的帳戶增加 (金額)
          writes.push({
            transform: {
              document: `${docRoot}/${LEDGER_BASE_PATH}/accounts/${targetToAcc.id}`,
              fieldTransforms: [
                {
                  fieldPath: 'balance',
                  increment: { doubleValue: amount }
                },
                {
                  fieldPath: 'updatedAt',
                  setToServerValue: 'REQUEST_TIME'
                }
              ]
            }
          })
        }

        // 3. 寫入操作稽核日誌
        const logData = {
          id: logId,
          operator: user.name,
          operatorAvatar: user.avatar,
          action: '自動 API 記帳',
          description: `[${user.name}] 透過 API 新增 ${type === 'expense' ? '支出' : type === 'income' ? '收入' : '轉帳'} $${amount} (${txData.category} - ${txData.note || primaryAcc.name})`,
          date: now
        }
        writes.push({
          update: {
            name: `${docRoot}/${LEDGER_BASE_PATH}/logs/${logId}`,
            fields: toFirestoreFields(logData)
          }
        })

        // 發動 Firestore REST Commit 批次寫入
        const commitRes = await fetch(
          `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:commit`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${googleToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ writes })
          }
        )

        if (!commitRes.ok) {
          const errText = await commitRes.text()
          throw new Error(`Firestore 原子寫入失敗: ${errText}`)
        }

        // 計算更新後帳面預估餘額
        const balanceDelta = type === 'expense' ? -amount : (type === 'income' ? amount : -(amount + fee))
        const estimatedNewBalance = (primaryAcc.balance || 0) + balanceDelta

        return jsonResponse({
          success: true,
          data: {
            transactionId: txId,
            type,
            amount,
            category: txData.category,
            subCategory: txData.subCategory,
            accountName: primaryAcc.name,
            newBalance: estimatedNewBalance,
            note: txData.note,
            operator: user.name,
            date: txData.date
          }
        })
      }

      return jsonResponse({ success: false, error: '找不到請求的 API 端點' }, 404)
    } catch (err: any) {
      console.error('API 執行異常:', err)
      return jsonResponse(
        {
          success: false,
          error: err.message || '伺服器內部發生未預期錯誤'
        },
        500
      )
    }
  }
}
