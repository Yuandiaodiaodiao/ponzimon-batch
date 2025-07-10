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
const { loadConfig, applyPreset } = networkStore

// Wallet storage
const walletStore = useWalletStore()
const { loadWallets } = walletStore

// Wallet operations
const walletOperationsStore = useWalletOperationsStore()
const { initializeWallet } = walletOperationsStore

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