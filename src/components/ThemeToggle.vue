<template>
  <div class="theme-toggle">
    <button 
      @click="cycleTheme"
      class="theme-button"
      :title="`当前: ${themeLabel}，点击切换主题`"
    >
      <span class="theme-icon">{{ themeIcon }}</span>
      <span class="theme-text">{{ themeLabel }}</span>
    </button>
  </div>
</template>

<script setup>
import { useThemeStore } from '../stores/useThemeStore.js'
import { storeToRefs } from 'pinia'

// Theme store
const themeStore = useThemeStore()
const { themeLabel, themeIcon } = storeToRefs(themeStore)
const { cycleTheme } = themeStore
</script>

<style scoped>
.theme-toggle {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 1000;
}

.theme-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--theme-toggle-bg, rgba(255, 255, 255, 0.9));
  border: 1px solid var(--theme-toggle-border, rgba(0, 0, 0, 0.1));
  border-radius: 20px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: var(--theme-toggle-text, #333);
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px var(--theme-toggle-shadow, rgba(0, 0, 0, 0.1));
  transition: all 0.3s ease;
  user-select: none;
}

.theme-button:hover {
  background: var(--theme-toggle-bg-hover, rgba(255, 255, 255, 1));
  box-shadow: 0 4px 12px var(--theme-toggle-shadow-hover, rgba(0, 0, 0, 0.15));
  transform: translateY(-1px);
}

.theme-button:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px var(--theme-toggle-shadow, rgba(0, 0, 0, 0.1));
}

.theme-icon {
  font-size: 16px;
  line-height: 1;
}

.theme-text {
  font-size: 12px;
  white-space: nowrap;
}

/* Responsive design */
@media (max-width: 768px) {
  .theme-toggle {
    top: 12px;
    right: 12px;
  }
  
  .theme-button {
    padding: 6px 10px;
    font-size: 12px;
  }
  
  .theme-icon {
    font-size: 14px;
  }
  
  .theme-text {
    font-size: 10px;
  }
}

@media (max-width: 480px) {
  .theme-button .theme-text {
    display: none;
  }
  
  .theme-button {
    padding: 8px;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    justify-content: center;
  }
}
</style>