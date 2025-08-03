import React, { useState, useRef } from 'react'
import { Upload, X, File, Image, FileText } from 'lucide-react'
import ProgressBar from './ProgressBar'

const FileUpload = ({ 
  onFilesSelected,
  accept = '*/*',
  multiple = true,
  maxSize = 10 * 1024 * 1024, // 10MB
  className = ''
}) => {
  const [dragActive, setDragActive] = useState(false)
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})
  const inputRef = useRef(null)

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleChange = (e) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files)
    }
  }

  const handleFiles = (fileList) => {
    const newFiles = Array.from(fileList).map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: file.type,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
    }))

    // Validate file sizes
    const validFiles = newFiles.filter(fileObj => {
      if (fileObj.size > maxSize) {
        console.warn(`File ${fileObj.name} is too large`)
        return false
      }
      return true
    })

    setFiles(prev => [...prev, ...validFiles])
    if (onFilesSelected) {
      onFilesSelected(validFiles.map(f => f.file))
    }
  }

  const removeFile = (id) => {
    setFiles(prev => {
      const updated = prev.filter(f => f.id !== id)
      if (onFilesSelected) {
        onFilesSelected(updated.map(f => f.file))
      }
      return updated
    })
  }

  const getFileIcon = (type) => {
    if (type.startsWith('image/')) return Image
    if (type.includes('text') || type.includes('document')) return FileText
    return File
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className={className}>
      {/* Drop Zone */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${dragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300'}
          ${files.length > 0 ? 'mb-4' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept={accept}
          onChange={handleChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-lg font-medium text-gray-900 mb-2">
          Drop files here or click to browse
        </p>
        <p className="text-sm text-gray-500">
          {multiple ? 'Select multiple files' : 'Select a file'} up to {formatFileSize(maxSize)}
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((fileObj) => {
            const FileIcon = getFileIcon(fileObj.type)
            const progress = uploadProgress[fileObj.id] || 0
            
            return (
              <div key={fileObj.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                {fileObj.preview ? (
                  <img 
                    src={fileObj.preview} 
                    alt={fileObj.name}
                    className="w-10 h-10 object-cover rounded"
                  />
                ) : (
                  <FileIcon className="w-10 h-10 text-gray-400" />
                )}
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {fileObj.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(fileObj.size)}
                  </p>
                  
                  {uploading && progress > 0 && (
                    <ProgressBar 
                      value={progress} 
                      size="sm" 
                      className="mt-1"
                      showLabel={false}
                    />
                  )}
                </div>
                
                <button
                  onClick={() => removeFile(fileObj.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default FileUpload
