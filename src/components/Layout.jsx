import React, { useState } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

const Layout = ({ children }) => {
  const [open, setOpen] = useState(true)

  return (
    <div className="layout-shell">
      <Sidebar collapsed={!open} />
      <div className="flex flex-col flex-1">
        <Topbar toggleSidebar={() => setOpen(o => !o)} />
        <main className="flex-1 overflow-y-auto px-8 py-8 animate-fadeLift">
          {children}
        </main>
      </div>
    </div>
  )
}

export default Layout