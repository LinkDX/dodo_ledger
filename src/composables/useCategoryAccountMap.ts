import { computed } from 'vue'
import { useAuth } from './useAuth'
import { useLedger } from './useLedger'
import type { CategoryAccountRule, TransactionType, Account } from '../types'

/** 格式化規則鍵名：主分類 > 子分類 或 主分類 */
export function formatRuleKey(category: string, subCategory?: string): string {
  const cat = (category || '').trim()
  const sub = (subCategory || '').trim()
  if (sub) {
    return `${cat} > ${sub}`
  }
  return cat
}

/** 解析規則鍵名 */
export function parseRuleKey(key: string): { category: string; subCategory?: string } {
  const parts = key.split(' > ')
  if (parts.length >= 2) {
    return {
      category: parts[0].trim(),
      subCategory: parts.slice(1).join(' > ').trim()
    }
  }
  return {
    category: key.trim(),
    subCategory: undefined
  }
}

export function useCategoryAccountMap() {
  const { currentProfile, updateProfileSettings } = useAuth()
  const { accounts, transactions } = useLedger()

  // 當前使用者的 mapping 物件 (Record<string, string>)
  const currentMap = computed<Record<string, string>>(() => {
    return currentProfile.value?.settings?.categoryAccountMap || {}
  })

  /** 驗證帳戶對於特定交易類型是否有效且存在 */
  const isAccountValidForType = (accountId: string, txType: TransactionType = 'expense'): boolean => {
    const acct = accounts.value.find(a => a.id === accountId)
    if (!acct) return false
    if (txType === 'income' && acct.type === 'credit_card') return false
    return true
  }

  /**
   * 根據分類取得推薦對應帳戶
   * 優先權：
   * 1. 「主分類 > 子分類」
   * 2. 「子分類」直接鍵名 (相容性)
   * 3. 「主分類」通用預設
   */
  const getPreferredAccountId = (
    category: string,
    subCategory?: string,
    txType: TransactionType = 'expense'
  ): string | null => {
    const map = currentMap.value
    const cat = (category || '').trim()
    const sub = (subCategory || '').trim()

    // 1. 查找「主分類 > 子分類」
    if (cat && sub) {
      const fullKey = formatRuleKey(cat, sub)
      const targetId = map[fullKey]
      if (targetId && isAccountValidForType(targetId, txType)) {
        return targetId
      }

      // 2. 查找「子分類」直接鍵名
      if (map[sub] && isAccountValidForType(map[sub], txType)) {
        return map[sub]
      }
    }

    // 3. 查找「主分類」通用對應
    if (cat && map[cat] && isAccountValidForType(map[cat], txType)) {
      return map[cat]
    }

    return null
  }

  /** 儲存整份 Map 到當前使用者的 settings 中 */
  const saveMap = async (newMap: Record<string, string>) => {
    if (!currentProfile.value) return
    await updateProfileSettings({
      categoryAccountMap: { ...newMap }
    })
  }

  /** 手動新增或更新單筆規則 */
  const setRule = async (category: string, subCategory: string | undefined, accountId: string) => {
    const key = formatRuleKey(category, subCategory)
    const updated = { ...currentMap.value, [key]: accountId }
    await saveMap(updated)
  }

  /** 刪除單筆規則 */
  const removeRule = async (key: string) => {
    const updated = { ...currentMap.value }
    delete updated[key]
    await saveMap(updated)
  }

  /** 清空當前使用者所有規則 */
  const clearAllRules = async () => {
    await saveMap({})
  }

  /**
   * 從記帳交易中自動學習 (記帳成功時呼叫)
   * 同步更新「主分類 > 子分類」與「主分類」之最新帳戶
   */
  const learnFromTransaction = async (
    category: string,
    subCategory: string | undefined,
    accountId: string
  ) => {
    if (!accountId) return
    const cat = (category || '').trim()
    const sub = (subCategory || '').trim()
    if (!cat) return

    const updated = { ...currentMap.value }

    // 更新「主分類 > 子分類」
    if (sub) {
      updated[formatRuleKey(cat, sub)] = accountId
    }

    // 更新「主分類」
    updated[cat] = accountId

    await saveMap(updated)
  }

  /**
   * 從歷史記帳紀錄中一鍵提煉/漸出 mapping
   * 優先針對目前成員，由舊到新排序，取出最新使用的帳戶
   */
  const extractFromHistory = async (): Promise<number> => {
    const currentUserName = currentProfile.value?.name
    const allTxs = [...transactions.value]
    
    // 依時間排序 (舊到新，後面的最新紀錄會覆蓋前面的)
    allTxs.sort((a, b) => a.date - b.date)

    // 篩選屬於目前使用者的紀錄 (若無 createdBy 則向後相容視為通用)
    const userTxs = currentUserName
      ? allTxs.filter(tx => !tx.createdBy || tx.createdBy === currentUserName)
      : allTxs

    const newMap: Record<string, string> = { ...currentMap.value }
    let learnedCount = 0

    for (const tx of userTxs) {
      const accountId = tx.type === 'income' ? tx.toAccountId : tx.fromAccountId
      if (!accountId) continue

      // 檢查帳戶是否存在
      const exists = accounts.value.some(a => a.id === accountId)
      if (!exists) continue

      const cat = (tx.category || '').trim()
      const sub = (tx.subCategory || '').trim()
      if (!cat) continue

      // 記錄主分類
      newMap[cat] = accountId
      learnedCount++

      // 若有子分類，記錄子分類
      if (sub) {
        newMap[formatRuleKey(cat, sub)] = accountId
      }
    }

    await saveMap(newMap)
    return Object.keys(newMap).length
  }

  /** 結構化的規則列表 (用於設定頁面展示) */
  const rulesList = computed(() => {
    const map = currentMap.value
    const list: Array<CategoryAccountRule & { account?: Account }> = []

    for (const [key, accountId] of Object.entries(map)) {
      const parsed = parseRuleKey(key)
      const account = accounts.value.find(a => a.id === accountId)
      list.push({
        key,
        category: parsed.category,
        subCategory: parsed.subCategory,
        accountId,
        account
      })
    }

    // 依主分類、子分類排序
    return list.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category, 'zh-TW')
      }
      return (a.subCategory || '').localeCompare(b.subCategory || '', 'zh-TW')
    })
  })

  return {
    currentMap,
    rulesList,
    getPreferredAccountId,
    setRule,
    removeRule,
    clearAllRules,
    learnFromTransaction,
    extractFromHistory,
    formatRuleKey,
    parseRuleKey
  }
}
