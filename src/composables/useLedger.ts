import { ref, computed } from 'vue'
import type { Account, Transaction, RecurringTransaction, CatMood } from '../types'
import { useAuth } from './useAuth'
import { getDatabaseService } from '../services/db'

// 核心響應式狀態 (Singleton 全域共享，維護同一個資產紀錄)
const accounts = ref<Account[]>([])
const transactions = ref<Transaction[]>([])
const recurringTransactions = ref<RecurringTransaction[]>([])
const triggeredReports = ref<string[]>([]) // 逗逗貓待報告的週期記帳清單
const isDataLoaded = ref(false)

export function useLedger() {
  const { currentProfile } = useAuth()
  const db = getDatabaseService()

  // 1. 📂 顯式資料載入方法
  const loadLedgerData = async () => {
    isDataLoaded.value = false
    
    const [accts, txs, recs] = await Promise.all([
      db.getAccounts(),
      db.getTransactions(),
      db.getRecurring()
    ])

    accounts.value = accts
    transactions.value = txs
    recurringTransactions.value = recs
    isDataLoaded.value = true
    
    // 觸發週期性自動記帳的 Lazy-check
    await checkAndTriggerRecurring()
  }

  // 2. 清空全域資料方法 (一般共同記帳下不需要清空帳本，僅重置加載狀態)
  const clearLedgerData = () => {
    accounts.value = []
    transactions.value = []
    recurringTransactions.value = []
    triggeredReports.value = []
    isDataLoaded.value = false
  }

  // 3. 資料同步回資料庫的方法
  const syncAccounts = async () => {
    await db.saveAccounts(accounts.value)
  }

  const syncTransactions = async () => {
    await db.saveTransactions(transactions.value)
  }

  const syncRecurring = async () => {
    await db.saveRecurring(recurringTransactions.value)
  }

  // 4. 核心運算看板欄位 (Computed)
  
  // 總資產
  const totalAssets = computed(() => {
    return accounts.value
      .filter(a => a.type !== 'credit_card' && a.balance > 0)
      .reduce((sum, a) => sum + a.balance, 0)
  })

  // 總負債
  const totalLiabilities = computed(() => {
    const cardDebt = accounts.value
      .filter(a => a.type === 'credit_card')
      .reduce((sum, a) => sum + Math.abs(a.balance), 0)
    
    const otherDebt = accounts.value
      .filter(a => a.type !== 'credit_card' && a.balance < 0)
      .reduce((sum, a) => sum + Math.abs(a.balance), 0)

    return cardDebt + otherDebt
  })

  // 淨資產
  const netWorth = computed(() => totalAssets.value - totalLiabilities.value)

  // 本月總收支與預算消耗
  const currentMonthPeriod = computed(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  })

  // 本月總支出
  const monthlyExpense = computed(() => {
    const currentPeriod = currentMonthPeriod.value
    return transactions.value
      .filter(tx => {
        const txDate = new Date(tx.date)
        const y = txDate.getFullYear()
        const m = String(txDate.getMonth() + 1).padStart(2, '0')
        const period = `${y}-${m}`
        
        if (tx.creditCardDetails?.isInstallment) {
          return tx.creditCardDetails.billPeriod === currentPeriod
        }
        return tx.type === 'expense' && period === currentPeriod
      })
      .reduce((sum, tx) => sum + tx.amount, 0)
  })

  // 本月總收入
  const monthlyIncome = computed(() => {
    const currentPeriod = currentMonthPeriod.value
    return transactions.value
      .filter(tx => {
        const txDate = new Date(tx.date)
        const y = txDate.getFullYear()
        const m = String(txDate.getMonth() + 1).padStart(2, '0')
        const period = `${y}-${m}`
        return tx.type === 'income' && period === currentPeriod
      })
      .reduce((sum, tx) => sum + tx.amount, 0)
  })

  // 預算消耗比例
  const budgetRatio = computed(() => {
    const budget = currentProfile.value?.settings.monthlyBudget || 20000
    if (budget <= 0) return 0
    return monthlyExpense.value / budget
  })

  const dodoCatMood = computed<CatMood>(() => {
    const ratio = budgetRatio.value
    if (ratio >= 1.0) return 'crying'
    if (ratio >= 0.8) return 'scared'
    if (ratio >= 0.6) return 'nervous'
    return 'happy'
  })

  // 逗逗貓對話提示
  const dodoCatSpeech = computed(() => {
    if (triggeredReports.value.length > 0) {
      const firstReport = triggeredReports.value[0]
      return `喵～主人！趁您不在，我剛剛幫您處理了「${firstReport}」的週期扣款喔！喵嗚～`
    }

    const ratio = budgetRatio.value
    const percent = Math.round(ratio * 100)
    if (ratio >= 1.0) {
      return `嗚喵！！！這個月預算已經超支了啦 (${percent}%)！逗逗貓要把主人的信用卡藏起來了喵！哭哭 (ㄒoㄒ)`
    }
    if (ratio >= 0.8) {
      return `喵！主人才剛過一半，預算就已經花掉 ${percent}% 了！再花下去我們就只能吃土了喵！∑(O_O;)`
    }
    if (ratio >= 0.6) {
      return `喵嗚…預算已經花掉 ${percent}% 囉…主人最近花錢有點大方，逗逗貓有點小擔心罐罐不夠吃了喵…(・_・;)`
    }
    return `喵～這個月只花了 ${percent}% 的預算！主人真是理財高手！繼續保持，逗逗貓最愛您了喵～(❀◕ ▾ ◕)`
  })

  // 5. 輔助函數：計算信用卡的帳單歸屬月份
  const calculateBillPeriod = (dateMs: number, billingCycleDate: number): string => {
    const date = new Date(dateMs)
    const y = date.getFullYear()
    const m = date.getMonth()
    const d = date.getDate()

    let targetYear = y
    let targetMonth = m

    if (d > billingCycleDate) {
      targetMonth += 1
      if (targetMonth > 11) {
        targetMonth = 0
        targetYear += 1
      }
    }

    const finalMonthStr = String(targetMonth + 1).padStart(2, '0')
    return `${targetYear}-${finalMonthStr}`
  }

  // 6. 記帳核心方法
  const addTransaction = async (txData: Omit<Transaction, 'id' | 'createdBy' | 'createdByAvatar'>) => {
    const txId = 'tx_' + Date.now() + Math.random().toString(36).substr(2, 4)
    const creatorName = currentProfile.value?.name || '未知主人'
    const creatorAvatar = currentProfile.value?.avatar || '🐱'

    // a. 轉帳手續費處理 (手續費支出同樣記名)
    if (txData.type === 'transfer' && txData.fee && txData.fee > 0) {
      const feeTx: Transaction = {
        id: 'tx_fee_' + Date.now(),
        type: 'expense',
        amount: txData.fee,
        category: '居住生活',
        subCategory: '網路電話',
        fromAccountId: txData.fromAccountId,
        date: txData.date,
        note: `轉帳手續費 (轉至 ${accounts.value.find(a => a.id === txData.toAccountId)?.name || '未知帳戶'})`,
        tags: ['手續費'],
        createdBy: '系統自動',
        createdByAvatar: '⚙️'
      }
      transactions.value.push(feeTx)
      
      const fromAcct = accounts.value.find(a => a.id === txData.fromAccountId)
      if (fromAcct) {
        fromAcct.balance -= txData.fee
      }
    }

    // b. 信用卡分期付款處理 (分期各期數明細同樣記名)
    if (txData.type === 'expense' && txData.creditCardDetails?.isInstallment) {
      const cardAcct = accounts.value.find(a => a.id === txData.fromAccountId)
      if (cardAcct && cardAcct.type === 'credit_card' && cardAcct.cardDetails) {
        const totalAmount = txData.amount
        const T = txData.creditCardDetails.installmentTerm
        
        cardAcct.balance -= totalAmount

        const baseShare = Math.floor(totalAmount / T)
        const firstShare = totalAmount - (baseShare * (T - 1))
        
        for (let i = 1; i <= T; i++) {
          const installmentAmount = (i === 1) ? firstShare : baseShare
          
          const billDate = new Date(txData.date)
          billDate.setMonth(billDate.getMonth() + (i - 1))
          const currentBillPeriod = calculateBillPeriod(billDate.getTime(), cardAcct.cardDetails.billingCycleDate)

          const installmentTx: Transaction = {
            id: `${txId}_inst_${i}`,
            type: 'expense',
            amount: installmentAmount,
            category: txData.category,
            subCategory: txData.subCategory,
            fromAccountId: txData.fromAccountId,
            date: txData.date,
            note: `${txData.note} (分期 ${i}/${T})`,
            tags: [...txData.tags, '分期'],
            createdBy: creatorName,
            createdByAvatar: creatorAvatar,
            creditCardDetails: {
              isInstallment: true,
              installmentTerm: T,
              currentInstallment: i,
              billPeriod: currentBillPeriod
            }
          }
          transactions.value.push(installmentTx)
        }
        
        await syncAccounts()
        await syncTransactions()
        return
      }
    }

    // c. 一般交易餘額增減邏輯 (記名寫入)
    const newTx: Transaction = { 
      ...txData, 
      id: txId,
      createdBy: creatorName,
      createdByAvatar: creatorAvatar
    }
    transactions.value.push(newTx)

    if (txData.type === 'expense') {
      const fromAcct = accounts.value.find(a => a.id === txData.fromAccountId)
      if (fromAcct) {
        fromAcct.balance -= txData.amount
      }
    } else if (txData.type === 'income') {
      const toAcct = accounts.value.find(a => a.id === txData.toAccountId)
      if (toAcct) {
        toAcct.balance += txData.amount
      }
    } else if (txData.type === 'transfer') {
      const fromAcct = accounts.value.find(a => a.id === txData.fromAccountId)
      const toAcct = accounts.value.find(a => a.id === txData.toAccountId)
      if (fromAcct) {
        fromAcct.balance -= txData.amount
      }
      if (toAcct) {
        toAcct.balance += txData.amount
      }
    }

    await syncAccounts()
    await syncTransactions()
  }

  // 7. 刪除交易
  const deleteTransaction = async (txId: string) => {
    const idx = transactions.value.findIndex(tx => tx.id === txId)
    if (idx === -1) return

    const tx = transactions.value[idx]

    if (tx.creditCardDetails?.isInstallment) {
      const baseTxId = txId.split('_inst_')[0]
      const relatedInsts = transactions.value.filter(t => t.id.startsWith(baseTxId))
      
      const totalAmount = relatedInsts.reduce((sum, t) => sum + t.amount, 0)
      const cardAcct = accounts.value.find(a => a.id === tx.fromAccountId)
      
      if (cardAcct) {
        cardAcct.balance += totalAmount
      }

      transactions.value = transactions.value.filter(t => !t.id.startsWith(baseTxId))
    } else {
      if (tx.type === 'expense') {
        const fromAcct = accounts.value.find(a => a.id === tx.fromAccountId)
        if (fromAcct) {
          fromAcct.balance += tx.amount
        }
      } else if (tx.type === 'income') {
        const toAcct = accounts.value.find(a => a.id === tx.toAccountId)
        if (toAcct) {
          toAcct.balance -= tx.amount
        }
      } else if (tx.type === 'transfer') {
        const fromAcct = accounts.value.find(a => a.id === tx.fromAccountId)
        const toAcct = accounts.value.find(a => a.id === tx.toAccountId)
        
        if (tx.fee && tx.fee > 0) {
          const feeTxIdx = transactions.value.findIndex(t => t.id === 'tx_fee_' + tx.id.replace('tx_', ''))
          if (feeTxIdx !== -1) {
            const feeTx = transactions.value[feeTxIdx]
            if (fromAcct) fromAcct.balance += feeTx.amount
            transactions.value.splice(feeTxIdx, 1)
          }
        }

        if (fromAcct) fromAcct.balance += tx.amount
        if (toAcct) toAcct.balance -= tx.amount
      }

      transactions.value.splice(idx, 1)
    }

    await syncAccounts()
    await syncTransactions()
  }

  // 8. 信用卡一鍵繳款 (還款交易記名為自動扣繳或當前執行人)
  const payCreditCardBill = async (cardId: string, linkedBankId: string, billPeriod: string) => {
    const cardAcct = accounts.value.find(a => a.id === cardId)
    const bankAcct = accounts.value.find(a => a.id === linkedBankId)
    
    if (!cardAcct || cardAcct.type !== 'credit_card' || !bankAcct) return

    const billAmount = transactions.value
      .filter(tx => tx.fromAccountId === cardId && tx.creditCardDetails?.billPeriod === billPeriod)
      .reduce((sum, tx) => sum + tx.amount, 0)

    if (billAmount <= 0) return

    bankAcct.balance -= billAmount
    cardAcct.balance += billAmount

    const payTx: Transaction = {
      id: 'tx_pay_' + Date.now(),
      type: 'transfer',
      amount: billAmount,
      category: '轉帳',
      fromAccountId: linkedBankId,
      toAccountId: cardId,
      date: Date.now(),
      note: `繳納信用卡 ${billPeriod} 帳單`,
      tags: ['信用卡繳款'],
      createdBy: currentProfile.value?.name || '系統自動',
      createdByAvatar: currentProfile.value?.avatar || '🐱'
    }
    transactions.value.push(payTx)

    await syncAccounts()
    await syncTransactions()
  }

  // 9. 週期自動記帳 Lazy-check 機制 (由逗逗貓為您服務記名)
  const checkAndTriggerRecurring = async () => {
    if (!currentProfile.value) return
    
    const now = Date.now()
    let hasTriggered = false
    triggeredReports.value = []

    for (const rec of recurringTransactions.value) {
      if (!rec.isActive) continue

      let nextRun = rec.nextExecutionDate
      let triggerCount = 0

      while (now >= nextRun) {
        triggerCount++
        
        const autoTx: Transaction = {
          id: `tx_auto_${rec.id}_${nextRun}`,
          type: rec.type as any,
          amount: rec.amount,
          category: rec.category,
          subCategory: rec.subCategory,
          fromAccountId: rec.fromAccountId,
          date: nextRun,
          note: `${rec.title} (自動扣款)`,
          tags: ['定期定額', '自動記帳'],
          isRecurring: true,
          recurringId: rec.id,
          createdBy: '逗逗貓', // 🐱 逗逗貓貼心大廚親自記帳！
          createdByAvatar: '🐱'
        }
        transactions.value.push(autoTx)

        const acct = accounts.value.find(a => a.id === rec.fromAccountId)
        if (acct) {
          acct.balance -= rec.amount
        }

        const date = new Date(nextRun)
        if (rec.frequency === 'daily') {
          date.setDate(date.getDate() + rec.interval)
        } else if (rec.frequency === 'weekly') {
          date.setDate(date.getDate() + (rec.interval * 7))
        } else if (rec.frequency === 'monthly') {
          date.setMonth(date.getMonth() + rec.interval)
        }
        nextRun = date.getTime()
      }

      if (triggerCount > 0) {
        rec.nextExecutionDate = nextRun
        triggeredReports.value.push(`${rec.title} (x${triggerCount})`)
        hasTriggered = true
      }
    }

    if (hasTriggered) {
      await syncAccounts()
      await syncTransactions()
      await syncRecurring()
      
      setTimeout(() => {
        triggeredReports.value = []
      }, 6000)
    }
  }

  // 10. 帳戶管理方法
  const addAccount = async (acctData: Omit<Account, 'id' | 'createdAt'>) => {
    const newAcct: Account = {
      ...acctData,
      id: 'acct_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      createdAt: Date.now()
    }
    accounts.value.push(newAcct)
    await syncAccounts()
  }

  const deleteAccount = async (acctId: string) => {
    accounts.value = accounts.value.filter(a => a.id !== acctId)
    transactions.value = transactions.value.filter(tx => tx.fromAccountId !== acctId && tx.toAccountId !== acctId)
    await syncAccounts()
    await syncTransactions()
  }

  const editAccount = async (acctId: string, updated: Partial<Account>) => {
    const idx = accounts.value.findIndex(a => a.id === acctId)
    if (idx !== -1) {
      accounts.value[idx] = { ...accounts.value[idx], ...updated }
      await syncAccounts()
    }
  }

  // 11. 週期性記帳設定管理
  const addRecurring = async (recData: Omit<RecurringTransaction, 'id' | 'isActive'>) => {
    const newRec: RecurringTransaction = {
      ...recData,
      id: 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      isActive: true
    }
    recurringTransactions.value.push(newRec)
    await syncRecurring()
    await checkAndTriggerRecurring()
  }

  const toggleRecurringActive = async (recId: string) => {
    const found = recurringTransactions.value.find(r => r.id === recId)
    if (found) {
      found.isActive = !found.isActive
      await syncRecurring()
    }
  }

  const deleteRecurring = async (recId: string) => {
    recurringTransactions.value = recurringTransactions.value.filter(r => r.id !== recId)
    await syncRecurring()
  }

  return {
    accounts: computed(() => accounts.value),
    transactions: computed(() => transactions.value),
    recurringTransactions: computed(() => recurringTransactions.value),
    triggeredReports: computed(() => triggeredReports.value),
    isDataLoaded: computed(() => isDataLoaded.value),
    
    totalAssets,
    totalLiabilities,
    netWorth,
    monthlyExpense,
    monthlyIncome,
    budgetRatio,
    
    dodoCatMood,
    dodoCatSpeech,
    
    loadLedgerData,
    clearLedgerData,
    
    addTransaction,
    deleteTransaction,
    payCreditCardBill,
    
    addAccount,
    deleteAccount,
    editAccount,

    addRecurring,
    toggleRecurringActive,
    deleteRecurring,
    checkAndTriggerRecurring
  }
}
