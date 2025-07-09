<template>
  <div class="solana-wallet-manager">
    <!-- Network Configuration -->
    <div class="network-config">
      <div class="preset-buttons">
        <button @click="applyPreset('devnet')" :class="{ active: currentNetwork === 'devnet' }">
          Devnet
        </button>
        <button @click="applyPreset('mainnet')" :class="{ active: currentNetwork === 'mainnet' }">
          Mainnet
        </button>
      </div>
      
      <div class="config-inputs">
        <div class="input-group">
          <label>RPC:</label>
          <input v-model="config.rpcUrl" placeholder="RPC URL" />
        </div>
        <div class="input-group">
          <label>Program:</label>
          <input v-model="config.programId" placeholder="Program ID" />
        </div>
        <div class="input-group">
          <label>tokenMint:</label>
          <input v-model="config.tokenMint" placeholder="Token Mint" />
        </div>
        <div class="input-group">
          <label>feesWallet:</label>
          <input v-model="config.feesWallet" placeholder="Fees Wallet" />
        </div>
        <div class="input-group">
          <label>claim归集地址:</label>
          <input v-model="config.recipientAccount" placeholder="Recipient Address" />
        </div>
      </div>
    </div>

    <!-- Wallet List -->
    <div class="wallet-list">
      <h2>Wallet List</h2>
      <div class="wallet-controls">
        <button @click="handleAddWallet">Add</button>
        <button @click="handleBatchInitGameAccounts" :disabled="!canBatchInit || batchLoading" class="batch-init">
          {{ batchLoading ? 'Processing...' : `一键开户(${availableForInit})` }}
        </button>
        <button @click="clearAllWallets" class="danger">Clear</button>
      </div>
      
      <div class="wallet-grid">
        <div v-for="(wallet, index) in wallets" :key="wallet.id" class="wallet-item">
        <div class="wallet-header">
          <h3>W{{ index + 1 }}</h3>
          <button @click="removeWallet(index)" class="remove-btn">×</button>
        </div>
        
        <div class="wallet-content">
          <div class="input-group">
            <label>Private Key:</label>
            <input 
              v-model="wallet.privateKey" 
              type="text" 
              placeholder="Private key"
              readonly
              style="background-color: #f5f5f5;"
            />
          </div>
          
          <div v-if="wallet.publicKey" class="wallet-info">
            <p><strong>Public:</strong> {{ wallet.publicKey.slice(0, 20) }}...</p>
            <p><strong>Status:</strong> {{ wallet.status }}</p>
          </div>
          
          <!-- Show loading state if first query not done -->
          <div v-if="!wallet.firstQueryDone" class="wallet-loading">
            <p>Loading wallet status...</p>
          </div>
          
          <!-- Only show actions after first query -->
          <div v-else class="wallet-actions">
            <button @click="queryCards(index)" :disabled="!wallet.tools || wallet.loading">
              {{ wallet.loading ? '...' : '刷新' }}
            </button>
            
            <button 
              v-if="!wallet.accountInitialized"
              @click="initGameAccount(index)" 
              :disabled="!wallet.tools || wallet.loading"
            >
              {{ wallet.loading ? '...' : '开户' }}
            </button>
            
            <template v-if="wallet.accountInitialized">
              <button @click="openBooster(index)" :disabled="!wallet.tools || wallet.loading">
                {{ wallet.loading ? '...' : '开箱' }}
              </button>
              <button @click="claimReward(index)" :disabled="!wallet.tools || wallet.loading">
                {{ wallet.loading ? '...' : 'Claim' }}
              </button>
            </template>
          </div>
          
          <div v-if="wallet.accountInfo" class="account-details">
            <h4>Account</h4>
            <div class="details-grid">
              <div class="detail-item">
                <span class="label">Berries:</span>
                <span class="value">{{ wallet.accountInfo.berries }}</span>
              </div>
              <div class="detail-item">
                <span class="label">Hash:</span>
                <span class="value">{{ wallet.accountInfo.totalHashpower }}</span>
              </div>
              <div class="detail-item">
                <span class="label">Farm:</span>
                <span class="value">{{ wallet.accountInfo.farm?.farm_type }}</span>
              </div>
              <div class="detail-item">
                <span class="label">Cap:</span>
                <span class="value">{{ wallet.accountInfo.farm?.berry_capacity }}</span>
              </div>
            </div>
          </div>
          
          <!-- Cards List -->
          <div v-if="wallet.cards && wallet.cards.length > 0" class="cards-list">
            <div class="cards-header" @click="toggleCardsExpanded(index)">
              <h4>Cards ({{ wallet.cards.length }})</h4>
              <span class="toggle-icon">{{ wallet.cardsExpanded ? '▼' : '▶' }}</span>
            </div>
            <div v-show="wallet.cardsExpanded" class="cards-grid">
              <div 
                v-for="(card, cardIndex) in wallet.cards" 
                :key="cardIndex"
                class="card-item"
                :class="{ 
                  recyclable: card.id !== 0 && card.berry_consumption && !card.isStaked,
                  staked: card.isStaked
                }"
              >
                <div class="card-info">
                  <p><strong>ID:</strong> {{ card.id }} {{ card.isStaked ? '🔒' : '' }}</p>
                  <p><strong>R:</strong> {{ card.rarity }}</p>
                  <p><strong>Hash:</strong> {{ card.hashpower }}</p>
                  <p><strong>Cost:</strong> {{ card.berry_consumption }}</p>
                </div>
                
                <!-- Buttons for non-staked cards -->
                <div v-if="card.id !== 0 && !card.isStaked" class="card-actions">
                  <button 
                    @click="stakeCard(index, cardIndex)"
                    class="stake-btn"
                    :disabled="wallet.loading"
                  >
                    Stake
                  </button>
                  <button 
                    v-if="card.berry_consumption"
                    @click="recycleCard(index, cardIndex)"
                    class="recycle-btn"
                    :disabled="wallet.loading"
                  >
                    Recycle
                  </button>
                </div>
                
                <!-- Label for staked cards -->
                <div v-else-if="card.isStaked" class="staked-label">
                  Staked
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  </div>
</template>

<script>
import { onMounted, computed, ref } from 'vue'
import { useNetworkConfig } from '../composables/useNetworkConfig'
import { useWalletStorage } from '../composables/useWalletStorage'
import { useWalletOperations } from '../composables/useWalletOperations'

export default {
  name: 'SolanaWalletManager',
  setup() {
    // Network configuration
    const { 
      currentNetwork, 
      config, 
      loadConfig, 
      applyPreset 
    } = useNetworkConfig()
    
    // Wallet storage
    const { 
      wallets, 
      loadWallets, 
      saveWallets, 
      addWallet, 
      removeWallet, 
      clearAllWallets,
      toggleCardsExpanded 
    } = useWalletStorage()
    
    // Wallet operations
    const {
      initializeWallet,
      queryCards,
      initGameAccount,
      openBooster,
      claimReward,
      recycleCard,
      stakeCard,
      batchInitGameAccounts
    } = useWalletOperations(wallets, config, saveWallets)
    
    // Batch operation state
    const batchLoading = ref(false)
    
    // Computed properties for batch operations
    const availableForInit = computed(() => {
      return wallets.value.filter(wallet => 
        wallet.firstQueryDone && 
        !wallet.accountInitialized && 
        wallet.tools && 
        !wallet.loading
      ).length
    })
    
    const canBatchInit = computed(() => {
      return availableForInit.value > 0
    })
    
    // Handle add wallet with auto-initialization
    const handleAddWallet = async () => {
      const newWalletIndex = addWallet()
      // Automatically initialize the wallet with the generated key
      await initializeWallet(newWalletIndex)
    }
    
    // Batch initialize game accounts wrapper
    const handleBatchInitGameAccounts = async () => {
      if (!canBatchInit.value || batchLoading.value) return
      
      batchLoading.value = true
      
      try {
        await batchInitGameAccounts()
      } catch (error) {
        console.error('Batch initialization failed:', error)
      } finally {
        batchLoading.value = false
      }
    }
    
    // Initialize on mount
    onMounted(async () => {
      loadConfig()
      if (!config.rpcUrl) {
        applyPreset('devnet')
      }
      
      const loadedWallets = loadWallets(config)
      // Auto-initialize and query cards for loaded wallets
      for (let index = 0; index < loadedWallets.length; index++) {
        if (loadedWallets[index].privateKey) {
          await initializeWallet(index)
        }
      }
    })
    
    return {
      // Network config
      currentNetwork,
      config,
      applyPreset,
      
      // Wallet management
      wallets,
      handleAddWallet,
      removeWallet,
      clearAllWallets,
      toggleCardsExpanded,
      
      // Batch operations
      handleBatchInitGameAccounts,
      batchLoading,
      availableForInit,
      canBatchInit,
      
      // Wallet operations
      initializeWallet,
      queryCards,
      initGameAccount,
      openBooster,
      claimReward,
      recycleCard,
      stakeCard
    }
  }
}
</script>

<style scoped>
.solana-wallet-manager {
  max-width: 100%;
  margin: 0 auto;
  padding: 5px;
}

.network-config {
  margin-bottom: 8px;
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.preset-buttons {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
}

.preset-buttons button {
  padding: 4px 8px;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
  border-radius: 3px;
  font-size: 12px;
}

.preset-buttons button.active {
  background: #007bff;
  color: white;
}

.config-inputs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.input-group label {
  margin-bottom: 2px;
  font-weight: bold;
  font-size: 12px;
}

.input-group input {
  padding: 3px 4px;
  border: 1px solid #ddd;
  border-radius: 3px;
  font-size: 12px;
}

.wallet-list {
  margin-top: 8px;
}

.wallet-controls {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
}

.wallet-controls button {
  padding: 4px 8px;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
  border-radius: 3px;
  font-size: 12px;
}

.wallet-controls button.danger {
  background: #dc3545;
  color: white;
}

.wallet-controls button.batch-init {
  background: #28a745;
  color: white;
  border-color: #28a745;
}

.wallet-controls button.batch-init:disabled {
  background: #6c757d;
  border-color: #6c757d;
  color: white;
  cursor: not-allowed;
}

.wallet-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.wallet-item {
  flex: 1 1 300px;
  min-width: 300px;
  max-width: 400px;
  padding: 4px;
  border: 1px solid #ddd;
  border-radius: 3px;
  box-sizing: border-box;
}

.wallet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.remove-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 2px 6px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 10px;
}

.wallet-info {
  margin: 3px 0;
  padding: 4px;
  background: #f8f9fa;
  border-radius: 3px;
  font-size: 12px;
}

.wallet-loading {
  margin: 4px 0;
  padding: 6px;
  text-align: center;
  background: #f8f9fa;
  border-radius: 3px;
}

.wallet-loading p {
  margin: 0;
  color: #666;
  font-style: italic;
  font-size: 12px;
}

.wallet-actions {
  display: flex;
  gap: 4px;
  margin: 4px 0;
}

.wallet-actions button {
  padding: 3px 6px;
  border: 1px solid #007bff;
  background: #007bff;
  color: white;
  cursor: pointer;
  border-radius: 3px;
  font-size: 11px;
}

.wallet-actions button:disabled {
  background: #6c757d;
  border-color: #6c757d;
  cursor: not-allowed;
}

.account-details {
  margin-top: 4px;
  padding: 4px;
  background: #f8f9fa;
  border-radius: 3px;
}

.account-details h4 {
  margin: 0 0 3px 0;
  color: #333;
  font-size: 12px;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 3px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  padding: 1px 0;
  font-size: 11px;
}

.detail-item .label {
  font-weight: bold;
  color: #666;
}

.detail-item .value {
  color: #333;
}

.cards-list {
  margin-top: 4px;
}

.cards-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  padding: 4px;
  background: #f8f9fa;
  border-radius: 3px;
  margin-bottom: 3px;
  user-select: none;
}

.cards-header:hover {
  background: #e9ecef;
}

.cards-header h4 {
  margin: 0;
  font-size: 12px;
}

.toggle-icon {
  font-size: 8px;
  transition: transform 0.2s;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 3px;
  margin-top: 3px;
}

.card-item {
  padding: 4px;
  border: 1px solid #ddd;
  border-radius: 3px;
  background: white;
}

.card-item.recyclable {
  border-color: #28a745;
  background: #f8fff8;
}

.card-item.staked {
  border-color: #ffc107;
  background: #fffdf0;
}

.card-info p {
  margin: 1px 0;
  font-size: 10px;
}

.card-actions {
  display: flex;
  gap: 2px;
  margin-top: 2px;
}

.stake-btn {
  flex: 1;
  padding: 2px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 10px;
}

.stake-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.recycle-btn {
  flex: 1;
  padding: 2px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 10px;
}

.recycle-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.staked-label {
  width: 100%;
  padding: 2px;
  background: #ffc107;
  color: #333;
  text-align: center;
  border-radius: 3px;
  margin-top: 2px;
  font-size: 10px;
  font-weight: bold;
}
</style>