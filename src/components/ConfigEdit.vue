<template>
  <div class="config-edit">
    <span>测试服 https://ponzimon-farm-test.vercel.app/</span>
    <span>领水 https://solfaucet.com/</span>
    <span>领水2 https://faucet.solana.com//</span>
    
    <div class="preset-buttons">
      <button @click="applyPreset('devnet')" :class="{ active: currentNetwork === 'devnet' }">
        Devnet
      </button>
      <button @click="applyPreset('mainnet')" :class="{ active: currentNetwork === 'mainnet' }">
        Mainnet
      </button>
    </div>
    
    <!-- Master Wallet Configuration -->
    <div class="master-wallet-config">
      <h4>主钱包配置 (代付交易费用)</h4>
      <div class="master-wallet-toggle">
        <label>
          <input 
            type="checkbox" 
            v-model="masterWalletStore.isEnabled" 
            @change="handleMasterWalletToggle"
          />
          启用主钱包代付
        </label>
        <span v-if="masterWalletStore.isReady" class="status success">
          ✓ 已就绪 ({{ masterWalletStore.balance.toFixed(4) }} SOL)
        </span>
        <span v-else-if="masterWalletStore.isEnabled" class="status warning">
          ⚠ 需要配置
        </span>
      </div>
      
      <div v-if="masterWalletStore.isEnabled" class="master-wallet-inputs">
        <div class="input-group">
          <label>主钱包私钥:</label>
          <input 
            v-model="masterPrivateKeyInput"
            type="password"
            placeholder="主钱包私钥 (Base58)"
            @blur="handlePrivateKeyUpdate"
          />
        </div>
        
        <div v-if="masterWalletStore.publicKey" class="master-wallet-info">
          <div class="info-item">
            <label>公钥:</label>
            <span class="monospace">{{ masterWalletStore.publicKey }}</span>
          </div>
          <div class="info-item">
            <label>余额:</label>
            <span :class="balanceClass">{{ masterWalletStore.balance.toFixed(4) }} SOL</span>
            <button @click="refreshBalance" class="refresh-btn" :disabled="refreshing">
              {{ refreshing ? '刷新中...' : '刷新' }}
            </button>
          </div>
        </div>
        
        <div v-if="masterWalletError" class="error-message">
          {{ masterWalletError }}
        </div>
      </div>
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
        <label>推荐人钱包:</label>
        <input v-model="config.referrerWallet" placeholder="Referrer Wallet" />
      </div>
      <div class="input-group">
        <label>claim归集地址:</label>
        <input v-model="config.recipientAccount" placeholder="Recipient Address" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useNetworkStore } from '../stores/useNetworkStore'
import { useMasterWalletStore } from '../stores/useMasterWalletStore'
import { storeToRefs } from 'pinia'

// Stores
const networkStore = useNetworkStore()
const masterWalletStore = useMasterWalletStore()

const { currentNetwork, config } = storeToRefs(networkStore)
const { applyPreset } = networkStore

// Master wallet state
const masterPrivateKeyInput = ref('')
const masterWalletError = ref('')
const refreshing = ref(false)

// Computed
const balanceClass = computed(() => {
  if (masterWalletStore.balance < 0.01) return 'balance-low'
  if (masterWalletStore.balance < 0.1) return 'balance-medium'
  return 'balance-good'
})

// Methods
const handleMasterWalletToggle = () => {
  if (!masterWalletStore.isEnabled) {
    masterPrivateKeyInput.value = ''
    masterWalletError.value = ''
  }
}

const handlePrivateKeyUpdate = async () => {
  if (!masterPrivateKeyInput.value.trim()) {
    masterWalletStore.setMasterPrivateKey('')
    masterWalletError.value = ''
    return
  }
  
  try {
    masterWalletError.value = ''
    masterWalletStore.setMasterPrivateKey(masterPrivateKeyInput.value.trim())
  } catch (error) {
    masterWalletError.value = error.message
    console.error('Master wallet configuration error:', error)
  }
}

const refreshBalance = async () => {
  if (!masterWalletStore.isReady) return
  
  try {
    refreshing.value = true
    await masterWalletStore.updateBalance()
  } catch (error) {
    masterWalletError.value = `Failed to refresh balance: ${error.message}`
  } finally {
    refreshing.value = false
  }
}

// Watch for config changes to reinitialize master wallet
watch(
  () => networkStore.config,
  () => {
    if (masterWalletStore.isEnabled && masterWalletStore.hasValidPrivateKey) {
      masterWalletStore.initializeMasterWallet().catch(error => {
        masterWalletError.value = error.message
      })
    }
  },
  { deep: true }
)

// Initialize
onMounted(() => {
  masterPrivateKeyInput.value = masterWalletStore.masterPrivateKey
})
</script>

<style scoped>
.config-edit {
  margin-bottom: 8px;
  padding: 6px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.preset-buttons {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
}

.preset-buttons button {
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  border-radius: 3px;
  font-size: 12px;
  transition: all 0.3s ease;
}

.preset-buttons button:hover:not(.active) {
  background: var(--bg-tertiary);
}

.preset-buttons button.active {
  background: var(--button-primary);
  color: white;
  border-color: var(--button-primary);
}

.master-wallet-config {
  margin: 12px 0;
  padding: 8px;
  border: 1px solid #4a5568;
  border-radius: 4px;
  background: rgba(74, 85, 104, 0.1);
}

.master-wallet-config h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: var(--text-primary);
}

.master-wallet-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.master-wallet-toggle label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  cursor: pointer;
}

.status {
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 3px;
}

.status.success {
  background: rgba(72, 187, 120, 0.2);
  color: #48bb78;
}

.status.warning {
  background: rgba(237, 137, 54, 0.2);
  color: #ed8936;
}

.master-wallet-inputs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.master-wallet-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.info-item label {
  font-weight: bold;
  min-width: 40px;
}

.monospace {
  font-family: 'Courier New', monospace;
  font-size: 11px;
}

.balance-good { color: #48bb78; }
.balance-medium { color: #ed8936; }
.balance-low { color: #f56565; }

.refresh-btn {
  padding: 2px 6px;
  font-size: 11px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-radius: 3px;
  cursor: pointer;
  margin-left: 8px;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  padding: 4px 6px;
  background: rgba(245, 101, 101, 0.1);
  border: 1px solid #f56565;
  border-radius: 3px;
  color: #f56565;
  font-size: 12px;
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
  color: var(--text-primary);
}

.input-group input {
  padding: 3px 4px;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  font-size: 12px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  transition: all 0.3s ease;
}

.input-group input:focus {
  border-color: var(--button-primary);
}

.input-group input[type="password"] {
  font-family: monospace;
}
</style>