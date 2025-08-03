import React, { useState, useEffect } from 'react'
import { 
  Activity, 
  Server, 
  Database, 
  Cpu, 
  HardDrive,
  Wifi,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Settings,
  Download
} from 'lucide-react'
import { useWebSocket } from '../contexts/WebSocketContext'
import axios from 'axios'
import toast from 'react-hot-toast'

const System = () => {
  const [systemStatus, setSystemStatus] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const { subscribe, unsubscribe } = useWebSocket()

  useEffect(() => {
    // Subscribe to real-time updates
    subscribe('system_monitoring')
    
    // Fetch initial data
    fetchSystemData()

    return () => {
      unsubscribe('system_monitoring')
    }
  }, [])

  const fetchSystemData = async () => {
    try {
      const [statusResponse, metricsResponse, logsResponse] = await Promise.all([
        axios.get('/api/system/status'),
        axios.get('/api/system/metrics'),
        axios.get('/api/system/logs')
      ])
      
      setSystemStatus(statusResponse.data.data)
      setMetrics(metricsResponse.data.data)
      setLogs(logsResponse.data.data || [])
    } catch (error) {
      console.error('Failed to fetch system data:', error)
      toast.error('Failed to load system data')
    } finally {
      setLoading(false)
    }
  }

  const handleRestart = async () => {
    if (!confirm('Are you sure you want to restart the system?')) return

    try {
      await axios.post('/api/system/restart')
      toast.success('System restart initiated')
    } catch (error) {
      console.error('Failed to restart system:', error)
      toast.error('Failed to restart system')
    }
  }

  const handleClearCache = async () => {
    try {
      await axios.post('/api/system/cache/clear')
      toast.success('Cache cleared successfully')
      fetchSystemData()
    } catch (error) {
      console.error('Failed to clear cache:', error)
      toast.error('Failed to clear cache')
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy':
      case 'active':
      case 'connected':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'warning':
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />
      case 'error':
      case 'failed':
      case 'disconnected':
        return <AlertTriangle className="w-5 h-5 text-red-600" />
      default:
        return <Activity className="w-5 h-5 text-gray-600" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy':
      case 'active':
      case 'connected':
        return 'text-green-600'
      case 'warning':
      case 'degraded':
        return 'text-yellow-600'
      case 'error':
      case 'failed':
      case 'disconnected':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const MetricCard = ({ title, value, unit, icon: Icon, color = 'primary' }) => (
    <div className="card">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <div className={`w-8 h-8 bg-${color}-100 rounded-lg flex items-center justify-center`}>
            <Icon className={`w-5 h-5 text-${color}-600`} />
          </div>
        </div>
        <div className="ml-5 w-0 flex-1">
          <dl>
            <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
            <dd className="text-2xl font-semibold text-gray-900">
              {value} <span className="text-sm text-gray-500">{unit}</span>
            </dd>
          </dl>
        </div>
      </div>
    </div>
  )

  const LogEntry = ({ log }) => (
    <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
      <div className="flex-shrink-0 mt-1">
        <div className={`w-2 h-2 rounded-full ${
          log.level === 'error' ? 'bg-red-500' :
          log.level === 'warning' ? 'bg-yellow-500' :
          log.level === 'info' ? 'bg-blue-500' : 'bg-gray-500'
        }`}></div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-900">{log.component}</p>
          <p className="text-xs text-gray-500">{log.timestamp}</p>
        </div>
        <p className="text-sm text-gray-600">{log.message}</p>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor system health and performance
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleClearCache}
            className="btn btn-secondary flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Clear Cache</span>
          </button>
          <button
            onClick={handleRestart}
            className="btn btn-danger flex items-center space-x-2"
          >
            <Settings className="w-4 h-4" />
            <span>Restart</span>
          </button>
        </div>
      </div>

      {/* System Status */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">System Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center space-x-3">
            {getStatusIcon(systemStatus?.server)}
            <div>
              <p className="text-sm font-medium text-gray-900">Server</p>
              <p className={`text-xs ${getStatusColor(systemStatus?.server)}`}>
                {systemStatus?.server || 'Unknown'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {getStatusIcon(systemStatus?.mcp)}
            <div>
              <p className="text-sm font-medium text-gray-900">MCP Bridge</p>
              <p className={`text-xs ${getStatusColor(systemStatus?.mcp)}`}>
                {systemStatus?.mcp || 'Unknown'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {getStatusIcon(systemStatus?.websocket)}
            <div>
              <p className="text-sm font-medium text-gray-900">WebSocket</p>
              <p className={`text-xs ${getStatusColor(systemStatus?.websocket)}`}>
                {systemStatus?.websocket || 'Unknown'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {getStatusIcon(systemStatus?.storage)}
            <div>
              <p className="text-sm font-medium text-gray-900">Storage</p>
              <p className={`text-xs ${getStatusColor(systemStatus?.storage)}`}>
                {systemStatus?.storage || 'Unknown'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="CPU Usage"
          value={metrics?.cpu || 0}
          unit="%"
          icon={Cpu}
          color="blue"
        />
        <MetricCard
          title="Memory Usage"
          value={metrics?.memory || 0}
          unit="MB"
          icon={Database}
          color="green"
        />
        <MetricCard
          title="Disk Usage"
          value={metrics?.disk || 0}
          unit="GB"
          icon={HardDrive}
          color="purple"
        />
        <MetricCard
          title="Network"
          value={metrics?.network || 0}
          unit="KB/s"
          icon={Wifi}
          color="orange"
        />
      </div>

      {/* System Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">System Information</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Version</span>
              <span className="text-sm font-medium text-gray-900">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Uptime</span>
              <span className="text-sm font-medium text-gray-900">
                {systemStatus?.uptime || 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Node.js Version</span>
              <span className="text-sm font-medium text-gray-900">
                {systemStatus?.nodeVersion || 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Platform</span>
              <span className="text-sm font-medium text-gray-900">
                {systemStatus?.platform || 'Unknown'}
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <button className="w-full btn btn-secondary flex items-center justify-center space-x-2">
              <Download className="w-4 h-4" />
              <span>Download Logs</span>
            </button>
            <button className="w-full btn btn-secondary flex items-center justify-center space-x-2">
              <Settings className="w-4 h-4" />
              <span>System Configuration</span>
            </button>
            <button className="w-full btn btn-secondary flex items-center justify-center space-x-2">
              <Activity className="w-4 h-4" />
              <span>Performance Monitor</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Logs */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-gray-900">Recent Logs</h2>
        {logs.length > 0 ? (
          <div className="space-y-3">
            {logs.slice(0, 10).map((log, index) => (
              <LogEntry key={index} log={log} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No logs available</h3>
            <p className="text-gray-500">System logs will appear here when available</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default System
