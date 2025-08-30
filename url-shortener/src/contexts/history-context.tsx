"use client"

import React, { createContext, useContext, useReducer, useEffect } from 'react'

export interface HistoryItem {
  id: string
  originalUrl: string
  shortCode: string
  shortUrl: string
  title?: string
  description?: string
  image?: string
  favicon?: string
  createdAt: number
}

interface HistoryState {
  items: HistoryItem[]
  isLoading: boolean
}

type HistoryAction = 
  | { type: 'ADD_ITEM'; payload: HistoryItem }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'LOAD_HISTORY'; payload: HistoryItem[] }
  | { type: 'SET_LOADING'; payload: boolean }

const initialState: HistoryState = {
  items: [],
  isLoading: false
}

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'ADD_ITEM':
      // Check if item already exists (avoid duplicates)
      const existingIndex = state.items.findIndex(item => item.shortCode === action.payload.shortCode)
      if (existingIndex !== -1) {
        // Update existing item and move to top
        const updatedItems = [...state.items]
        updatedItems[existingIndex] = { ...action.payload, createdAt: Date.now() }
        updatedItems.unshift(updatedItems.splice(existingIndex, 1)[0])
        return { ...state, items: updatedItems }
      }
      // Add new item to the beginning
      return { 
        ...state, 
        items: [action.payload, ...state.items].slice(0, 50) // Keep only last 50 items
      }
    
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter(item => item.id !== action.payload)
      }
    
    case 'CLEAR_HISTORY':
      return {
        ...state,
        items: []
      }
    
    case 'LOAD_HISTORY':
      return {
        ...state,
        items: action.payload
      }
    
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload
      }
    
    default:
      return state
  }
}

interface HistoryContextType {
  state: HistoryState
  addItem: (item: Omit<HistoryItem, 'id' | 'createdAt'>) => void
  removeItem: (id: string) => void
  clearHistory: () => void
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined)

const STORAGE_KEY = 'url-shortener-history'

export function HistoryProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(historyReducer, initialState)

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          dispatch({ type: 'LOAD_HISTORY', payload: parsed })
        }
      }
    } catch (error) {
      console.error('Error loading history from localStorage:', error)
    }
  }, [])

  // Save to localStorage whenever history changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items))
    } catch (error) {
      console.error('Error saving history to localStorage:', error)
    }
  }, [state.items])

  const addItem = (item: Omit<HistoryItem, 'id' | 'createdAt'>) => {
    const historyItem: HistoryItem = {
      ...item,
      id: Math.random().toString(36).substring(2) + Date.now().toString(36),
      createdAt: Date.now()
    }
    dispatch({ type: 'ADD_ITEM', payload: historyItem })
  }

  const removeItem = (id: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: id })
  }

  const clearHistory = () => {
    dispatch({ type: 'CLEAR_HISTORY' })
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <HistoryContext.Provider value={{ state, addItem, removeItem, clearHistory }}>
      {children}
    </HistoryContext.Provider>
  )
}

export function useHistory() {
  const context = useContext(HistoryContext)
  if (context === undefined) {
    throw new Error('useHistory must be used within a HistoryProvider')
  }
  return context
}