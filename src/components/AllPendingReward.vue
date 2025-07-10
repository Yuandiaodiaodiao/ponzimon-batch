<template>
  <div class="all-pending-reward">
    <div class="rewards-container">
      <div class="rewards-header">
        <h3 class="rewards-title">总待领取奖励</h3>
        <button 
          @click="refreshAllRewards" 
          :disabled="refreshing"
          class="refresh-all-btn"
          title="刷新所有钱包的待领取奖励"
        >
          {{ refreshing ? '刷新中...' : '🔄 刷新全部' }}
        </button>
      </div>
      
      <div class="rewards-display">
        <div v-if="totalPendingRewards > 0" class="has-total-rewards">
          <span class="total-text">
            总计待领取: 
            <span class="total-amount">{{ formattedTotalPendingRewards }}</span>
            <span class="token-symbol">$POKE</span>
          </span>
          <div class="wallet-count">
            来自 {{ walletsWithRewards }} 个钱包
          </div>
        </div>
        
        <div v-else-if="hasInitializedWallets" class="no-total-rewards">
          <span class="no-rewards-text">暂无待领取奖励</span>
        </div>
        
        <div v-else class="no-wallets">
          <span class="no-wallets-text">尚未初始化任何钱包</span>
        </div>
      </div>
      
      <!-- Detailed breakdown -->
      <div v-if="showDetails && pendingRewardsArray.length > 0" class="rewards-breakdown">
        <div class="breakdown-header">
          <h4>详细分布</h4>
          <button @click="showDetails = false" class="close-details-btn">×</button>
        </div>
        <div class="breakdown-list">
          <div 
            v-for="item in pendingRewardsArray" 
            :key="item.index"
            class="breakdown-item"
          >
            <span class="wallet-info">
              钱包 {{ item.index + 1 }}
              <span class="wallet-address">({{ formatAddress(item.wallet.publicKey) }})</span>
            </span>
            <span class="reward-amount">{{ formatRewards(item.rewards) }} $POKE</span>
          </div>
        </div>
      </div>
      
      <div v-if="!showDetails && pendingRewardsArray.length > 0" class="show-details">
        <button @click="showDetails = true" class="show-details-btn">
          查看详细分布 ({{ pendingRewardsArray.length }} 个钱包)
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useWalletStore } from '../stores/useWalletStore.js'
import { storeToRefs } from 'pinia'

// Store
const walletStore = useWalletStore()
const { wallets, pendingRewards, totalPendingRewards, formattedTotalPendingRewards } = storeToRefs(walletStore)

// State
const refreshing = ref(false)
const showDetails = ref(false)

// Computed
const hasInitializedWallets = computed(() => {
  return wallets.value.some(wallet => wallet.accountInitialized && wallet.tools)
})

const pendingRewardsArray = computed(() => {
  const results = []
  for (const [walletIndex, rewards] of pendingRewards.value) {
    if (rewards > 0 && walletIndex < wallets.value.length) {
      results.push({
        index: walletIndex,
        wallet: wallets.value[walletIndex],
        rewards: rewards
      })
    }
  }
  return results.sort((a, b) => b.rewards - a.rewards) // Sort by rewards descending
})

const walletsWithRewards = computed(() => {
  return pendingRewardsArray.value.length
})

// Methods
const formatRewards = (amount) => {
  return Number(amount).toLocaleString('en-US', { 
    minimumFractionDigits: 3, 
    maximumFractionDigits: 6 
  })
}

const formatAddress = (address) => {
  if (!address) return 'Unknown'
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

const refreshAllRewards = async () => {
  if (refreshing.value) return
  
  refreshing.value = true
  console.log('Refreshing all pending rewards...')
  
  try {
    const initWallets = wallets.value.filter(wallet => 
      wallet.accountInitialized && wallet.tools && !wallet.loading
    )
    
    if (initWallets.length === 0) {
      console.log('No initialized wallets to refresh')
      return
    }
    
    console.log(`Refreshing pending rewards for ${initWallets.length} wallets`)
    
    // Find all PendingReward components and refresh them
    const pendingRewardComponents = document.querySelectorAll('[data-pending-reward]')
    
    // Alternative approach: trigger refresh through wallet operations
    for (let i = 0; i < wallets.value.length; i++) {
      const wallet = wallets.value[i]
      if (wallet.accountInitialized && wallet.tools && !wallet.loading) {
        try {
          console.log(`Calculating pending rewards for wallet ${i + 1}`)
          const result = await wallet.tools.getPendingRewards()
          if (result.success) {
            walletStore.updatePendingRewards(i, result.rewards)
          } else {
            walletStore.updatePendingRewards(i, 0)
          }
        } catch (error) {
          console.error(`Failed to refresh pending rewards for wallet ${i + 1}:`, error)
          walletStore.updatePendingRewards(i, 0)
        }
      }
    }
    
    console.log('All pending rewards refreshed')
  } catch (error) {
    console.error('Failed to refresh all pending rewards:', error)
  } finally {
    refreshing.value = false
  }
}
</script>

<style scoped>
.all-pending-reward {
  margin: 16px 0;
  padding: 0 8px;
}

.rewards-container {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  padding: 16px;
  color: white;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.rewards-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.rewards-title {
  margin: 0;
  font-size: 18px;
  font-weight: bold;
  color: white;
}

.refresh-all-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
}

.refresh-all-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

.refresh-all-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.rewards-display {
  text-align: center;
  padding: 8px 0;
}

.has-total-rewards {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.total-text {
  font-size: 20px;
  font-weight: bold;
}

.total-amount {
  font-size: 24px;
  color: #ffd700;
  font-family: monospace;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

.token-symbol {
  color: #ffeb3b;
  font-weight: bold;
  margin-left: 4px;
}

.wallet-count {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  font-style: italic;
}

.no-total-rewards,
.no-wallets {
  padding: 12px;
}

.no-rewards-text,
.no-wallets-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  font-style: italic;
}

.show-details {
  text-align: center;
  margin-top: 12px;
}

.show-details-btn {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 4px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.2s ease;
}

.show-details-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.rewards-breakdown {
  margin-top: 16px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  padding: 12px;
}

.breakdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.breakdown-header h4 {
  margin: 0;
  font-size: 14px;
  color: white;
}

.close-details-btn {
  background: none;
  color: white;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.close-details-btn:hover {
  color: #ff6b6b;
}

.breakdown-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.breakdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  font-size: 12px;
}

.wallet-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wallet-address {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.7);
  font-family: monospace;
}

.breakdown-item .reward-amount {
  font-family: monospace;
  font-weight: bold;
  color: #ffd700;
}
</style>