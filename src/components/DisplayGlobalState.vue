<template>
  <div class="display-global-state">
    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <p>Loading global state...</p>
    </div>
    
    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <p>Error: {{ error }}</p>
      <button @click="refreshGlobalState" class="retry-btn">Retry</button>
    </div>
    
    <!-- Global State Display -->
    <div v-else-if="isLoaded" class="global-state-container">
      <div class="refresh-controls">
        <button @click="refreshGlobalState" :disabled="loading" class="refresh-btn">
          {{ loading ? 'Refreshing...' : '= Refresh Global State' }}
        </button>
        <span v-if="lastUpdated" class="last-updated">
          Last updated: {{ formatTime(lastUpdated) }}
        </span>
      </div>
      
      <GlobalState>
        <template #claimedPoke>{{ formattedStats?.cumulativeRewards || '0' }}</template>
        <template #burnedPoke>{{ formattedStats?.burnedTokens || '0' }}</template>
        <template #allEatFood>{{ formattedStats?.totalBerries || '0' }}</template>
        <template #packOpened>{{ formattedStats?.totalBoosterPacksOpened || '0' }}</template>
        <template #recycleAttempts>{{ gameStatistics?.recyclingAttempts || '0' }}</template>
        <template #burnRate>{{ formattedStats?.burnRate || '0' }}</template>
        <template #referralRate>{{ formattedStats?.referralFee || '0' }}</template>
        <template #myPowerOfTotal>{{ calculateMyPowerPercentage() }}</template>
      </GlobalState>
      
      <!-- Additional Stats Section -->
      <div class="additional-stats">
        <h3>Game Statistics</h3>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="label">Total Hashpower:</span>
            <span class="value">{{ formattedStats?.totalHashpower || '0' }}</span>
          </div>
          <div class="stat-item">
            <span class="label">Total Staked Tokens:</span>
            <span class="value">{{ formattedStats?.totalStakedTokens || '0' }} $POKE</span>
          </div>
          <div class="stat-item">
            <span class="label">Total SOL Deposited:</span>
            <span class="value">{{ formattedStats?.totalSolDeposited || '0' }} SOL</span>
          </div>
          <div class="stat-item">
            <span class="label">Gambling Win Rate:</span>
            <span class="value">{{ gameStatistics?.winRate || '0%' }}</span>
          </div>
          <div class="stat-item">
            <span class="label">Recycling Success Rate:</span>
            <span class="value">{{ gameStatistics?.recyclingSuccessRate || '0%' }}</span>
          </div>
          <div class="stat-item">
            <span class="label">Production Enabled:</span>
            <span class="value">{{ formattedStats?.productionEnabled ? 'Yes' : 'No' }}</span>
          </div>
        </div>
      </div>
      
      <!-- Economic Data Section -->
      <div class="economic-data">
        <h3>Economic Parameters</h3>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="label">Booster Pack Cost:</span>
            <span class="value">{{ economicData?.boosterCost || '0' }} $POKE</span>
          </div>
          <div class="stat-item">
            <span class="label">Farm Purchase Fee:</span>
            <span class="value">{{ economicData?.farmPurchaseFee || '0' }} SOL</span>
          </div>
          <div class="stat-item">
            <span class="label">Gamble Fee:</span>
            <span class="value">{{ economicData?.gambleFee || '0' }} SOL</span>
          </div>
          <div class="stat-item">
            <span class="label">Reward Rate:</span>
            <span class="value">{{ economicData?.rewardRate || '0' }}</span>
          </div>
          <div class="stat-item">
            <span class="label">Token Reward Rate:</span>
            <span class="value">{{ economicData?.tokenRewardRate || '0' }}</span>
          </div>
          <div class="stat-item">
            <span class="label">Cooldown Slots:</span>
            <span class="value">{{ economicData?.cooldownSlots || '0' }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Not Loaded State -->
    <div v-else class="not-loaded-state">
      <p>Global state not loaded</p>
      <button @click="fetchGlobalState" class="load-btn">Load Global State</button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useGlobalStateStore } from '../stores/useGlobalStateStore.js'
import { useWalletStore } from '../stores/useWalletStore.js'
import { storeToRefs } from 'pinia'
import GlobalState from './ui/GlobalState.vue'

// Stores
const globalStateStore = useGlobalStateStore()
const walletStore = useWalletStore()

// Destructure state and actions
const { 
  globalState, 
  loading, 
  error, 
  lastUpdated, 
  isLoaded, 
  formattedStats, 
  gameStatistics, 
  economicData 
} = storeToRefs(globalStateStore)

const { 
  fetchGlobalState, 
  refreshGlobalState 
} = globalStateStore

const { wallets } = storeToRefs(walletStore)

// Calculate user's total hashpower percentage
const calculateMyPowerPercentage = () => {
  if (!formattedStats.value?.totalHashpower || !wallets.value.length) {
    return '0.00'
  }
  
  // Sum up all user's hashpower
  const userTotalHashpower = wallets.value.reduce((total, wallet) => {
    console.log('wallet.accountInfo',wallet.accountInfo)
    if (wallet.accountInfo?.totalHashpower) {
      return total + Number(wallet.accountInfo.totalHashpower)
    }
    return total
  }, 0)
  console.log('userTotalHashpower',userTotalHashpower)
  console.log('globalState.value',globalState.value)
 
  
  return userTotalHashpower
}

// Format time helper
const formatTime = (date) => {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// Load global state on mount
onMounted(() => {
  if (!isLoaded.value) {
    fetchGlobalState().catch(err => {
      console.error('Failed to load global state on mount:', err)
    })
  }
})
</script>

<style scoped>
.display-global-state {
  margin: 8px 0;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #f8f9fa;
}

.loading-state,
.error-state,
.not-loaded-state {
  text-align: center;
  padding: 16px;
}

.error-state {
  color: #dc3545;
}

.retry-btn,
.load-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 3px;
  cursor: pointer;
  margin-top: 8px;
}

.retry-btn:hover,
.load-btn:hover {
  background: #0056b3;
}

.global-state-container {
  space-y: 16px;
}

.refresh-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e9ecef;
}

.refresh-btn {
  background: #28a745;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
}

.refresh-btn:hover:not(:disabled) {
  background: #218838;
}

.refresh-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.last-updated {
  font-size: 11px;
  color: #6c757d;
}

.additional-stats,
.economic-data {
  margin-top: 16px;
  padding: 12px;
  background: white;
  border-radius: 4px;
  border: 1px solid #e9ecef;
}

.additional-stats h3,
.economic-data h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: bold;
  color: #333;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 12px;
}

.stat-item .label {
  font-weight: bold;
  color: #666;
}

.stat-item .value {
  color: #333;
  font-family: monospace;
}
</style>