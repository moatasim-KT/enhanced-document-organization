import React, { useState, useEffect } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

const Notification = ({ 
  type = 'info', 
  title, 
  message, 
  duration = 5000,
  onClose,
  actions = [],
  persistent = false 
}) => {
  const [isVisible, setIsVisible] = useState(true)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    if (!persistent && duration > 0) {
      const timer = setTimeout(() => {
        handleClose()
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [duration, persistent])

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => {
      setIsVisible(false)
      if (onClose) onClose()
    }, 300)
  }

  if (!isVisible) return null

  const typeConfig = {
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      iconColor: 'text-green-600',
      titleColor: 'text-green-800',
      messageColor: 'text-green-700'
    },
    error: {
      icon: AlertCircle,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      iconColor: 'text-red-600',
      titleColor: 'text-red-800',
      messageColor: 'text-red-700'
    },
    warning: {
      icon: AlertTriangle,
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      iconColor: 'text-yellow-600',
      titleColor: 'text-yellow-800',
      messageColor: 'text-yellow-700'
    },
    info: {
      icon: Info,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      iconColor: 'text-blue-600',
      titleColor: 'text-blue-800',
      messageColor: 'text-blue-700'
    }
  }

  const config = typeConfig[type]
  const Icon = config.icon

  return (
    <div className={`
      fixed top-4 right-4 z-50 max-w-sm w-full
      transform transition-all duration-300 ease-out
      ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      ${isVisible ? 'animate-slide-up' : ''}
    `}>
      <div className={`
        ${config.bgColor} ${config.borderColor} border rounded-lg shadow-lg p-4
        hover:shadow-xl transition-shadow duration-200
      `}>
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <Icon className={`w-5 h-5 ${config.iconColor}`} />
          </div>
          <div className="ml-3 flex-1">
            {title && (
              <h3 className={`text-sm font-medium ${config.titleColor} mb-1`}>
                {title}
              </h3>
            )}
            <p className={`text-sm ${config.messageColor}`}>
              {message}
            </p>
            {actions.length > 0 && (
              <div className="mt-3 flex space-x-2">
                {actions.map((action, index) => (
                  <button
                    key={index}
                    onClick={action.onClick}
                    className={`
                      text-xs font-medium px-3 py-1 rounded
                      ${action.primary 
                        ? `bg-${type === 'error' ? 'red' : type === 'warning' ? 'yellow' : type === 'success' ? 'green' : 'blue'}-600 text-white hover:bg-${type === 'error' ? 'red' : type === 'warning' ? 'yellow' : type === 'success' ? 'green' : 'blue'}-700`
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }
                      transition-colors duration-200
                    `}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="ml-4 flex-shrink-0">
            <button
              onClick={handleClose}
              className={`
                ${config.iconColor} hover:opacity-75 transition-opacity duration-200
                rounded-full p-1 hover:bg-white hover:bg-opacity-20
              `}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Notification
