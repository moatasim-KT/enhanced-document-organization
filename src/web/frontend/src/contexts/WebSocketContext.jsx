import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from './AuthContext'

const WebSocketContext = createContext()

export const useWebSocket = () => {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}

export const WebSocketProvider = ({ children }) => {
  const { isAuthenticated, token } = useAuth()
  const [socket, setSocket] = useState(null)
  const [connected, setConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState(null)
  const [subscriptions, setSubscriptions] = useState(new Set())
  const reconnectTimeoutRef = useRef(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5

  const connect = () => {
    if (!isAuthenticated || !token) return

    try {
      const wsUrl = `ws://localhost:3000/ws?token=${token}`
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('WebSocket connected')
        setConnected(true)
        setSocket(ws)
        reconnectAttemptsRef.current = 0
        
        // Re-subscribe to channels
        subscriptions.forEach(channel => {
          ws.send(JSON.stringify({
            type: 'subscribe',
            channel
          }))
        })
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          setLastMessage(message)
          handleMessage(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason)
        setConnected(false)
        setSocket(null)
        
        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const timeout = Math.pow(2, reconnectAttemptsRef.current) * 1000 // Exponential backoff
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++
            connect()
          }, timeout)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        toast.error('Connection error occurred')
      }

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
    }
  }

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (socket) {
      socket.close(1000, 'User disconnected')
    }
  }

  const subscribe = (channel) => {
    setSubscriptions(prev => new Set([...prev, channel]))
    
    if (socket && connected) {
      socket.send(JSON.stringify({
        type: 'subscribe',
        channel
      }))
    }
  }

  const unsubscribe = (channel) => {
    setSubscriptions(prev => {
      const newSet = new Set(prev)
      newSet.delete(channel)
      return newSet
    })
    
    if (socket && connected) {
      socket.send(JSON.stringify({
        type: 'unsubscribe',
        channel
      }))
    }
  }

  const handleMessage = (message) => {
    switch (message.type) {
      case 'document_created':
        toast.success(`Document "${message.data.title}" created successfully`)
        break
      case 'document_deleted':
        toast.success(`Document deleted successfully`)
        break
      case 'sync_started':
        toast.success('Sync operation started')
        break
      case 'sync_completed':
        toast.success('Sync operation completed successfully')
        break
      case 'sync_failed':
        toast.error(`Sync failed: ${message.data.error}`)
        break
      case 'organization_completed':
        toast.success(`Organization completed: ${message.data.organized} documents processed`)
        break
      case 'system_alert':
        if (message.data.level === 'error') {
          toast.error(message.data.message)
        } else if (message.data.level === 'warning') {
          toast(message.data.message, { icon: '⚠️' })
        } else {
          toast.success(message.data.message)
        }
        break
      case 'error':
        toast.error(message.data.message || 'An error occurred')
        break
      case 'pong':
        // Heartbeat response - no action needed
        break
      default:
        console.log('Unhandled WebSocket message:', message)
    }
  }

  // Connect when authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      connect()
    } else {
      disconnect()
    }

    return () => {
      disconnect()
    }
  }, [isAuthenticated, token])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [])

  const value = {
    socket,
    connected,
    lastMessage,
    subscribe,
    unsubscribe,
    subscriptions: Array.from(subscriptions)
  }

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  )
}
