import React, { useState, useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { 
  Home, 
  FileText, 
  FolderOpen, 
  RefreshCw, 
  Settings, 
  Wifi,
  WifiOff,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useWebSocket } from '../contexts/WebSocketContext'
import Header from './Header'

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { user } = useAuth()
  const { connected } = useWebSocket()
  const location = useLocation()

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false) // Close mobile sidebar on desktop
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Documents', href: '/documents', icon: FileText },
    { name: 'Organization', href: '/organization', icon: FolderOpen },
    { name: 'Sync', href: '/sync', icon: RefreshCw },
    { name: 'System', href: '/system', icon: Settings },
  ]

  const isActive = (href) => {
    return location.pathname === href
  }

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div 
            className="fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
          
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
            <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
              <div className="flex-shrink-0 flex items-center justify-between px-4">
                <h1 className="text-xl font-bold text-gray-900">Drive Sync</h1>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  ×
                </button>
              </div>
              
              <nav className="mt-5 px-2 space-y-1">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`sidebar-item ${
                      isActive(item.href) ? 'sidebar-item-active' : 'sidebar-item-inactive'
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                ))}
              </nav>
              
              {/* Connection status in mobile sidebar */}
              <div className="mt-6 px-4">
                <div className="flex items-center space-x-2 text-sm">
                  {connected ? (
                    <>
                      <Wifi className="h-4 w-4 text-green-600" />
                      <span className="text-green-600 font-medium">Connected</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-4 w-4 text-red-600" />
                      <span className="text-red-600 font-medium">Disconnected</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <div className={`hidden lg:flex lg:flex-shrink-0 transition-all duration-300 ${
          sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'
        }`}>
          <div className="flex flex-col w-full bg-white border-r border-gray-200">
            <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
              <div className="flex items-center justify-between px-4">
                {!sidebarCollapsed && (
                  <h1 className="text-xl font-bold text-gray-900">Drive Sync</h1>
                )}
                <button
                  onClick={toggleSidebarCollapse}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  {sidebarCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronLeft className="h-4 w-4" />
                  )}
                </button>
              </div>
              
              <nav className={`mt-5 flex-1 px-2 space-y-1 ${
                sidebarCollapsed ? 'px-2' : 'px-2'
              }`}>
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`sidebar-item ${
                      isActive(item.href) ? 'sidebar-item-active' : 'sidebar-item-inactive'
                    } ${sidebarCollapsed ? 'justify-center' : ''}`}
                    title={sidebarCollapsed ? item.name : ''}
                  >
                    <item.icon className={`h-5 w-5 ${sidebarCollapsed ? '' : 'mr-3'}`} />
                    {!sidebarCollapsed && item.name}
                  </Link>
                ))}
              </nav>
              
              {/* Connection status in desktop sidebar */}
              {!sidebarCollapsed && (
                <div className="mt-auto px-4 py-3 border-t border-gray-200">
                  <div className="flex items-center space-x-2 text-sm">
                    {connected ? (
                      <>
                        <Wifi className="h-4 w-4 text-green-600" />
                        <span className="text-green-600 font-medium">Connected</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="h-4 w-4 text-red-600" />
                        <span className="text-red-600 font-medium">Disconnected</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <Header 
            onMenuToggle={toggleSidebar} 
            isSidebarOpen={sidebarOpen}
          />
          
          {/* Page content */}
          <main className="flex-1 overflow-y-auto bg-gray-50 p-4 lg:p-6">
            <div className="max-w-7xl mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default Layout
