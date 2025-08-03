import React, { useState, useEffect } from 'react'
import { 
  RefreshCw, 
  Play, 
  Square, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Settings,
  History,
  Wifi
} from 'lucide-react'
import { useWebSocket } from '../contexts/WebSocketContext'
import axios from 'axios'
import toast from 'react-hot-toast'

const Sync = () => {
  const [syncStatus, setSyncStatus] = useState(null)
  const [syncHistory, setSyncHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const { subscribe, unsubscribe } = useWebSocket()

  useEffect(() => {
    // Subscribe to real-time updates
    subscribe('sync_status')
    
    // Fetch initial data
    fetchSyncData()

    return () => {
      unsubscribe('sync_status')
    }
  }, [])

  const fetchSyncData = async () => {
    try {
      const [statusResponse, historyResponse] = await Promise.all([
        axios.get('/api/sync/status'),
        axios.get('/api/sync/history')
      ])
      
      setSyncStatus(statusResponse.data.data)
      setSyncHistory(historyResponse.data.data || [])
    } catch (error) {
      console.error('Failed to fetch sync data:', error)
      toast.error('Failed to load sync data')
    } finally {
      setLoading(false)
    }
  }

  const handleStartSync = async () => {
    setSyncing(true)
    try {
      await axios.post('/api/sync/start')
      toast.success('Sync started successfully')
      fetchSyncData()
    } catch (error) {
      console.error('Failed to start sync:', error)
      toast.error('Failed to start sync')
    } finally {
      setSyncing(false)
    }
  }

  const handleStopSync = async () => {
    try {
      await axios.post('/api/sync/stop')
      toast.success('Sync stopped')
      fetchSyncData()
    } catch (error) {
      console.error('Failed to stop sync:', error)
      toast.error('Failed to stop sync')
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
      case 'syncing':
        return <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
      case 'completed':
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'failed':
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />
      case 'idle':
      default:
        return <Clock className="w-5 h-5 text-gray-600" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
      case 'syncing':
        return 'text-blue-600'
      case 'completed':
      case 'success':
        return 'text-green-600'
      case 'failed':
      case 'error':
        return 'text-red-600'
      case 'idle':
      default:
        return 'text-gray-600'
    }
  }

  const SyncHistoryItem = ({ sync }) => (
    <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
      <div className="flex-shrink-0">
        {getStatusIcon(sync.status)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-900">
            {sync.service || 'Drive Sync'}
          </p>
          <p className="text-xs text-gray-500">{sync.timestamp}</p>
        </div>
        <p className="text-sm text-gray-500">{sync.description}</p>
        {sync.filesProcessed && (
          <p className="text-xs text-gray-400 mt-1">
            {sync.filesProcessed} files processed
          </p>
        )}
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
          <h1 className="text-2xl font-bold text-gray-900">Sync</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage cloud service synchronization
          </p>
        </div>
        <div className="flex space-x-2">
          <button className="btn btn-secondary flex items-center space-x-2">
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
          {syncStatus?.status === 'active' ? (
            <button
              onClick={handleStopSync}
              className="btn btn-danger flex items-center space-x-2"
            >
              <Square className="w-4 h-4" />
              <span>Stop Sync</span>
            </button>
          ) : (
            <button
              onClick={handleStartSync}
              disabled={syncing}
              className="btn btn-primary flex items-center space-x-2"
            >
              {syncing ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Play className="w-4 h-4" />
              )}
              <span>{syncing ? 'Starting...' : 'Start Sync'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Current Status */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Current Status</h3>
        <div className="flex items-center space-x-4">
          <div className="flex-shrink-0">
            {getStatusIcon(syncStatus?.status)}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900">
                Status: <span className={getStatusColor(syncStatus?.status)}>
                  {syncStatus?.status || 'Unknown'}
                </span>
              </p>
              <p className="text-xs text-gray-500">
                Last updated: {syncStatus?.lastUpdated || 'Never'}
              </p>
            </div>
            {syncStatus?.currentOperation && (
              <p className="text-sm text-gray-600 mt-1">
                {syncStatus.currentOperation}
              </p>
            )}
            {syncStatus?.progress && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Progress</span>
                  <span>{syncStatus.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${syncStatus.progress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Service Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {['iCloud', 'Google Drive', 'OneDrive'].map((service) => (
          <div key={service} className="card">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <Wifi className="w-6 h-6 text-primary-600" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-gray-900">{service}</h4>
                <p className="text-xs text-green-600">Connected</p>
              </div>
              <div className="flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sync History */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <History className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-medium text-gray-900">Sync History</h2>
        </div>

        {syncHistory.length > 0 ? (
          <div className="space-y-3">
            {syncHistory.map((sync, index) => (
              <SyncHistoryItem key={index} sync={sync} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <RefreshCw className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No sync history</h3>
            <p className="text-gray-500 mb-4">
              Start your first sync to see activity here
            </p>
            <button
              onClick={handleStartSync}
              className="btn btn-primary"
            >
              Start First Sync
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Sync
