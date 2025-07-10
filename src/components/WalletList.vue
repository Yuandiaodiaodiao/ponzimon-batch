<template>
  <div class="wallet-list">
    <!-- Operation Bar -->
    <OperationBar />
    
    <div class="wallet-grid">
      <WalletListItem
        v-for="(wallet, index) in wallets"
        :key="wallet.id"
        :wallet="wallet"
        :index="index"
      />
    </div>
  </div>
</template>

<script setup>
import { useWalletStore } from '../stores/useWalletStore'
import { storeToRefs } from 'pinia'
import WalletListItem from './WalletListItem.vue'
import OperationBar from './OperationBar.vue'

// Wallet storage
const walletStore = useWalletStore()
const { wallets } = storeToRefs(walletStore)
</script>

<style scoped>
.wallet-list {
  margin-top: 8px;
}

.wallet-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
</style>