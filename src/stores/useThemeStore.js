import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  // Theme state: 'light', 'dark', 'grayscale'
  const currentTheme = ref('light')
  
  // Load theme from localStorage on init
  const savedTheme = localStorage.getItem('ponzimon-theme')
  if (savedTheme && ['light', 'dark', 'grayscale'].includes(savedTheme)) {
    currentTheme.value = savedTheme
  }
  
  // Computed properties
  const isDark = computed(() => currentTheme.value === 'dark')
  const isGrayscale = computed(() => currentTheme.value === 'grayscale')
  const isLight = computed(() => currentTheme.value === 'light')
  
  // Theme labels for UI
  const themeLabel = computed(() => {
    switch (currentTheme.value) {
      case 'dark': return '暗色模式'
      case 'grayscale': return '黑白模式'
      case 'light': return '彩色模式'
      default: return '彩色模式'
    }
  })
  
  // Theme icons
  const themeIcon = computed(() => {
    switch (currentTheme.value) {
      case 'dark': return '🌙'
      case 'grayscale': return '⚫'
      case 'light': return '🌈'
      default: return '🌈'
    }
  })
  
  // Apply theme to document
  const applyTheme = () => {
    const root = document.documentElement
    
    // Remove all theme classes
    root.classList.remove('theme-light', 'theme-dark', 'theme-grayscale')
    
    // Add current theme class
    root.classList.add(`theme-${currentTheme.value}`)
    
    // Save to localStorage
    localStorage.setItem('ponzimon-theme', currentTheme.value)
    
    console.log('Theme applied:', currentTheme.value)
  }
  
  // Set specific theme
  const setTheme = (theme) => {
    if (['light', 'dark', 'grayscale'].includes(theme)) {
      currentTheme.value = theme
      applyTheme()
    }
  }
  
  // Cycle through themes
  const cycleTheme = () => {
    const themes = ['light', 'dark', 'grayscale']
    const currentIndex = themes.indexOf(currentTheme.value)
    const nextIndex = (currentIndex + 1) % themes.length
    setTheme(themes[nextIndex])
  }
  
  // Initialize theme on store creation
  applyTheme()
  
  return {
    // State
    currentTheme,
    
    // Computed
    isDark,
    isGrayscale,
    isLight,
    themeLabel,
    themeIcon,
    
    // Actions
    setTheme,
    cycleTheme,
    applyTheme
  }
})