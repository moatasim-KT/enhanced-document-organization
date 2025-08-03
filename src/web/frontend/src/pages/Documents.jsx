import React, { useState, useEffect } from 'react'
import { 
  Search, 
  Upload, 
  FileText, 
  Trash2, 
  Edit, 
  FolderOpen,
  Filter,
  Plus,
  Eye,
  Download,
  MoreVertical
} from 'lucide-react'
import { useWebSocket } from '../contexts/WebSocketContext'
import axios from 'axios'
import toast from 'react-hot-toast'
import Modal from '../components/ui/Modal'
import Table from '../components/ui/Table'
import FileUpload from '../components/ui/FileUpload'
import Dropdown from '../components/ui/Dropdown'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const Documents = () => {
  const [documents, setDocuments] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const { subscribe, unsubscribe } = useWebSocket()

  useEffect(() => {
    // Subscribe to real-time updates
    subscribe('document_operations')
    
    // Fetch initial data
    fetchDocuments()
    fetchCategories()

    return () => {
      unsubscribe('document_operations')
    }
  }, [])

  const fetchDocuments = async () => {
    try {
      const response = await axios.get('/api/documents/search', {
        params: {
          query: searchQuery,
          category: selectedCategory,
          limit: 50
        }
      })
      setDocuments(response.data.data || [])
    } catch (error) {
      console.error('Failed to fetch documents:', error)
      toast.error('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/api/organization/categories')
      setCategories(response.data.data || [])
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setLoading(true)
    fetchDocuments()
  }

  const handleDeleteDocument = async (filePath) => {
    if (!confirm('Are you sure you want to delete this document?')) return

    try {
      await axios.delete('/api/documents', {
        data: { file_path: filePath }
      })
      toast.success('Document deleted successfully')
      fetchDocuments()
    } catch (error) {
      console.error('Failed to delete document:', error)
      toast.error('Failed to delete document')
    }
  }

  // Table columns for document display
  const documentColumns = [
    {
      key: 'name',
      title: 'Name',
      render: (value, doc) => (
        <div className="flex items-center space-x-3">
          <FileText className="w-5 h-5 text-primary-600 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {doc.title || doc.filename || value}
            </p>
            <p className="text-xs text-gray-500 truncate">{doc.path}</p>
          </div>
        </div>
      )
    },
    {
      key: 'category',
      title: 'Category',
      render: (value) => (
        <Badge variant={value ? 'primary' : 'default'} size="sm">
          {value || 'Uncategorized'}
        </Badge>
      )
    },
    {
      key: 'size',
      title: 'Size',
      render: (value) => <span className="text-sm text-gray-600">{value || 'Unknown'}</span>
    },
    {
      key: 'lastModified',
      title: 'Modified',
      render: (value) => <span className="text-sm text-gray-500">{value || 'Unknown'}</span>
    },
    {
      key: 'actions',
      title: 'Actions',
      sortable: false,
      render: (_, doc) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleViewDocument(doc)}
            className="p-1 text-gray-400 hover:text-primary-600 transition-colors"
            title="View"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleEditDocument(doc)}
            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDownloadDocument(doc)}
            className="p-1 text-gray-400 hover:text-green-600 transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteDocument(doc.path)}
            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ]

  // Enhanced document actions
  const handleViewDocument = (doc) => {
    // TODO: Implement document viewer
    toast.success(`Viewing ${doc.title || doc.filename}`)
  }

  const handleEditDocument = (doc) => {
    // TODO: Implement document editor
    toast.success(`Editing ${doc.title || doc.filename}`)
  }

  const handleDownloadDocument = (doc) => {
    // TODO: Implement document download
    toast.success(`Downloading ${doc.title || doc.filename}`)
  }

  const handleFileUpload = async (files) => {
    try {
      const formData = new FormData()
      files.forEach(file => {
        formData.append('files', file)
      })
      
      await axios.post('/api/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      
      toast.success(`${files.length} file(s) uploaded successfully`)
      setShowUpload(false)
      fetchDocuments()
    } catch (error) {
      console.error('Upload failed:', error)
      toast.error('Failed to upload files')
    }
  }

  // Category options for dropdown
  const categoryOptions = categories.map(cat => ({
    value: cat.name,
    label: `${cat.name} (${cat.count})`
  }))
  categoryOptions.unshift({ value: '', label: 'All Categories' })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage and organize your documents
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="btn btn-primary flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Upload Documents</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search documents by name, content, or category..."
                  className="input pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="w-full sm:w-64">
              <Dropdown
                options={categoryOptions}
                value={selectedCategory}
                onChange={setSelectedCategory}
                placeholder="Filter by category"
                searchable
              />
            </div>
            <button type="submit" className="btn btn-primary flex items-center space-x-2">
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Search</span>
            </button>
          </div>
        </form>
      </div>

      {/* Documents Table */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <LoadingSpinner size="lg" text="Loading documents..." />
          </div>
        ) : documents.length > 0 ? (
          <Table
            data={documents}
            columns={documentColumns}
            searchable={false} // We have our own search
            sortable={true}
            pagination={true}
            pageSize={20}
          />
        ) : (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No documents found</h3>
            <p className="text-gray-500 mb-4">
              {searchQuery || selectedCategory 
                ? 'Try adjusting your search criteria'
                : 'Upload some documents to get started'
              }
            </p>
            <button
              onClick={() => setShowUpload(true)}
              className="btn btn-primary"
            >
              Upload Documents
            </button>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <Modal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        title="Upload Documents"
        size="lg"
      >
        <FileUpload
          onFilesSelected={handleFileUpload}
          accept=".pdf,.doc,.docx,.txt,.md,.jpg,.jpeg,.png,.gif"
          multiple={true}
          maxSize={50 * 1024 * 1024} // 50MB
        />
      </Modal>
    </div>
  )
}

export default Documents
