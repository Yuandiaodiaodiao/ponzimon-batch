import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useFarmRuleStore = defineStore('farmRule', () => {
  // 开户策略选项
  const FARM_STRATEGIES = {
    STAKE_12: 'stake_12',
    STAKE_RECYCLE_STAKE: 'stake_recycle_stake'
  }

  // 策略配置
  const strategyOptions = [
    {
      value: FARM_STRATEGIES.STAKE_12,
      label: '开户+质押1 2',
      description: '开户后质押ID为1和2的卡片'
    },
    {
      value: FARM_STRATEGIES.STAKE_RECYCLE_STAKE,
      label: '开户+质押1+回收1+质押1',
      description: '开户后质押ID1，然后回收ID1，再质押新的ID1'
    }
  ]

  // 当前选中的策略，默认为开户+质押1 2
  const selectedStrategy = ref(FARM_STRATEGIES.STAKE_12)

  // 从本地存储加载策略
  const loadStrategy = () => {
    try {
      const saved = localStorage.getItem('farmStrategy')
      if (saved && Object.values(FARM_STRATEGIES).includes(saved)) {
        selectedStrategy.value = saved
      }
    } catch (error) {
      console.error('Failed to load farm strategy:', error)
    }
  }

  // 保存策略到本地存储
  const saveStrategy = () => {
    try {
      localStorage.setItem('farmStrategy', selectedStrategy.value)
    } catch (error) {
      console.error('Failed to save farm strategy:', error)
    }
  }

  // 设置策略
  const setStrategy = (strategy) => {
    if (Object.values(FARM_STRATEGIES).includes(strategy)) {
      selectedStrategy.value = strategy
    }
  }

  // 获取当前策略的配置
  const getCurrentStrategyConfig = () => {
    return strategyOptions.find(option => option.value === selectedStrategy.value)
  }

  // 监听策略变化并自动保存
  watch(selectedStrategy, () => {
    saveStrategy()
  })

  // 初始化时加载策略
  loadStrategy()

  return {
    // State
    selectedStrategy,
    strategyOptions,
    FARM_STRATEGIES,
    
    // Actions
    setStrategy,
    getCurrentStrategyConfig,
    loadStrategy,
    saveStrategy
  }
})