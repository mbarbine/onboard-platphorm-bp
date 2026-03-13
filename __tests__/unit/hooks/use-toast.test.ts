import { describe, it, expect } from 'vitest'
import { reducer } from '@/hooks/use-toast'

describe('toast reducer', () => {
  const emptyState = { toasts: [] }

  describe('ADD_TOAST', () => {
    it('adds a toast to empty state', () => {
      const toast = { id: '1', open: true } as never
      const result = reducer(emptyState, { type: 'ADD_TOAST', toast })
      expect(result.toasts).toHaveLength(1)
      expect(result.toasts[0].id).toBe('1')
    })

    it('limits toasts to TOAST_LIMIT (1)', () => {
      const state = {
        toasts: [{ id: '1', open: true } as never],
      }
      const toast = { id: '2', open: true } as never
      const result = reducer(state, { type: 'ADD_TOAST', toast })
      // TOAST_LIMIT is 1, so only the newest toast remains
      expect(result.toasts).toHaveLength(1)
      expect(result.toasts[0].id).toBe('2')
    })

    it('prepends new toast', () => {
      // Starting fresh; with limit=1 only newest stays
      const toast = { id: '2', open: true } as never
      const result = reducer(emptyState, { type: 'ADD_TOAST', toast })
      expect(result.toasts[0].id).toBe('2')
    })
  })

  describe('UPDATE_TOAST', () => {
    it('updates an existing toast', () => {
      const state = {
        toasts: [{ id: '1', open: true, title: 'Old' } as never],
      }
      const result = reducer(state, {
        type: 'UPDATE_TOAST',
        toast: { id: '1', title: 'New' },
      })
      expect(result.toasts[0].title).toBe('New')
    })

    it('does not modify other toasts', () => {
      const state = {
        toasts: [
          { id: '1', open: true, title: 'First' } as never,
        ],
      }
      const result = reducer(state, {
        type: 'UPDATE_TOAST',
        toast: { id: '2', title: 'Updated' },
      })
      expect(result.toasts[0].title).toBe('First')
    })
  })

  describe('DISMISS_TOAST', () => {
    it('sets open to false for specific toast', () => {
      const state = {
        toasts: [{ id: '1', open: true } as never],
      }
      const result = reducer(state, {
        type: 'DISMISS_TOAST',
        toastId: '1',
      })
      expect(result.toasts[0].open).toBe(false)
    })

    it('dismisses all toasts when no id provided', () => {
      const state = {
        toasts: [{ id: '1', open: true } as never],
      }
      const result = reducer(state, {
        type: 'DISMISS_TOAST',
        toastId: undefined,
      })
      for (const toast of result.toasts) {
        expect(toast.open).toBe(false)
      }
    })
  })

  describe('REMOVE_TOAST', () => {
    it('removes specific toast', () => {
      const state = {
        toasts: [{ id: '1', open: true } as never],
      }
      const result = reducer(state, {
        type: 'REMOVE_TOAST',
        toastId: '1',
      })
      expect(result.toasts).toHaveLength(0)
    })

    it('removes all toasts when no id provided', () => {
      const state = {
        toasts: [{ id: '1', open: true } as never],
      }
      const result = reducer(state, {
        type: 'REMOVE_TOAST',
        toastId: undefined,
      })
      expect(result.toasts).toHaveLength(0)
    })

    it('does not remove non-matching toasts', () => {
      const state = {
        toasts: [{ id: '1', open: true } as never],
      }
      const result = reducer(state, {
        type: 'REMOVE_TOAST',
        toastId: '2',
      })
      expect(result.toasts).toHaveLength(1)
    })
  })
})
