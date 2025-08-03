import React, { useState, useEffect } from 'react'
import { 
  FileText, 
  FolderOpen, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  TrendingUp,
  Activity,
  Database,
  Users,
  Zap,
  BarChart3,
  PieChart
} from 'lucide-react'
import { useWebSocket } from '../contexts/WebSocketContext'
import axios from 'axios'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Badge from '../components/ui/Badge'
import ProgressBar from '../components/ui/ProgressBar'

const Dashboard = () => {
  const [stats, setStats] = useState(null)
  const [systemStatus, setSystemStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const { subscribe, unsubscribe } = useWebSocket()

  useEffect(() => {
    // Subscribe to real-time updates
    subscribe('system_monitoring')
    subscribe('sync_status')
    subscribe('organization_updates')

    // Fetch initial data
    fetchDashboardData()

    return () => {
      unsubscribe('system_monitoring')
      unsubscribe('sync_status')
      unsubscribe('organization_updates')
    }
  }, [])

  const fetchDashboardData = async () => {
    try {
      const [statsResponse, systemResponse] = await Promise.all([
        axios.get('/api/organization/stats'),
        axios.get('/api/system/status')
      ])

      setStats(statsResponse.data.data)
      setSystemStatus(systemResponse.data.data)
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="xl" text="Loading dashboard..." />
      </div>
    )
  }

  const StatCard = ({ title, value, icon: Icon, color = 'primary', trend, subtitle, progress }) => (
    <div className="card hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <div className={`w-12 h-12 bg-${color}-100 rounded-xl flex items-center justify-center`}>
            <Icon className={`w-6 h-6 text-${color}-600`} />
          </div>
        </div>
        <div className="ml-4 flex-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">{title}</p>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              {subtitle && (
                <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
              )}
            </div>
            {trend && (
              <div className={`flex items-center text-sm font-semibold ${
                trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-600'
              }`}>
                <TrendingUp className={`w-4 h-4 mr-1 ${
                  trend < 0 ? 'rotate-180' : ''
                }`} />
                {Math.abs(trend)}%
              </div>
            )}
          </div>
          {progress !== undefined && (
            <div className="mt-3">
              <ProgressBar 
                value={progress} 
                color={color} 
                size="sm" 
                showLabel={false}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const StatusIndicator = ({ status, label }) => {
    const getStatusColor = (status) => {
      switch (status) {
        case 'healthy':
        case 'active':
        case 'connected':
          return 'text-green-600'
        case 'warning':
        case 'idle':
          return 'text-yellow-600'
        case 'error':
        case 'disconnected':
          return 'text-red-600'
        default:
          return 'text-gray-600'
      }
    }

    const getStatusIcon = (status) => {
      switch (status) {
        case 'healthy':
        case 'active':
        case 'connected':
          return CheckCircle
        case 'warning':
        case 'idle':
          return Clock
        case 'error':
        case 'disconnected':
          return AlertCircle
        default:
          return Activity
      }
    }

    const Icon = getStatusIcon(status)

    return (
      <div className="flex items-center space-x-2">
        <Icon className={`w-4 h-4 ${getStatusColor(status)}`} />
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className={`text-sm capitalize ${getStatusColor(status)}`}>{status}</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overview of your Drive Sync system status and recent activity
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Documents"
          value={stats?.totalDocuments || 0}
          subtitle="Across all categories"
          icon={FileText}
          color="blue"
          trend={12}
        />
        <StatCard
          title="Categories"
          value={stats?.totalCategories || 0}
          subtitle="Active organization rules"
          icon={FolderOpen}
          color="green"
          trend={5}
        />
        <StatCard
          title="Sync Operations"
          value={stats?.recentSyncs || 0}
          subtitle="Last 24 hours"
          icon={RefreshCw}
          color="purple"
          trend={-2}
        />
        <StatCard
          title="Storage Used"
          value={stats?.storageUsed || '0 MB'}
          subtitle="of available space"
          icon={Database}
          color="orange"
          progress={65}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System Status */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">System Health</h3>
              <Badge variant="success" size="sm">All Systems Operational</Badge>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <StatusIndicator 
                status={systemStatus?.server || 'healthy'} 
                label="API Server" 
              />
              <StatusIndicator 
                status={systemStatus?.mcp || 'healthy'} 
                label="MCP Bridge" 
              />
              <StatusIndicator 
                status={systemStatus?.websocket || 'connected'} 
                label="WebSocket" 
              />
              <StatusIndicator 
                status={systemStatus?.storage || 'healthy'} 
                label="Storage" 
              />
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">CPU Usage</span>
                  <span className="font-medium">23%</span>
                </div>
                <ProgressBar value={23} color="blue" size="sm" showLabel={false} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Memory Usage</span>
                  <span className="font-medium">67%</span>
                </div>
                <ProgressBar value={67} color="green" size="sm" showLabel={false} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Disk I/O</span>
                  <span className="font-medium">12%</span>
                </div>
                <ProgressBar value={12} color="purple" size="sm" showLabel={false} />
              </div>
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {stats?.recentActivity?.length > 0 ? (
                stats.recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3 p-2 rounded-lg hover:bg-gray-50">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-2 h-2 bg-primary-400 rounded-full animate-pulse"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{activity.description}</p>
                      <p className="text-xs text-gray-500">{activity.timestamp}</p>
                    </div>
                  </div>
                ))
              ) : (
                Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="flex items-start space-x-3 p-2 rounded-lg">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        {[
                          'Document uploaded successfully',
                          'Sync operation completed',
                          'Category rules updated',
                          'System health check passed',
                          'New user registered'
                        ][i]}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(Date.now() - i * 300000).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Summary</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span className="text-sm text-gray-600">Active Users</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">12</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm text-gray-600">API Requests</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">1,247</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-gray-600">Success Rate</span>
                </div>
                <span className="text-sm font-semibold text-green-600">99.8%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="btn btn-primary flex items-center justify-center space-x-2 h-12 transition-transform hover:scale-105">
            <RefreshCw className="w-5 h-5" />
            <span>Start Sync</span>
          </button>
          <button className="btn btn-secondary flex items-center justify-center space-x-2 h-12 transition-transform hover:scale-105">
            <FolderOpen className="w-5 h-5" />
            <span>Organize Documents</span>
          </button>
          <button className="btn btn-secondary flex items-center justify-center space-x-2 h-12 transition-transform hover:scale-105">
            <FileText className="w-5 h-5" />
            <span>Upload Documents</span>
          </button>
          <button className="btn btn-secondary flex items-center justify-center space-x-2 h-12 transition-transform hover:scale-105">
            <Activity className="w-5 h-5" />
            <span>View Logs</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
