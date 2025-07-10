<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import SolanaWalletManager from './components/SolanaWalletManager.vue'
import ThemeToggle from './components/ThemeToggle.vue'

const appRef = ref(null)
const minHeight = ref('100vh')

let resizeObserver = null

onMounted(() => {
  if (appRef.value) {
    // 创建 ResizeObserver 监听高度变化
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { height } = entry.contentRect
        
        // 获取当前 min-height 的数值（去掉 'px' 单位）
        const currentMinHeight = parseInt(minHeight.value.replace(/px|vh/, '')) || window.innerHeight
        
        // 如果新高度大于当前最小高度，更新 min-height
        if (height > currentMinHeight) {
          minHeight.value = `${height}px`
        }
      }
    })
    
    // 开始观察 app 元素
    resizeObserver.observe(appRef.value)
  }
})

onUnmounted(() => {
  // 清理观察器
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})
</script>

<template>
  <div 
    id="app" 
    ref="appRef"
    :style="{ minHeight: minHeight }"
  >
    <ThemeToggle />
    <SolanaWalletManager />
  </div>
</template>

<style>
/* CSS Custom Properties for Theme Support */
:root {
  /* Light Theme (Default) */
  --bg-primary: #f5f5f5;
  --bg-secondary: #ffffff;
  --bg-tertiary: #f8f9fa;
  --text-primary: #2c3e50;
  --text-secondary: #666;
  --border-color: #ddd;
  --button-primary: #007bff;
  --button-secondary: #6c757d;
  --success-color: #28a745;
  --error-color: #dc3545;
  --warning-color: #ffc107;
  
  /* Theme toggle button colors */
  --theme-toggle-bg: rgba(255, 255, 255, 0.9);
  --theme-toggle-bg-hover: rgba(255, 255, 255, 1);
  --theme-toggle-border: rgba(0, 0, 0, 0.1);
  --theme-toggle-text: #333;
  --theme-toggle-shadow: rgba(0, 0, 0, 0.1);
  --theme-toggle-shadow-hover: rgba(0, 0, 0, 0.15);
}

/* Dark Theme */
:root.theme-dark {
  --bg-primary: #1a1a1a;
  --bg-secondary: #2d2d2d;
  --bg-tertiary: #3a3a3a;
  --text-primary: #e0e0e0;
  --text-secondary: #b0b0b0;
  --border-color: #555;
  --button-primary: #0056b3;
  --button-secondary: #5a6268;
  --success-color: #198754;
  --error-color: #dc3545;
  --warning-color: #fd7e14;
  
  --theme-toggle-bg: rgba(45, 45, 45, 0.9);
  --theme-toggle-bg-hover: rgba(45, 45, 45, 1);
  --theme-toggle-border: rgba(255, 255, 255, 0.2);
  --theme-toggle-text: #e0e0e0;
  --theme-toggle-shadow: rgba(0, 0, 0, 0.3);
  --theme-toggle-shadow-hover: rgba(0, 0, 0, 0.4);
}

/* Grayscale Theme */
:root.theme-grayscale {
  --bg-primary: #f0f0f0;
  --bg-secondary: #ffffff;
  --bg-tertiary: #f8f8f8;
  --text-primary: #333333;
  --text-secondary: #666666;
  --border-color: #cccccc;
  --button-primary: #666666;
  --button-secondary: #888888;
  --success-color: #555555;
  --error-color: #333333;
  --warning-color: #777777;
  
  --theme-toggle-bg: rgba(240, 240, 240, 0.9);
  --theme-toggle-bg-hover: rgba(240, 240, 240, 1);
  --theme-toggle-border: rgba(0, 0, 0, 0.2);
  --theme-toggle-text: #333333;
  --theme-toggle-shadow: rgba(0, 0, 0, 0.1);
  --theme-toggle-shadow-hover: rgba(0, 0, 0, 0.15);
  
  /* Remove all colors and make everything grayscale */
  filter: grayscale(100%);
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: var(--text-primary);
  transition: all 0.3s ease;
}

body {
  margin: 0;
  padding: 0;
  background-color: var(--bg-primary);
  transition: all 0.3s ease;
}

* {
  box-sizing: border-box;
}

button {
  cursor: pointer;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  transition: all 0.3s ease;
  background: var(--button-primary);
  color: white;
}

button:hover:not(:disabled) {
  opacity: 0.8;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
  background: var(--button-secondary);
}

input[type="text"], input[type="password"], input[type="number"] {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 14px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  transition: all 0.3s ease;
}

input[type="text"]:focus, input[type="password"]:focus, input[type="number"]:focus {
  outline: none;
  border-color: var(--button-primary);
}

.text-success {
  color: var(--success-color);
}

.text-error {
  color: var(--error-color);
}

.text-warning {
  color: var(--warning-color);
}

/* Override specific component colors for better theme support */
.theme-dark .wallet-item,
.theme-dark .wallet-info,
.theme-dark .account-details,
.theme-dark .distributor-container,
.theme-dark .rewards-container,
.theme-dark .token-balance,
.theme-dark .cards-header,
.theme-dark .wallet-content {
  background: var(--bg-secondary) !important;
  border-color: var(--border-color) !important;
  color: var(--text-primary) !important;
}

.theme-dark input,
.theme-dark select,
.theme-dark textarea {
  background: var(--bg-tertiary) !important;
  color: var(--text-primary) !important;
  border-color: var(--border-color) !important;
}

/* Additional dark mode fixes */
.theme-dark .wallet-info p,
.theme-dark .account-details p,
.theme-dark .detail-item,
.theme-dark .detail-item .label,
.theme-dark .detail-item .value,
.theme-dark strong {
  color: var(--text-primary) !important;
}

/* Fix wallet control buttons */
.theme-dark .wallet-controls button,
.theme-dark .add-wallet-btn,
.theme-dark .import-wallet-btn {
  background: var(--button-primary) !important;
  color: white !important;
  border-color: var(--button-primary) !important;
}

.theme-dark .wallet-controls button:hover,
.theme-dark .add-wallet-btn:hover,
.theme-dark .import-wallet-btn:hover {
  background: var(--button-secondary) !important;
  border-color: var(--button-secondary) !important;
}

/* Ensure gradients work in all themes */
.theme-dark .distributor-container {
  background: linear-gradient(135deg, #2d4a7a 0%, #1e3a5f 100%) !important;
}

.theme-dark .rewards-container {
  background: linear-gradient(135deg, #4a5568 0%, #2d3748 100%) !important;
}

.theme-grayscale .distributor-container,
.theme-grayscale .rewards-container {
  background: var(--bg-secondary) !important;
  border: 2px solid var(--border-color) !important;
}

/* Grayscale theme overrides */
.theme-grayscale .wallet-info,
.theme-grayscale .account-details,
.theme-grayscale .token-balance,
.theme-grayscale .cards-header {
  background: var(--bg-tertiary) !important;
  color: var(--text-primary) !important;
}

.theme-grayscale .wallet-controls button,
.theme-grayscale .add-wallet-btn,
.theme-grayscale .import-wallet-btn {
  background: var(--button-primary) !important;
  color: white !important;
  border-color: var(--button-primary) !important;
}
</style>
