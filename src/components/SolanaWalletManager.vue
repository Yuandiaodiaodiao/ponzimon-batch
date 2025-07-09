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
          <label>RPC URL:</label>
          <input v-model="config.rpcUrl" placeholder="RPC URL" />
        </div>
        <div class="input-group">
          <label>Program ID:</label>
          <input v-model="config.programId" placeholder="Program ID" />
        </div>
        <div class="input-group">
          <label>Token Mint:</label>
          <input v-model="config.tokenMint" placeholder="Token Mint" />
        </div>
        <div class="input-group">
          <label>Fees Wallet:</label>
          <input v-model="config.feesWallet" placeholder="Fees Wallet" />
        </div>
        <div class="input-group">
          <label>邀请人钱包:</label>
          <input v-model="config.referrerWallet" placeholder="Referrer Wallet" />
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
        <button @click="addWallet">Add Wallet</button>
        <button @click="clearAllWallets" class="danger">Clear All</button>
      </div>
      
      <div v-for="(wallet, index) in wallets" :key="wallet.id" class="wallet-item">
        <div class="wallet-header">
          <h3>Wallet {{ index + 1 }}</h3>
          <button @click="removeWallet(index)" class="remove-btn">Remove</button>
        </div>
        
        <div class="wallet-content">
          <div class="input-group">
            <label>Private Key:</label>
            <input 
              v-model="wallet.privateKey" 
              type="password" 
              placeholder="Enter private key"
              @blur="initializeWallet(index)"
            />
          </div>
          
          <div v-if="wallet.publicKey" class="wallet-info">
            <p><strong>Public Key:</strong> {{ wallet.publicKey }}</p>
            <p><strong>Status:</strong> {{ wallet.status }}</p>
          </div>
          
          <div class="wallet-actions">
            <button @click="initGameAccount(index)" :disabled="!wallet.tools || wallet.loading">
              {{ wallet.loading ? 'Processing...' : '开户+质押0 1' }}
            </button>
            <button @click="openBooster(index)" :disabled="!wallet.tools || wallet.loading">
              {{ wallet.loading ? 'Processing...' : '开箱一次' }}
            </button>
            <button @click="claimReward(index)" :disabled="!wallet.tools || wallet.loading">
              {{ wallet.loading ? 'Processing...' : 'Claim Reward' }}
            </button>
            <button @click="queryCards(index)" :disabled="!wallet.tools || wallet.loading">
              {{ wallet.loading ? 'Processing...' : 'List Cards' }}
            </button>
          </div>
          
          <!-- Cards List -->
          <div v-if="wallet.cards && wallet.cards.length > 0" class="cards-list">
            <h4>Cards ({{ wallet.cards.length }})</h4>
            <div class="cards-grid">
              <div 
                v-for="(card, cardIndex) in wallet.cards" 
                :key="cardIndex"
                class="card-item"
                :class="{ recyclable: card.id !== 0 && card.berry_consumption }"
              >
                <div class="card-info">
                  <p><strong>ID:</strong> {{ card.id }}</p>
                  <p><strong>Rarity:</strong> {{ card.rarity }}</p>
                  <p><strong>Hashpower:</strong> {{ card.hashpower }}</p>
                  <p><strong>Berry Cost:</strong> {{ card.berry_consumption }}</p>
                </div>
                <button 
                  v-if="card.id !== 0 && card.berry_consumption"
                  @click="recycleCard(index, cardIndex)"
                  class="recycle-btn"
                  :disabled="wallet.loading"
                >
                  Recycle
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { SolanaWalletTools } from '../utils/solanaTools.js'

export default {
  name: 'SolanaWalletManager',
  setup() {
    const currentNetwork = ref('devnet')
    const config = reactive({
      rpcUrl: '',
      programId: '',
      tokenMint: '',
      feesWallet: '',
      referrerWallet: '',
      recipientAccount: ''
    })
    
    const wallets = ref([])
    
    const presets = {
      devnet: {
        rpcUrl: 'https://cool-indulgent-mountain.solana-devnet.quiknode.pro/2ed54ae3de7c4ae7428da73509cdd97da4fa7f71/',
        programId: 'pv5gAmRb1GZ92k7iuLe5JdNmj5R8Ch61N4beuf2yEdK',
        tokenMint: 'mmMeBvEs7dmLXPJZmVQGrV3rTujsAJQHrbJVHQApgJz',
        feesWallet: '8kvqgxQG77pv6RvEou8f2kHSWi3rtx8F7MksXUqNLGmn',
        referrerWallet: 'Fw3PNkxevsJAjKtcUH8HhyzE66UWEnBWU67niiPnwF6m',
        recipientAccount: '2BhbtC6zXu5eFXfyXQ2aq6icA7xSXEeJTBUDC1ESqc9k'
      },
      mainnet: {
        rpcUrl: 'https://api.mainnet-beta.solana.com',
        programId: 'pv5gAmRb1GZ92k7iuLe5JdNmj5R8Ch61N4beuf2yEdK',
        tokenMint: 'mmMeBvEs7dmLXPJZmVQGrV3rTujsAJQHrbJVHQApgJz',
        feesWallet: '8kvqgxQG77pv6RvEou8f2kHSWi3rtx8F7MksXUqNLGmn',
        referrerWallet: 'Fw3PNkxevsJAjKtcUH8HhyzE66UWEnBWU67niiPnwF6m',
        recipientAccount: '2BhbtC6zXu5eFXfyXQ2aq6icA7xSXEeJTBUDC1ESqc9k'
      }
    }
    
    const loadFromStorage = () => {
      const savedConfig = localStorage.getItem('solana-config')
      if (savedConfig) {
        Object.assign(config, JSON.parse(savedConfig))
      }
      
      const savedWallets = localStorage.getItem('solana-wallets')
      if (savedWallets) {
        wallets.value = JSON.parse(savedWallets)
      }
      
      const savedNetwork = localStorage.getItem('solana-network')
      if (savedNetwork) {
        currentNetwork.value = savedNetwork
      }
    }
    
    const saveToStorage = () => {
      localStorage.setItem('solana-config', JSON.stringify(config))
      localStorage.setItem('solana-wallets', JSON.stringify(wallets.value.map(item=>({...item,tools:null}) )));
      localStorage.setItem('solana-network', currentNetwork.value)
    }
    
    const applyPreset = (network) => {
      currentNetwork.value = network
      Object.assign(config, presets[network])
      saveToStorage()
    }
    
    const addWallet = () => {
      const newWallet = {
        id: Date.now(),
        privateKey: '',
        publicKey: '',
        tools: null,
        status: 'Not initialized',
        loading: false,
        cards: []
      }
      wallets.value.push(newWallet)
      saveToStorage()
    }
    
    const removeWallet = (index) => {
      wallets.value.splice(index, 1)
      saveToStorage()
    }
    
    const clearAllWallets = () => {
      wallets.value = []
      saveToStorage()
    }
    
    const initializeWallet = async (index) => {
      const wallet = wallets.value[index]
      if (!wallet.privateKey) return
      
      try {
        wallet.loading = true
        wallet.tools = new SolanaWalletTools(wallet.privateKey, config)
        wallet.publicKey = wallet.tools.getPublicKey()
        wallet.status = 'Initialized'
        saveToStorage()
      } catch (error) {
        wallet.status = `Error: ${error.message}`
        console.error('Failed to initialize wallet:', error)
      } finally {
        wallet.loading = false
      }
    }
    
    const initGameAccount = async (index) => {
      const wallet = wallets.value[index]
      if (!wallet.tools) return
      
      try {
        wallet.loading = true
        wallet.status = 'Initializing game account...'
        await wallet.tools.initGameAccountTransaction()
        wallet.status = 'Game account initialized'
      } catch (error) {
        wallet.status = `Error: ${error.message}`
        console.error('Failed to initialize game account:', error)
      } finally {
        wallet.loading = false
      }
    }
    
    const openBooster = async (index) => {
      const wallet = wallets.value[index]
      if (!wallet.tools) return
      
      try {
        wallet.loading = true
        wallet.status = 'Opening booster...'
        await wallet.tools.executeOpenBoosterCommit()
        await new Promise(resolve => setTimeout(resolve, 3000))
        await wallet.tools.executeSettleOpenBooster()
        wallet.status = 'Booster opened successfully'
      } catch (error) {
        wallet.status = `Error: ${error.message}`
        console.error('Failed to open booster:', error)
      } finally {
        wallet.loading = false
      }
    }
    
    const claimReward = async (index) => {
      const wallet = wallets.value[index]
      if (!wallet.tools) return
      
      try {
        wallet.loading = true
        wallet.status = 'Claiming reward...'
        await wallet.tools.executeClaimReward()
        wallet.status = 'Reward claimed successfully'
      } catch (error) {
        wallet.status = `Error: ${error.message}`
        console.error('Failed to claim reward:', error)
      } finally {
        wallet.loading = false
      }
    }
    
    const queryCards = async (index) => {
      const wallet = wallets.value[index]
      if (!wallet.tools) return
      
      try {
        wallet.loading = true
        wallet.status = 'Querying cards...'
        wallet.cards = (await wallet.tools.getUserCards()).filter(item=>item.id!==0)
        wallet.status = `Found ${wallet.cards.length} cards`
      } catch (error) {
        wallet.status = `Error: ${error.message}`
        console.error('Failed to query cards:', error)
      } finally {
        wallet.loading = false
      }
    }
    
    const recycleCard = async (walletIndex, cardIndex) => {
      const wallet = wallets.value[walletIndex]
      if (!wallet.tools) return
      
      try {
        wallet.loading = true
        wallet.status = 'Recycling card...'
        await wallet.tools.recycleCard(cardIndex)
        wallet.status = 'Card recycled successfully'
        // Refresh cards list
        await queryCards(walletIndex)
      } catch (error) {
        wallet.status = `Error: ${error.message}`
        console.error('Failed to recycle card:', error)
      } finally {
        wallet.loading = false
      }
    }
    
    onMounted(() => {
      loadFromStorage()
      if (!config.rpcUrl) {
        applyPreset('devnet')
      }
    })
    
    return {
      currentNetwork,
      config,
      wallets,
      applyPreset,
      addWallet,
      removeWallet,
      clearAllWallets,
      initializeWallet,
      initGameAccount,
      openBooster,
      claimReward,
      queryCards,
      recycleCard
    }
  }
}
</script>

<style scoped>
.solana-wallet-manager {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.network-config {
  margin-bottom: 30px;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.preset-buttons {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.preset-buttons button {
  padding: 10px 20px;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
  border-radius: 4px;
}

.preset-buttons button.active {
  background: #007bff;
  color: white;
}

.config-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.input-group {
  display: flex;
  flex-direction: column;
}

.input-group label {
  margin-bottom: 5px;
  font-weight: bold;
}

.input-group input {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.wallet-list {
  margin-top: 30px;
}

.wallet-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.wallet-controls button {
  padding: 10px 20px;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
  border-radius: 4px;
}

.wallet-controls button.danger {
  background: #dc3545;
  color: white;
}

.wallet-item {
  margin-bottom: 30px;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.wallet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.remove-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 5px 10px;
  border-radius: 4px;
  cursor: pointer;
}

.wallet-info {
  margin: 10px 0;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
}

.wallet-actions {
  display: flex;
  gap: 10px;
  margin: 15px 0;
}

.wallet-actions button {
  padding: 8px 16px;
  border: 1px solid #007bff;
  background: #007bff;
  color: white;
  cursor: pointer;
  border-radius: 4px;
}

.wallet-actions button:disabled {
  background: #6c757d;
  border-color: #6c757d;
  cursor: not-allowed;
}

.cards-list {
  margin-top: 20px;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
  margin-top: 10px;
}

.card-item {
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
}

.card-item.recyclable {
  border-color: #28a745;
  background: #f8fff8;
}

.card-info p {
  margin: 5px 0;
  font-size: 14px;
}

.recycle-btn {
  width: 100%;
  padding: 5px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 10px;
}

.recycle-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}
</style>