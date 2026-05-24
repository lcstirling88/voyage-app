'use client'

import { Menu } from 'lucide-react'
import { useSidebar } from './SidebarStateProvider'

export function MobileMenuButton() {
  const { toggle } = useSidebar()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Open menu"
      className="lg:hidden p-2 -ml-2 rounded-md hover:bg-line-soft"
    >
      <Menu className="w-5 h-5" />
    </button>
  )
}
