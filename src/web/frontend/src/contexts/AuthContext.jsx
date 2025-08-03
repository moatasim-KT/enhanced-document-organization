import React, { createContext, useContext, useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(localStorage.getItem('token'))

  // Configure axios defaults
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    } else {
      delete axios.defaults.headers.common['Authorization']
    }
  }, [token])

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const response = await axios.get('/api/auth/me')
          setUser(response.data.data)
        } catch (error) {
          console.error('Auth check failed:', error)
          logout()
        }
      }
      setLoading(false)
    }

    checkAuth()
  }, [token])

  const login = async (username, password) => {
    try {
      const response = await axios.post('/api/auth/login', {
        username,
        password
      })

      const { token: newToken, user: userData } = response.data.data
      
      setToken(newToken)
      setUser(userData)
      localStorage.setItem('token', newToken)
      
      toast.success('Login successful!')
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
    delete axios.defaults.headers.common['Authorization']
    toast.success('Logged out successfully')
  }

  const register = async (username, password, role = 'user') => {
    try {
      const response = await axios.post('/api/auth/register', {
        username,
        password,
        role
      })

      const { token: newToken, user: userData } = response.data.data
      
      setToken(newToken)
      setUser(userData)
      localStorage.setItem('token', newToken)
      
      toast.success('Registration successful!')
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const changePassword = async (oldPassword, newPassword) => {
    try {
      await axios.post('/api/auth/change-password', {
        oldPassword,
        newPassword
      })
      
      toast.success('Password changed successfully!')
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.message || 'Password change failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const updateProfile = async (profileData) => {
    try {
      const response = await axios.put('/api/auth/profile', profileData)
      const updatedUser = response.data.data
      
      setUser(updatedUser)
      toast.success('Profile updated successfully!')
      return { success: true, data: updatedUser }
    } catch (error) {
      const message = error.response?.data?.message || 'Profile update failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const uploadAvatar = async (file) => {
    try {
      const formData = new FormData()
      formData.append('avatar', file)
      
      const response = await axios.post('/api/auth/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      
      const updatedUser = response.data.data
      setUser(updatedUser)
      toast.success('Avatar updated successfully!')
      return { success: true, data: updatedUser }
    } catch (error) {
      const message = error.response?.data?.message || 'Avatar upload failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const requestPasswordReset = async (email) => {
    try {
      await axios.post('/api/auth/forgot-password', { email })
      toast.success('Password reset email sent!')
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.message || 'Password reset request failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const resetPassword = async (token, newPassword) => {
    try {
      await axios.post('/api/auth/reset-password', {
        token,
        password: newPassword
      })
      toast.success('Password reset successfully!')
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.message || 'Password reset failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    register,
    changePassword,
    updateProfile,
    uploadAvatar,
    requestPasswordReset,
    resetPassword,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    hasPermission: (permission) => {
      if (!user) return false
      if (user.role === 'admin') return true
      return user.permissions?.includes(permission) || false
    }
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
