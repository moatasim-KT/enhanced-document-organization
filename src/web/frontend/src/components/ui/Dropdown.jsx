import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

const Dropdown = ({ 
  options = [], 
  value, 
  onChange, 
  placeholder = 'Select an option',
  searchable = false,
  multiple = false,
  disabled = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter options based on search term
  const filteredOptions = searchable 
    ? options.filter(option => 
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options

  const handleOptionClick = (option) => {
    if (multiple) {
      const newValue = value?.includes(option.value)
        ? value.filter(v => v !== option.value)
        : [...(value || []), option.value]
      onChange(newValue)
    } else {
      onChange(option.value)
      setIsOpen(false)
    }
  }

  const getDisplayText = () => {
    if (multiple) {
      if (!value || value.length === 0) return placeholder
      if (value.length === 1) {
        const option = options.find(opt => opt.value === value[0])
        return option?.label || placeholder
      }
      return `${value.length} selected`
    } else {
      const option = options.find(opt => opt.value === value)
      return option?.label || placeholder
    }
  }

  const isSelected = (optionValue) => {
    if (multiple) {
      return value?.includes(optionValue)
    }
    return value === optionValue
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full px-3 py-2 text-left bg-white border border-gray-300 rounded-lg
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
          disabled:bg-gray-100 disabled:cursor-not-allowed
          ${isOpen ? 'ring-2 ring-primary-500 border-transparent' : ''}
        `}
      >
        <div className="flex items-center justify-between">
          <span className={`block truncate ${!value ? 'text-gray-500' : 'text-gray-900'}`}>
            {getDisplayText()}
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {searchable && (
            <div className="p-2 border-b border-gray-200">
              <input
                type="text"
                placeholder="Search..."
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          
          <div className="py-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleOptionClick(option)}
                  className={`
                    w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center justify-between
                    ${isSelected(option.value) ? 'bg-primary-50 text-primary-700' : 'text-gray-900'}
                  `}
                >
                  <span>{option.label}</span>
                  {isSelected(option.value) && (
                    <Check className="w-4 h-4 text-primary-600" />
                  )}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-gray-500 text-center">
                No options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Dropdown
