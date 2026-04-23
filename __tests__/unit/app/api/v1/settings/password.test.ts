import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '@/app/api/v1/settings/route'
import crypto from 'crypto'

describe('Password Hashing', () => {
  const password = 'test-password'
  const legacyHash = crypto.createHash('sha256').update(password).digest('hex')

  it('should verify legacy sha256 hashes', () => {
    expect(verifyPassword(password, legacyHash)).toBe(true)
    expect(verifyPassword('wrong-password', legacyHash)).toBe(false)
  })

  it('should create new hashes in salt:hash format', () => {
    const hash = hashPassword(password)
    expect(hash).toContain(':')
    const [salt, hashedPassword] = hash.split(':')
    expect(salt).toHaveLength(32) // 16 bytes hex
    expect(hashedPassword).toBeDefined()
  })

  it('should verify new hashes', () => {
    const hash = hashPassword(password)
    expect(verifyPassword(password, hash)).toBe(true)
    expect(verifyPassword('wrong-password', hash)).toBe(false)
  })

  it('should generate different hashes for the same password due to random salt', () => {
    const hash1 = hashPassword(password)
    const hash2 = hashPassword(password)
    expect(hash1).not.toBe(hash2)
  })
})
