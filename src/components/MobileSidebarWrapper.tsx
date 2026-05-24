'use client'

import { useSidebar } from './SidebarStateProvider'

export function MobileSidebarWrapper({ children }: { children: React.ReactNode }) {
  const { open, close } = useSidebar()

  return (
    <>
      {/* Backdrop — mobile only when drawer open */}
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={close}
        className={`lg:hidden fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm transition-opacity ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />
      {/* Sidebar — fixed-drawer on mobile, static in flow on lg+ */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:translate-x-0 lg:z-auto ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {children}
      </div>
    </>
  )
}
