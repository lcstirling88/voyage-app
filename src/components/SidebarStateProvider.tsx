'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

type SidebarState = {
  open: boolean
  toggle: () => void
  close: () => void
}

const SidebarContext = createContext<SidebarState>({
  open: false,
  toggle: () => {},
  close: () => {},
})

export function SidebarStateProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close drawer when route changes (mobile nav-link tap)
  useEffect(() => { setOpen(false) }, [pathname])

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [open])

  return (
    <SidebarContext.Provider value={{ open, toggle: () => setOpen((v) => !v), close: () => setOpen(false) }}>
      {children}
    </SidebarContext.Provider>
  )
}

export const useSidebar = () => useContext(SidebarContext)
