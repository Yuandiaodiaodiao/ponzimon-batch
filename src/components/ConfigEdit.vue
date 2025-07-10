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
import { useNetworkStore } from '../stores/useNetworkStore'
import { storeToRefs } from 'pinia'

// Use the network store directly
const networkStore = useNetworkStore()
const { currentNetwork, config } = storeToRefs(networkStore)
const { applyPreset } = networkStore
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
</style>