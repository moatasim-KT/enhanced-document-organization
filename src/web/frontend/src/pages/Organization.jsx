import React, { useState, useEffect } from 'react'
import { 
  FolderOpen, 
  Play, 
  BarChart3, 
  Settings, 
  Plus,
  Eye,
  Trash2
} from 'lucide-react'
import { useWebSocket } from '../contexts/WebSocketContext'
import axios from 'axios'
import toast from 'react-hot-toast'

const Organization = () => {
  const [stats, setStats] = useState(null)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [organizing, setOrganizing] = useState(false)
  const { subscribe, unsubscribe } = useWebSocket()

  useEffect(() => {
    // Subscribe to real-time updates
    subscribe('organization_updates')
    
    // Fetch initial data
    fetchOrganizationData()

    return () => {
      unsubscribe('organization_updates')
    }
  }, [])

  const fetchOrganizationData = async () => {
    try {
      const [statsResponse, categoriesResponse] = await Promise.all([
        axios.get('/api/organization/stats'),
        axios.get('/api/organization/categories')
      ])
      
      setStats(statsResponse.data.data)
      setCategories(categoriesResponse.data.data || [])
    } catch (error) {
      console.error('Failed to fetch organization data:', error)
      toast.error('Failed to load organization data')
    } finally {
      setLoading(false)
    }
  }

  const handleOrganize = async () => {
    setOrganizing(true)
    try {
      await axios.post('/api/organization/organize')
      toast.success('Organization process started')
      // Refresh data after organization
      setTimeout(fetchOrganizationData, 2000)
    } catch (error) {
      console.error('Failed to start organization:', error)
      toast.error('Failed to start organization')
    } finally {
      setOrganizing(false)
    }
  }

  const handlePreviewOrganization = async () => {
    try {
      const response = await axios.get('/api/organization/preview')
      console.log('Organization preview:', response.data)
      toast.success('Organization preview generated')
    } catch (error) {
      console.error('Failed to preview organization:', error)
      toast.error('Failed to generate preview')
    }
  }

  const CategoryCard = ({ category }) => (
    <div className="card">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <span className="text-lg">{category.icon || '📁'}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900">{category.name}</h3>
            <p className="text-sm text-gray-500 mt-1">{category.description}</p>
            <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
              <span>{category.count} documents</span>
              <span>Priority: {category.priority}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            className="p-1 text-gray-400 hover:text-gray-600"
            title="View files"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            className="p-1 text-gray-400 hover:text-red-600"
            title="Delete category"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

  const StatCard = ({ title, value, description, color = 'primary' }) => (
    <div className="card">
      <div className="text-center">
        <div className={`text-3xl font-bold text-${color}-600 mb-2`}>{value}</div>
        <div className="text-sm font-medium text-gray-900 mb-1">{title}</div>
        <div className="text-xs text-gray-500">{description}</div>
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
          <h1 className="text-2xl font-bold text-gray-900">Organization</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage document categories and organization rules
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handlePreviewOrganization}
            className="btn btn-secondary flex items-center space-x-2"
          >
            <Eye className="w-4 h-4" />
            <span>Preview</span>
          </button>
          <button
            onClick={handleOrganize}
            disabled={organizing}
            className="btn btn-primary flex items-center space-x-2"
          >
            {organizing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span>{organizing ? 'Organizing...' : 'Start Organization'}</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Documents"
          value={stats?.totalDocuments || 0}
          description="Documents in system"
          color="blue"
        />
        <StatCard
          title="Categories"
          value={stats?.totalCategories || 0}
          description="Active categories"
          color="green"
        />
        <StatCard
          title="Unorganized"
          value={stats?.unorganizedDocuments || 0}
          description="Need organization"
          color="yellow"
        />
        <StatCard
          title="Last Organized"
          value={stats?.lastOrganized || 'Never'}
          description="Most recent run"
          color="purple"
        />
      </div>

      {/* Categories */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900">Categories</h2>
          <button className="btn btn-secondary flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Add Category</span>
          </button>
        </div>

        {categories.length > 0 ? (
          <div className="grid gap-4">
            {categories.map((category, index) => (
              <CategoryCard key={index} category={category} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No categories found</h3>
            <p className="text-gray-500 mb-4">
              Create categories to organize your documents
            </p>
            <button className="btn btn-primary">
              Create First Category
            </button>
          </div>
        )}
      </div>

      {/* Organization Rules */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Organization Rules</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <div className="text-sm font-medium text-gray-900">Auto-categorize by file type</div>
              <div className="text-xs text-gray-500">Automatically sort documents by their file extensions</div>
            </div>
            <div className="flex items-center">
              <input type="checkbox" className="rounded border-gray-300" defaultChecked />
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <div className="text-sm font-medium text-gray-900">Content-based categorization</div>
              <div className="text-xs text-gray-500">Use AI to categorize documents based on content</div>
            </div>
            <div className="flex items-center">
              <input type="checkbox" className="rounded border-gray-300" defaultChecked />
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <div className="text-sm font-medium text-gray-900">Duplicate detection</div>
              <div className="text-xs text-gray-500">Identify and handle duplicate documents</div>
            </div>
            <div className="flex items-center">
              <input type="checkbox" className="rounded border-gray-300" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Organization
