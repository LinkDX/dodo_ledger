import { describe, it, expect } from 'vitest'
import { parseVersionFromApkName, compareVersions } from '../src/utils/version'

describe('App Update Version Utils', () => {
  describe('parseVersionFromApkName', () => {
    it('應該能從標準檔名中解析出版本號', () => {
      expect(parseVersionFromApkName('dodo-ledger-v1.0.8.apk')).toBe('1.0.8')
      expect(parseVersionFromApkName('v1.0.8.apk')).toBe('1.0.8')
    })

    it('應該能從包含多位數版號的檔名中解析出版本號', () => {
      expect(parseVersionFromApkName('dodo-ledger-v12.34.567.apk')).toBe('12.34.567')
    })

    it('若格式不符應該回傳 null', () => {
      expect(parseVersionFromApkName('dodo-ledger.apk')).toBeNull()
      expect(parseVersionFromApkName('dodo-ledger-1.0.8.apk')).toBeNull() // 沒有 'v'
      expect(parseVersionFromApkName('')).toBeNull()
      expect(parseVersionFromApkName('dodo-ledger-v1.apk')).toBeNull() // 不滿三段
    })
  })

  describe('compareVersions', () => {
    it('若遠端版本比本地新，應該回傳 true', () => {
      expect(compareVersions('1.0.7', '1.0.8')).toBe(true)
      expect(compareVersions('1.0.9', '1.0.10')).toBe(true)
      expect(compareVersions('1.0.9', '1.1.0')).toBe(true)
      expect(compareVersions('1.9.9', '2.0.0')).toBe(true)
    })

    it('若遠端版本與本地相同，應該回傳 false', () => {
      expect(compareVersions('1.0.8', '1.0.8')).toBe(false)
      expect(compareVersions('v1.0.8', '1.0.8')).toBe(false)
      expect(compareVersions('1.0.8', 'v1.0.8')).toBe(false)
    })

    it('若遠端版本比本地舊，應該回傳 false', () => {
      expect(compareVersions('1.0.8', '1.0.7')).toBe(false)
      expect(compareVersions('1.1.0', '1.0.9')).toBe(false)
      expect(compareVersions('2.0.0', '1.9.9')).toBe(false)
    })

    it('應該能正確處理帶有 "v" 前綴的版本號', () => {
      expect(compareVersions('v1.0.7', 'v1.0.8')).toBe(true)
      expect(compareVersions('v1.0.8', 'v1.0.7')).toBe(false)
    })

    it('應該能處理不對等長度的版本號比較', () => {
      expect(compareVersions('1.0', '1.0.1')).toBe(true)
      expect(compareVersions('1.0.1', '1.0')).toBe(false)
      expect(compareVersions('1', '1.0.1')).toBe(true)
    })

    it('若含有非數值字元，應跳過該段以確保健壯性', () => {
      expect(compareVersions('1.a.0', '1.b.1')).toBe(false) // 兩段 a 與 b 不是合法數字，跳過不影響後段，或回傳 false
    })
  })
})
