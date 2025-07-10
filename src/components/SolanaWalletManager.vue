<template>
  <div class="solana-wallet-manager">
    <!-- Network Configuration -->
     <TokenPriceDisplay />
    <ConfigEdit />

    <!-- Wallet List -->
    <WalletList />
    
    <!-- SOL Distributor -->
    <SolDistributor />
    
    <GlobalState />
    
    <!-- All Pending Rewards Summary -->
    <!-- <AllPendingReward /> -->
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useNetworkStore } from '../stores/useNetworkStore'
import { useWalletStore } from '../stores/useWalletStore'
import { useWalletOperationsStore } from '../stores/useWalletOperationsStore'
import { storeToRefs } from 'pinia'
import ConfigEdit from './ConfigEdit.vue'
import WalletList from './WalletList.vue'
import TokenPriceDisplay from './TokenPriceDisplay.vue'
import SolDistributor from './SolDistributor.vue'
import GlobalState from './DisplayGlobalState.vue'
import AllPendingReward from './AllPendingReward.vue'

// Network configuration
const networkStore = useNetworkStore()
const { config } = storeToRefs(networkStore)
const { loadConfig, applyPreset, onConfigChange } = networkStore

// Wallet storage
const walletStore = useWalletStore()
const { wallets } = storeToRefs(walletStore)
const { loadWallets } = walletStore

// Wallet operations
const walletOperationsStore = useWalletOperationsStore()
const { initializeWallet } = walletOperationsStore

// Reinitialize all wallets with new config
const reinitializeAllWallets = async (newConfig) => {
  console.log('Reinitializing all wallets with new config:', newConfig)
  
  if (!newConfig.rpcUrl) {
    console.log('No RPC URL in new config, skipping reinitialization')
    return
  }
  
  for (let index = 0; index < wallets.value.length; index++) {
    const wallet = wallets.value[index]
    if (wallet.privateKey) {
      try {
        console.log(`Reinitializing wallet ${index + 1}`)
        
        // Clear current status
        wallet.status = 'Updating configuration...'
        wallet.loading = true
        wallet.tools = null
        wallet.firstQueryDone = false
        wallet.accountInitialized = false
        wallet.accountInfo = null
        wallet.cards = []
        wallet.tokenBalance = '0'
        wallet.solBalance = 0
        
        // Reinitialize with new config
        await initializeWallet(index)
        
      } catch (error) {
        console.error(`Failed to reinitialize wallet ${index + 1}:`, error)
        wallet.status = `Config update failed: ${error.message}`
        wallet.loading = false
        wallet.firstQueryDone = true
      }
    }
  }
  
  console.log('All wallets reinitialized')
}

// Initialize on mount
onMounted(async () => {
  try {
    console.log('Initializing application...')
    const configx = config.value
    loadConfig()
    console.log('Current config:', configx)
    
    if (!configx.rpcUrl) {
      console.log('No RPC URL found, applying devnet preset')
      applyPreset('devnet')
    }
    
    // Register config change callback
    onConfigChange(reinitializeAllWallets)
    
    console.log('Loading existing wallets...')
    const loadedWallets = loadWallets(configx)
    console.log('Loaded wallets:', loadedWallets.length)
    
    Promise.all(loadedWallets.map(async (wallet,index) => {
      if (wallet.privateKey) {
        console.log(`Auto-initializing wallet ${index}`)
        try {
          await initializeWallet(index)
        } catch (error) {
          console.error(`Failed to initialize wallet ${index}:`, error)
        }
      }
    }))

    console.log('Application initialization complete')
  } catch (error) {
    console.error('Failed to initialize application:', error)
  }
})
</script>

<style scoped>
.solana-wallet-manager {
  max-width: 100%;
  margin: 0 auto;
  padding: 5px;
}
</style>