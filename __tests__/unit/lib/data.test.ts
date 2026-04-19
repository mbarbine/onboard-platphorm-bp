import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock react cache
vi.mock('react', () => ({
  cache: vi.fn((fn) => fn),
}))

// Mock db module
vi.mock('@/lib/db', () => ({
  sql: vi.fn(),
  DEFAULT_TENANT_ID: '00000000-0000-0000-0000-000000000001',
}))

import { sql } from '@/lib/db'
import { getCategories, getCategory } from '@/lib/data'

describe('data module', () => {
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getCategories', () => {
    it('should return categories successfully', async () => {
      const mockCategories = [
        { id: '1', name: 'Category 1', document_count: 5 },
        { id: '2', name: 'Category 2', document_count: 10 },
      ]
      vi.mocked(sql).mockResolvedValueOnce(mockCategories as any)

      const result = await getCategories()

      expect(result).toEqual(mockCategories)
      expect(sql).toHaveBeenCalledTimes(1)
    })

    it('should catch errors, log them, and return an empty array', async () => {
      const error = new Error('Database error')
      vi.mocked(sql).mockRejectedValueOnce(error)

      const result = await getCategories()

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to get categories:', error)
      expect(result).toEqual([])
    })
  })

  describe('getCategory', () => {
    it('should return the category if found', async () => {
      const mockCategory = { id: '1', name: 'Category 1', slug: 'cat-1' }
      vi.mocked(sql).mockResolvedValueOnce([mockCategory] as any)

      const result = await getCategory('cat-1')

      expect(result).toEqual(mockCategory)
      expect(sql).toHaveBeenCalledTimes(1)
    })

    it('should return null if the category is not found', async () => {
      vi.mocked(sql).mockResolvedValueOnce([] as any)

      const result = await getCategory('non-existent')

      expect(result).toBeNull()
    })

    it('should catch errors, log them, and return null', async () => {
      const error = new Error('Database error')
      vi.mocked(sql).mockRejectedValueOnce(error)

      const result = await getCategory('cat-1')

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to get category:', error)
      expect(result).toBeNull()
    })
  })
})
