/**
 * 🐱 Dodo Ledger (逗逗記帳) - Cloudflare Worker 邊緣自動記帳 API
 * 
 * 核心特色：
 * 1. Zero Host / Serverless 零伺服器成本運行 (每日 100,000 次免費呼叫)
 * 2. Token-to-User 邊緣身分綁定 (防竄改記帳人、權限完全隔離)
 * 3. 完整 CRUD 與對帳支援：
 *    - GET /api/metadata (查詢帳戶與分類)
 *    - GET /api/transactions (調閱交易明細，支援帳戶/日期過濾)
 *    - POST /api/transactions (建立記帳交易，原子連動餘額)
 *    - PATCH /api/transactions/:id (更正交易，原子 delta 計算補差額)
 *    - DELETE /api/transactions/:id (刪除錯誤交易，原子原路回退餘額)
 * 4. 智慧帳戶名稱模糊對應 (傳入「現金」自動匹配「倫現金」)
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

interface FirestoreTransaction {
  id: string
  type: 'expense' | 'income' | 'transfer'
  amount: number
  fee?: number
  category: string
  subCategory?: string
  fromAccountId?: string
  toAccountId?: string
  date: number
  note: string
  tags?: string[]
  createdBy?: string
  createdByAvatar?: string
  updatedAt?: number
}

// 記憶體快取 Google Access Token (避免每次請求重複獲取)
let cachedAccessToken: { token: string; expiresAt: number } | null = null

// ─── 1. Google OAuth2 JWT & Service Account 簽章工具 ───

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

// ─── 2. Firestore Document 轉換工具 ───

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

// ─── 3. Firestore 集合與文件讀取 ───

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

async function fetchTransactions(projectId: string, token: string, limit = 50): Promise<FirestoreTransaction[]> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${LEDGER_BASE_PATH}/transactions?pageSize=${Math.min(limit, 100)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return []
  const data = (await res.json()) as any
  return (data.documents || []).map((d: any) => {
    const parsed = parseFirestoreDoc(d)
    const id = d.name.split('/').pop()
    return { ...parsed, id: parsed.id || id }
  })
}

async function fetchSingleTransaction(projectId: string, token: string, txId: string): Promise<FirestoreTransaction | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${LEDGER_BASE_PATH}/transactions/${txId}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return null
  const data = (await res.json()) as any
  const parsed = parseFirestoreDoc(data)
  return { ...parsed, id: parsed.id || txId }
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
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
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
      const docRoot = `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents`

      // ─── 2. 取得帳本元資料 GET /api/metadata ───
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

      // ─── 3. 調閱歷史明細 (對帳專用) GET /api/transactions ───
      if (url.pathname === '/api/transactions' && req.method === 'GET') {
        const limitParam = parseInt(url.searchParams.get('limit') || '30', 10)
        const accountQuery = url.searchParams.get('account') || url.searchParams.get('accountId')
        const typeQuery = url.searchParams.get('type')
        const startDateQuery = url.searchParams.get('startDate')
        const endDateQuery = url.searchParams.get('endDate')

        const [accounts, rawTxs] = await Promise.all([
          fetchAccounts(env.FIREBASE_PROJECT_ID, googleToken),
          fetchTransactions(env.FIREBASE_PROJECT_ID, googleToken, 100)
        ])

        const accountMap = new Map(accounts.map(a => [a.id, a]))

        // 依條件過濾
        let txs = rawTxs

        if (accountQuery) {
          const q = accountQuery.trim().toLowerCase()
          const matchedAcc = accounts.find(a => a.id === accountQuery || a.name.toLowerCase().includes(q))
          if (matchedAcc) {
            txs = txs.filter(t => t.fromAccountId === matchedAcc.id || t.toAccountId === matchedAcc.id)
          }
        }

        if (typeQuery) {
          txs = txs.filter(t => t.type === typeQuery)
        }

        if (startDateQuery) {
          const startTime = new Date(startDateQuery).getTime()
          if (!isNaN(startTime)) txs = txs.filter(t => t.date >= startTime)
        }

        if (endDateQuery) {
          const endTime = new Date(endDateQuery).getTime()
          if (!isNaN(endTime)) txs = txs.filter(t => t.date <= endTime)
        }

        // 依日期降冪排列 (最新在前)
        txs.sort((a, b) => b.date - a.date)
        const limitedTxs = txs.slice(0, limitParam)

        return jsonResponse({
          success: true,
          operator: user,
          total: txs.length,
          count: limitedTxs.length,
          data: limitedTxs.map(t => ({
            id: t.id,
            type: t.type,
            amount: t.amount,
            fee: t.fee,
            category: t.category,
            subCategory: t.subCategory,
            accountName: (t.fromAccountId && accountMap.get(t.fromAccountId)?.name) || (t.toAccountId && accountMap.get(t.toAccountId)?.name) || '未知帳戶',
            fromAccount: t.fromAccountId ? accountMap.get(t.fromAccountId)?.name : undefined,
            toAccount: t.toAccountId ? accountMap.get(t.toAccountId)?.name : undefined,
            date: t.date,
            dateStr: new Date(t.date).toISOString().replace('T', ' ').substring(0, 19),
            note: t.note,
            createdBy: t.createdBy,
            tags: t.tags || []
          }))
        })
      }

      // ─── 4. 新增記帳交易 POST /api/transactions ───
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

        const accounts = await fetchAccounts(env.FIREBASE_PROJECT_ID, googleToken)
        if (accounts.length === 0) {
          return jsonResponse({ success: false, error: '系統中目前無可用帳戶，請先於 Dodo Ledger App 中建立帳戶' }, 400)
        }

        const matchAccount = (query?: string): FirestoreAccount | null => {
          if (!query) return null
          const q = query.trim().toLowerCase()
          const exact = accounts.find(a => a.id === query || a.name.toLowerCase() === q)
          if (exact) return exact
          const partial = accounts.find(a => a.name.toLowerCase().includes(q) || q.includes(a.name.toLowerCase()))
          return partial || null
        }

        const fromAccQuery = body.account || body.fromAccountId
        const toAccQuery = body.toAccount || body.toAccountId

        const fromAcc = matchAccount(fromAccQuery)
        const toAcc = matchAccount(toAccQuery)

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

        const primaryAcc = (type === 'income' ? (toAcc || fromAcc) : fromAcc)!
        const targetToAcc = type === 'transfer' ? toAcc : (type === 'income' ? primaryAcc : undefined)
        const targetFromAcc = type === 'transfer' ? fromAcc : (type === 'expense' ? primaryAcc : undefined)

        const dateNum = body.date
          ? (typeof body.date === 'string' ? new Date(body.date).getTime() : Number(body.date))
          : Date.now()
        const now = Date.now()
        const txId = `tx_${now}_${Math.random().toString(36).substring(2, 7)}`
        const logId = `log_${now}_${Math.random().toString(36).substring(2, 7)}`

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

        const writes: any[] = []

        // 1. 寫入交易紀錄
        writes.push({
          update: {
            name: `${docRoot}/${LEDGER_BASE_PATH}/transactions/${txId}`,
            fields: toFirestoreFields(txData)
          }
        })

        // 2. 帳戶餘額更新
        if (type === 'expense' && targetFromAcc) {
          writes.push({
            transform: {
              document: `${docRoot}/${LEDGER_BASE_PATH}/accounts/${targetFromAcc.id}`,
              fieldTransforms: [
                { fieldPath: 'balance', increment: { doubleValue: -amount } },
                { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }
              ]
            }
          })
        } else if (type === 'income' && targetToAcc) {
          writes.push({
            transform: {
              document: `${docRoot}/${LEDGER_BASE_PATH}/accounts/${targetToAcc.id}`,
              fieldTransforms: [
                { fieldPath: 'balance', increment: { doubleValue: amount } },
                { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }
              ]
            }
          })
        } else if (type === 'transfer' && targetFromAcc && targetToAcc) {
          writes.push({
            transform: {
              document: `${docRoot}/${LEDGER_BASE_PATH}/accounts/${targetFromAcc.id}`,
              fieldTransforms: [
                { fieldPath: 'balance', increment: { doubleValue: -(amount + fee) } },
                { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }
              ]
            }
          })
          writes.push({
            transform: {
              document: `${docRoot}/${LEDGER_BASE_PATH}/accounts/${targetToAcc.id}`,
              fieldTransforms: [
                { fieldPath: 'balance', increment: { doubleValue: amount } },
                { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }
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

        const commitRes = await fetch(
          `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:commit`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ writes })
          }
        )

        if (!commitRes.ok) {
          const errText = await commitRes.text()
          throw new Error(`Firestore 原子寫入失敗: ${errText}`)
        }

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

      // ─── 5. 修改特定記帳交易 (改錯對帳) PATCH /api/transactions/:id ───
      const matchPatch = url.pathname.match(/^\/api\/transactions\/([^/]+)$/)
      if (matchPatch && req.method === 'PATCH') {
        const txId = matchPatch[1]
        const oldTx = await fetchSingleTransaction(env.FIREBASE_PROJECT_ID, googleToken, txId)
        if (!oldTx) {
          return jsonResponse({ success: false, error: `找不到交易 ID：'${txId}'` }, 404)
        }

        const body: any = await req.json().catch(() => null)
        if (!body) {
          return jsonResponse({ success: false, error: '無效的 JSON 請求內容' }, 400)
        }

        const accounts = await fetchAccounts(env.FIREBASE_PROJECT_ID, googleToken)
        const matchAccount = (query?: string): FirestoreAccount | null => {
          if (!query) return null
          const q = query.trim().toLowerCase()
          return accounts.find(a => a.id === query || a.name.toLowerCase().includes(q)) || null
        }

        const newAmount = body.amount !== undefined ? Number(body.amount) : oldTx.amount
        if (isNaN(newAmount) || newAmount <= 0) {
          return jsonResponse({ success: false, error: '金額 amount 必須為大於 0 的數值' }, 400)
        }

        // 檢查帳戶是否有變更
        const targetFromAcc = body.account ? matchAccount(body.account) : (oldTx.fromAccountId ? accounts.find(a => a.id === oldTx.fromAccountId) : null)
        const targetToAcc = body.toAccount ? matchAccount(body.toAccount) : (oldTx.toAccountId ? accounts.find(a => a.id === oldTx.toAccountId) : null)

        const now = Date.now()
        const logId = `log_${now}_${Math.random().toString(36).substring(2, 7)}`

        // 準備更新資料
        const updatedFields: any = {
          amount: newAmount,
          category: body.category !== undefined ? body.category : oldTx.category,
          subCategory: body.subCategory !== undefined ? body.subCategory : oldTx.subCategory,
          note: body.note !== undefined ? body.note : oldTx.note,
          updatedAt: now
        }
        if (body.account && targetFromAcc) updatedFields.fromAccountId = targetFromAcc.id
        if (body.toAccount && targetToAcc) updatedFields.toAccountId = targetToAcc.id
        if (body.date) {
          const dateNum = typeof body.date === 'string' ? new Date(body.date).getTime() : Number(body.date)
          if (!isNaN(dateNum)) updatedFields.date = dateNum
        }

        const writes: any[] = []

        // 1. 更新交易記錄 (Merge)
        writes.push({
          update: {
            name: `${docRoot}/${LEDGER_BASE_PATH}/transactions/${txId}`,
            fields: toFirestoreFields(updatedFields)
          },
          updateMask: { fieldPaths: Object.keys(updatedFields) }
        })

        // 2. 帳戶餘額原子差值更新 (Delta adjustment)
        if (oldTx.type === 'expense') {
          const oldAccId = oldTx.fromAccountId
          const newAccId = targetFromAcc?.id || oldAccId

          if (oldAccId === newAccId) {
            // 同帳戶：delta = newAmount - oldAmount，餘額需 increment(-delta)
            const delta = newAmount - oldTx.amount
            if (delta !== 0 && oldAccId) {
              writes.push({
                transform: {
                  document: `${docRoot}/${LEDGER_BASE_PATH}/accounts/${oldAccId}`,
                  fieldTransforms: [
                    { fieldPath: 'balance', increment: { doubleValue: -delta } },
                    { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }
                  ]
                }
              })
            }
          } else {
            // 換帳戶：舊帳戶加回舊金額，新帳戶扣除新金額
            if (oldAccId) {
              writes.push({
                transform: {
                  document: `${docRoot}/${LEDGER_BASE_PATH}/accounts/${oldAccId}`,
                  fieldTransforms: [
                    { fieldPath: 'balance', increment: { doubleValue: oldTx.amount } },
                    { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }
                  ]
                }
              })
            }
            if (newAccId) {
              writes.push({
                transform: {
                  document: `${docRoot}/${LEDGER_BASE_PATH}/accounts/${newAccId}`,
                  fieldTransforms: [
                    { fieldPath: 'balance', increment: { doubleValue: -newAmount } },
                    { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }
                  ]
                }
              })
            }
          }
        } else if (oldTx.type === 'income') {
          const oldAccId = oldTx.toAccountId || oldTx.fromAccountId
          const newAccId = targetToAcc?.id || targetFromAcc?.id || oldAccId

          if (oldAccId === newAccId) {
            const delta = newAmount - oldTx.amount
            if (delta !== 0 && oldAccId) {
              writes.push({
                transform: {
                  document: `${docRoot}/${LEDGER_BASE_PATH}/accounts/${oldAccId}`,
                  fieldTransforms: [
                    { fieldPath: 'balance', increment: { doubleValue: delta } },
                    { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }
                  ]
                }
              })
            }
          } else {
            if (oldAccId) {
              writes.push({
                transform: {
                  document: `${docRoot}/${LEDGER_BASE_PATH}/accounts/${oldAccId}`,
                  fieldTransforms: [
                    { fieldPath: 'balance', increment: { doubleValue: -oldTx.amount } },
                    { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }
                  ]
                }
              })
            }
            if (newAccId) {
              writes.push({
                transform: {
                  document: `${docRoot}/${LEDGER_BASE_PATH}/accounts/${newAccId}`,
                  fieldTransforms: [
                    { fieldPath: 'balance', increment: { doubleValue: newAmount } },
                    { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }
                  ]
                }
              })
            }
          }
        }

        // 3. 追加 SystemLog
        const logData = {
          id: logId,
          operator: user.name,
          operatorAvatar: user.avatar,
          action: 'API 修正交易',
          description: `[${user.name}] 修正交易 ID: ${txId} (${oldTx.amount} -> ${newAmount})`,
          date: now
        }
        writes.push({
          update: {
            name: `${docRoot}/${LEDGER_BASE_PATH}/logs/${logId}`,
            fields: toFirestoreFields(logData)
          }
        })

        const commitRes = await fetch(
          `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:commit`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ writes })
          }
        )

        if (!commitRes.ok) {
          const errText = await commitRes.text()
          throw new Error(`Firestore 原子修正失敗: ${errText}`)
        }

        return jsonResponse({
          success: true,
          message: '交易修正成功',
          data: {
            id: txId,
            oldAmount: oldTx.amount,
            newAmount,
            category: updatedFields.category,
            note: updatedFields.note,
            operator: user.name
          }
        })
      }

      // ─── 6. 刪除錯誤交易 (原子回退餘額) DELETE /api/transactions/:id ───
      const matchDelete = url.pathname.match(/^\/api\/transactions\/([^/]+)$/)
      if (matchDelete && req.method === 'DELETE') {
        const txId = matchDelete[1]
        const oldTx = await fetchSingleTransaction(env.FIREBASE_PROJECT_ID, googleToken, txId)
        if (!oldTx) {
          return jsonResponse({ success: false, error: `找不到交易 ID：'${txId}'` }, 404)
        }

        const now = Date.now()
        const logId = `log_${now}_${Math.random().toString(36).substring(2, 7)}`
        const writes: any[] = []

        // 1. 刪除交易文件
        writes.push({
          delete: `${docRoot}/${LEDGER_BASE_PATH}/transactions/${txId}`
        })

        // 2. 原路回退餘額
        if (oldTx.type === 'expense' && oldTx.fromAccountId) {
          // 支出刪除：加回扣除的金額
          writes.push({
            transform: {
              document: `${docRoot}/${LEDGER_BASE_PATH}/accounts/${oldTx.fromAccountId}`,
              fieldTransforms: [
                { fieldPath: 'balance', increment: { doubleValue: oldTx.amount } },
                { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }
              ]
            }
          })
        } else if (oldTx.type === 'income') {
          // 收入刪除：扣除加進去的金額
          const accId = oldTx.toAccountId || oldTx.fromAccountId
          if (accId) {
            writes.push({
              transform: {
                document: `${docRoot}/${LEDGER_BASE_PATH}/accounts/${accId}`,
                fieldTransforms: [
                  { fieldPath: 'balance', increment: { doubleValue: -oldTx.amount } },
                  { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }
                ]
              }
            })
          }
        } else if (oldTx.type === 'transfer' && oldTx.fromAccountId && oldTx.toAccountId) {
          // 轉帳刪除：來源帳戶加回 (金額 + 手續費)，目的帳戶扣減金額
          const fee = oldTx.fee || 0
          writes.push({
            transform: {
              document: `${docRoot}/${LEDGER_BASE_PATH}/accounts/${oldTx.fromAccountId}`,
              fieldTransforms: [
                { fieldPath: 'balance', increment: { doubleValue: oldTx.amount + fee } },
                { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }
              ]
            }
          })
          writes.push({
            transform: {
              document: `${docRoot}/${LEDGER_BASE_PATH}/accounts/${oldTx.toAccountId}`,
              fieldTransforms: [
                { fieldPath: 'balance', increment: { doubleValue: -oldTx.amount } },
                { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }
              ]
            }
          })
        }

        // 3. 追加操作日誌
        const logData = {
          id: logId,
          operator: user.name,
          operatorAvatar: user.avatar,
          action: 'API 刪除交易',
          description: `[${user.name}] 刪除交易 ID: ${txId} (${oldTx.type} $${oldTx.amount}，餘額已原路退回)`,
          date: now
        }
        writes.push({
          update: {
            name: `${docRoot}/${LEDGER_BASE_PATH}/logs/${logId}`,
            fields: toFirestoreFields(logData)
          }
        })

        const commitRes = await fetch(
          `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:commit`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ writes })
          }
        )

        if (!commitRes.ok) {
          const errText = await commitRes.text()
          throw new Error(`Firestore 原子刪除失敗: ${errText}`)
        }

        return jsonResponse({
          success: true,
          message: '交易刪除成功，帳戶餘額已原路回退',
          deletedTransaction: {
            id: txId,
            type: oldTx.type,
            amount: oldTx.amount,
            category: oldTx.category,
            note: oldTx.note,
            operator: user.name
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
