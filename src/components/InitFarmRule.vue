<template>
  <div class="init-farm-rule">
    <label for="farm-strategy" class="strategy-label">开户策略:</label>
    <select 
      id="farm-strategy"
      v-model="selectedStrategy"
      class="strategy-select"
      @change="handleStrategyChange"
    >
      <option value="stake_12">开户+质押1 2</option>
      <option value="stake_recycle_stake">开户+质押1+回收1+质押1</option>
    </select>
    <span class="current-selection">当前: {{ getStrategyLabel(selectedStrategy) }}</span>
  </div>
</template>

<script setup>
import { useFarmRuleStore } from '../stores/useFarmRuleStore.js'
import { storeToRefs } from 'pinia'
import { onMounted } from 'vue'

const farmRuleStore = useFarmRuleStore()
const { selectedStrategy } = storeToRefs(farmRuleStore)
const { setStrategy } = farmRuleStore

const getStrategyLabel = (strategy) => {
  switch (strategy) {
    case 'stake_12':
      return '开户+质押1 2'
    case 'stake_recycle_stake':
      return '开户+质押1+回收1+质押1'
    default:
      return '未知策略'
  }
}

onMounted(() => {
  console.log('InitFarmRule mounted')
  console.log('Selected strategy:', selectedStrategy.value)
  // Ensure we have a default value
  if (!selectedStrategy.value) {
    selectedStrategy.value = 'stake_12'
  }
})

const handleStrategyChange = () => {
  setStrategy(selectedStrategy.value)
  console.log('Farm strategy changed to:', selectedStrategy.value)
}
</script>

<style scoped>
.init-farm-rule {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0;
}

.current-selection {
  font-size: 11px;
  color: #666;
  margin-left: 8px;
}

.strategy-label {
  font-size: 12px;
  font-weight: bold;
  color: #333;
  white-space: nowrap;
}

.strategy-select {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 220px;
  appearance: auto;
  -webkit-appearance: menulist;
  -moz-appearance: menulist;
}

.strategy-select:hover {
  border-color: #007bff;
}

.strategy-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}
</style>