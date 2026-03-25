import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface TenantContextState {
  activeTenantId: string | null
  activeTenantName: string | null
  setActiveTenant: (id: string | null, name: string | null) => void
  clearActiveTenant: () => void
}

export const useTenantContextStore = create<TenantContextState>()(
  persist(
    (set) => ({
      activeTenantId: null,
      activeTenantName: null,
      setActiveTenant: (id, name) => set({ activeTenantId: id, activeTenantName: name }),
      clearActiveTenant: () => set({ activeTenantId: null, activeTenantName: null }),
    }),
    { name: 'retrevr-active-tenant' }
  )
)
