<template>
  <div class="wallet-item">
    <div class="wallet-content">
      <div class="input-group">
        <div class="flex justify-between">
          <label>Private Key:</label>    
          <div>
            <button @click="handleRemoveWallet(index)" class="remove-btn">×</button>
          </div>  
        </div>
       

        <input 
          v-model="wallet.privateKey" 
          type="text" 
          placeholder="Private key"
          readonly
          style="background-color: #f5f5f5;"
        />
      </div>
      
      <div v-if="wallet.publicKey" class="wallet-info">
        <p class="public-key-container">
          <strong>Public:</strong>
         
          <span 
            class="public-key-full clickable"
          >
            {{ wallet.publicKey }}
          </span>
          <button 
            @click="handleCopyToClipboard(wallet.publicKey, index)"
            class="copy-btn"
            :title="'复制公钥'"
          >
            📋
          </button>
        </p>
        <p><strong>Status:</strong> {{ wallet.status }}</p>
      </div>
      
      <!-- Show loading state if first query not done -->
      <div v-if="!wallet.firstQueryDone" class="wallet-loading">
        <p>Loading wallet status...</p>
      </div>
      
      <!-- Only show actions after first query -->
      <div v-else class="wallet-actions">
        <button @click="queryCards(index)" :disabled="!wallet.tools || wallet.loading">
          {{ wallet.loading ? '...' : '🔄' }}
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
          <button @click="claimReward(index,false)" :disabled="!wallet.tools || wallet.loading">
            {{ wallet.loading ? '...' : 'Claim' }}
          </button>
          <button @click="claimReward(index,true)" :disabled="!wallet.tools || wallet.loading">
            {{ wallet.loading ? '...' : 'Claim 并归集' }}
          </button>
          
          <!-- Pending Rewards Display
          <PendingReward 
            :wallet="wallet" 
            ref="pendingRewardRef"
            @pending-rewards-updated="handlePendingRewardsUpdate" 
          /> -->
        </template>
      </div>
      
      <div v-if="wallet.accountInfo" class="account-details">
        <AccountState>
          <template #poke>
            {{ formatTokenBalance(wallet.tokenBalance) }}
          </template>
          <template #farmPower>
            {{ wallet.accountInfo.totalHashpower }}
          </template>
          <template #slotx>
            {{ wallet.accountInfo.cards.filter(card => card.isStaked).length }} / {{getFarmSlots(wallet.accountInfo.farm?.farm_type)}}
          </template>
          <template #foodConsumption>
            {{ wallet.accountInfo.berries }} / {{ wallet.accountInfo.farm?.berry_capacity }}
          </template>
        </AccountState>
      </div>
      
      <!-- Token Balance Display -->
      <div v-if="wallet.firstQueryDone" class="token-balance">
        <div class="balance-container">
          <div class="balance-info">
            <div class="sol-balance">
              <span class="sol-amount">{{ formatSolBalance(wallet.solBalance) }}</span>
              <span class="sol-symbol">SOL</span>
            </div>
          </div>
          <div class="redistribute-section">
            <div class="redistribute-input">
              <input
                v-model.number="redistributeAmount"
                type="number"
                step="10"
                min="0"
                placeholder="输入$Poke数量"
                class="redistribute-amount-input"
              />
              <button
                @click="redistributeTokens(index)"
                :disabled="wallet.loading || !redistributeAmount || redistributeAmount <= 0"
                class="redistribute-btn"
                title="从其他钱包匀$Poke过来"
              >
                吸$Poke
              </button>
              <button
                @click="redistributeSol(index)"
                :disabled="wallet.loading || !redistributeAmount || redistributeAmount <= 0"
                class="redistribute-btn sol-btn"
                title="从其他钱包匀SOL过来"
              >
                吸SOL
              </button>
            </div>
          </div>
          <div class="balance-actions">
            <button 
              @click="refreshTokenBalance(index)"
              :disabled="wallet.loading"
              class="refresh-balance-btn"
              title="刷新余额"
            >
              🔄
            </button>
            <button 
              @click="transferTokens(index)"
              :disabled="wallet.loading || !hasTokenBalance(wallet.tokenBalance)"
              class="transfer-btn"
              title="转出到归集地址"
            >
              💰 转出$Poke到归集地址
            </button>
          </div>
        </div>
      </div>
      
      <!-- Cards List -->
      <div v-if="wallet.cards && wallet.cards.length > 0" class="cards-list">
        <div class="cards-header" @click="toggleCardsExpanded(index)">
          <h4>Cards ({{ wallet.cards.length }})</h4>
          <span class="toggle-icon">{{ wallet.cardsExpanded ? '▼' : '▶' }}</span>
        </div>
        <CardDisplay
          :cards="wallet.cards"
          :visible="wallet.cardsExpanded"
          :loading="wallet.loading"
          @stake-card="(cardIndex) => stakeCard(index, cardIndex)"
          @recycle-card="(cardIndex) => recycleCard(index, cardIndex)"
          @unstake-card="(cardIndex) => unstakeCard(index, cardIndex)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useWalletStore } from '../stores/useWalletStore'
import { useWalletOperationsStore } from '../stores/useWalletOperationsStore'
import { copyToClipboard } from '../utils/helpers.js'
import { storeToRefs } from 'pinia'
import CardDisplay from './CardDisplay.vue'
import Berries from './ui/Berries.vue'
import Power from './ui/Power.vue'
import AccountState from './ui/AccountState.vue'
import PendingReward from './PendingReward.vue'
import { getFarmSlots } from '../utils/helpers.js'

const props = defineProps({
  wallet: {
    type: Object,
    required: true
  },
  index: {
    type: Number,
    required: true
  }
})



const walletStore = useWalletStore()
const { wallets } = storeToRefs(walletStore)
const { removeWallet, toggleCardsExpanded, refreshBalance, updatePendingRewards } = walletStore

const walletOperationsStore = useWalletOperationsStore()
const {
  queryCards,
  initGameAccount,
  openBooster,
  claimReward,
  recycleCard,
  stakeCard,
  unstakeCard
} = walletOperationsStore

// Redistribute tokens state
const redistributeAmount = ref(0)

// Pending rewards ref
const pendingRewardRef = ref(null)

// Handle pending rewards update
const handlePendingRewardsUpdate = (rewardAmount) => {
  updatePendingRewards(props.index, rewardAmount)
}

// Handle wallet removal with confirmation
const handleRemoveWallet = (index) => {
  const wallet = wallets.value[index]
  if (!wallet) return
  
  const walletDisplay = wallet.publicKey ? 
    `W${index + 1} (${wallet.publicKey.slice(0, 8)}...)` : 
    `W${index + 1}`
  
  const confirmed = confirm(`确认删除钱包 ${walletDisplay}?\n\n此操作无法撤销。`)
  
  if (confirmed) {
    removeWallet(index)
  }
}



// Handle copy to clipboard with status feedback
const handleCopyToClipboard = async (text, index) => {
  const success = await copyToClipboard(text)
  
  if (success) {
    // Show temporary feedback
    const wallet = wallets.value[index]
    const originalStatus = wallet.status
    wallet.status = '公钥已复制!'
    setTimeout(() => {
      wallet.status = originalStatus
    }, 2000)
  } else {
    const wallet = wallets.value[index]
    const originalStatus = wallet.status
    wallet.status = '复制失败'
    setTimeout(() => {
      wallet.status = originalStatus
    }, 2000)
  }
}

// Format token balance for display
const formatTokenBalance = (balance) => {
  if (!balance || balance === '0') return '0.000000'
  const numBalance = Number(balance) / 1000000
  return numBalance.toFixed(6)
}

// Format SOL balance for display
const formatSolBalance = (balance) => {
  if (!balance) return '0.000'
  return Number(balance).toFixed(3)
}

// Check if wallet has token balance
const hasTokenBalance = (balance) => {
  return balance && balance !== '0' && Number(balance) > 0
}

// Refresh token balance (use store method)
const refreshTokenBalance = async (index) => {
  await refreshBalance(index)
}

// Transfer tokens to recipient account
const transferTokens = async (index) => {
  const wallet = wallets.value[index]
  if (!wallet || !wallet.tools || wallet.loading) return
  
  try {
    wallet.loading = true
    wallet.status = 'Transferring tokens...'
    
    const tokenBalance = await wallet.tools.getTokenBalance()
    
    if (tokenBalance <= 0) {
      wallet.status = 'No tokens to transfer'
      return
    }
    
    const tokenBalanceReadable = (Number(tokenBalance) / 1000000).toFixed(6)
    
    // Execute transfer
    const result = await wallet.tools.transferAllTokensToRecipient()
    
    if (result) {
      wallet.status = `Successfully transferred ${tokenBalanceReadable} Tokens`
      wallet.tokenBalance = '0'
      
      // Refresh balance after successful transfer
      setTimeout(() => {
        refreshTokenBalance(index)
      }, 2000)
    } else {
      wallet.status = 'Transfer failed'
    }
  } catch (error) {
    console.error('Failed to transfer tokens:', error)
    wallet.status = `Transfer error: ${error.message}`
  } finally {
    wallet.loading = false
  }
}

// Redistribute tokens from other wallets
const redistributeTokens = async (targetIndex) => {
  const targetWallet = wallets.value[targetIndex]
  if (!targetWallet || !targetWallet.tools || targetWallet.loading) return
  
  if (!redistributeAmount.value || redistributeAmount.value <= 0) {
    alert('请输入有效的$Poke数量')
    return
  }

  try {
    targetWallet.loading = true
    targetWallet.status = 'Checking available tokens...'
    
    // Convert user input to raw token amount (multiply by 1000000 for 6 decimals)
    const requiredRawAmount = BigInt(Math.floor(redistributeAmount.value * 1000000))
    
    // Get all other wallets with tokens (excluding current wallet)
    const donorWallets = wallets.value
      .map((wallet, index) => ({ wallet, index }))
      .filter(({ wallet, index }) => 
        index !== targetIndex && // Not the target wallet
        wallet.firstQueryDone && 
        wallet.tools && 
        !wallet.loading &&
        hasTokenBalance(wallet.tokenBalance)
      )
    
    // Calculate total available tokens
    const totalAvailable = donorWallets.reduce((sum, { wallet }) => {
      return sum + BigInt(wallet.tokenBalance || '0')
    }, BigInt(0))
    
    console.log('Redistribution check:', {
      required: requiredRawAmount.toString(),
      available: totalAvailable.toString(),
      donors: donorWallets.length
    })
    
    if (totalAvailable < requiredRawAmount) {
      const availableReadable = (Number(totalAvailable) / 1000000).toFixed(6)
      targetWallet.status = `Insufficient tokens: need ${redistributeAmount.value}, available ${availableReadable}`
      alert(`总余额不足！需要 ${redistributeAmount.value} $Poke，但其他钱包总共只有 ${availableReadable} $Poke`)
      return
    }
    
    // Sort donors by token balance (descending)
    donorWallets.sort((a, b) => {
      const balanceA = BigInt(a.wallet.tokenBalance || '0')
      const balanceB = BigInt(b.wallet.tokenBalance || '0')
      return balanceA > balanceB ? -1 : balanceA < balanceB ? 1 : 0
    })
    
    targetWallet.status = 'Starting redistribution...'
    let remainingToTransfer = requiredRawAmount
    let transfersCompleted = 0
    
    // Transfer from donors in order
    for (const { wallet: donorWallet, index: donorIndex } of donorWallets) {
      if (remainingToTransfer <= 0) break
      
      const donorBalance = BigInt(donorWallet.tokenBalance || '0')
      if (donorBalance <= 0) continue
      
      // Calculate how much to transfer from this donor
      const transferAmount = remainingToTransfer > donorBalance ? donorBalance : remainingToTransfer
      const transferAmountReadable = (Number(transferAmount) / 1000000).toFixed(6)
      
      try {
        donorWallet.loading = true
        donorWallet.status = `Transferring ${transferAmountReadable} $Poke...`
        
        console.log(`Transferring ${transferAmountReadable} from wallet ${donorIndex} to wallet ${targetIndex}`)
        
        // Execute transfer from donor to target
        const result = await donorWallet.tools.transferTokensToWallet(
          targetWallet.publicKey, 
          transferAmount
        )
        
        if (result) {
          // Update donor balance
          const newDonorBalance = donorBalance - transferAmount
          donorWallet.tokenBalance = newDonorBalance.toString()
          donorWallet.status = `Transferred ${transferAmountReadable} $Poke`
          
          remainingToTransfer -= transferAmount
          transfersCompleted++
          
          // Update target wallet status
          targetWallet.status = `Received ${transferAmountReadable} $Poke (${transfersCompleted} transfers)`
        } else {
          donorWallet.status = 'Transfer failed'
          console.error(`Transfer failed from wallet ${donorIndex}`)
        }
      } catch (error) {
        console.error(`Failed to transfer from wallet ${donorIndex}:`, error)
        donorWallet.status = `Transfer error: ${error.message}`
      } finally {
        donorWallet.loading = false
      }
      
      // Wait between transfers to avoid network congestion
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    // Refresh target wallet balance
    await refreshTokenBalance(targetIndex)
    
    const actualTransferred = Number(requiredRawAmount - remainingToTransfer) / 1000000
    
    if (remainingToTransfer === BigInt(0)) {
      targetWallet.status = `Successfully received ${actualTransferred.toFixed(6)} $Poke from ${transfersCompleted} wallets`
      redistributeAmount.value = 0 // Reset input
    } else {
      const stillNeeded = Number(remainingToTransfer) / 1000000
      targetWallet.status = `Partially completed: received ${actualTransferred.toFixed(6)}, still need ${stillNeeded.toFixed(6)} $Poke`
    }
    
  } catch (error) {
    console.error('Failed to redistribute tokens:', error)
    targetWallet.status = `Redistribution error: ${error.message}`
  } finally {
    targetWallet.loading = false
  }
}

// Redistribute SOL from other wallets
const redistributeSol = async (targetIndex) => {
  const targetWallet = wallets.value[targetIndex]
  if (!targetWallet || !targetWallet.tools || targetWallet.loading) return
  
  if (!redistributeAmount.value || redistributeAmount.value <= 0) {
    alert('请输入有效的SOL数量')
    return
  }

  try {
    targetWallet.loading = true
    targetWallet.status = 'Checking available SOL...'
    
    // Convert user input to SOL amount (input is already in SOL)
    const requiredSolAmount = redistributeAmount.value
    
    // Get all other wallets with SOL (excluding current wallet)
    const donorWallets = wallets.value
      .map((wallet, index) => ({ wallet, index }))
      .filter(({ wallet, index }) => 
        index !== targetIndex && // Not the target wallet
        wallet.firstQueryDone && 
        wallet.tools && 
        !wallet.loading &&
        wallet.solBalance && Number(wallet.solBalance) > 0.001 // Need at least 0.001 SOL for fees
      )
    
    // Calculate total available SOL (minus fee reserves)
    const totalAvailable = donorWallets.reduce((sum, { wallet }) => {
      const balance = Number(wallet.solBalance || 0)
      return sum + Math.max(0, balance - 0.001) // Reserve 0.001 SOL for fees
    }, 0)
    
    console.log('SOL Redistribution check:', {
      required: requiredSolAmount,
      available: totalAvailable,
      donors: donorWallets.length
    })
    
    if (totalAvailable < requiredSolAmount) {
      targetWallet.status = `Insufficient SOL: need ${requiredSolAmount}, available ${totalAvailable.toFixed(3)}`
      alert(`总SOL余额不足！需要 ${requiredSolAmount} SOL，但其他钱包总共只有 ${totalAvailable.toFixed(3)} SOL（已扣除手续费预留）`)
      return
    }
    
    // Sort donors by SOL balance (descending)
    donorWallets.sort((a, b) => {
      const balanceA = Number(a.wallet.solBalance || 0)
      const balanceB = Number(b.wallet.solBalance || 0)
      return balanceA > balanceB ? -1 : balanceA < balanceB ? 1 : 0
    })
    
    targetWallet.status = 'Starting SOL redistribution...'
    let remainingToTransfer = requiredSolAmount
    let transfersCompleted = 0
    
    // Transfer from donors in order
    for (const { wallet: donorWallet, index: donorIndex } of donorWallets) {
      if (remainingToTransfer <= 0) break
      
      const donorBalance = Number(donorWallet.solBalance || 0)
      if (donorBalance <= 0.001) continue // Skip if no transferable balance
      
      // Calculate how much to transfer from this donor (leave 0.001 for fees)
      const maxTransferable = donorBalance - 0.001
      const transferAmount = Math.min(remainingToTransfer, maxTransferable)
      
      if (transferAmount <= 0) continue
      
      try {
        donorWallet.loading = true
        donorWallet.status = `Transferring ${transferAmount.toFixed(3)} SOL...`
        
        console.log(`Transferring ${transferAmount.toFixed(3)} SOL from wallet ${donorIndex} to wallet ${targetIndex}`)
        
        // Execute SOL transfer from donor to target
        const result = await donorWallet.tools.transferSolToWallet(
          targetWallet.publicKey, 
          transferAmount
        )
        
        if (result) {
          // Update donor balance
          const newDonorBalance = donorBalance - transferAmount
          donorWallet.solBalance = newDonorBalance.toFixed(9)
          donorWallet.status = `Transferred ${transferAmount.toFixed(3)} SOL`
          
          remainingToTransfer -= transferAmount
          transfersCompleted++
          
          // Update target wallet status
          targetWallet.status = `Received ${transferAmount.toFixed(3)} SOL (${transfersCompleted} transfers)`
        } else {
          donorWallet.status = 'SOL transfer failed'
          console.error(`SOL transfer failed from wallet ${donorIndex}`)
        }
      } catch (error) {
        console.error(`Failed to transfer SOL from wallet ${donorIndex}:`, error)
        donorWallet.status = `SOL transfer error: ${error.message}`
      } finally {
        donorWallet.loading = false
      }
      
      // Wait between transfers to avoid network congestion
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    // Refresh target wallet balance
    await refreshTokenBalance(targetIndex)
    
    const actualTransferred = requiredSolAmount - remainingToTransfer
    
    if (remainingToTransfer === 0) {
      targetWallet.status = `Successfully received ${actualTransferred.toFixed(3)} SOL from ${transfersCompleted} wallets`
      redistributeAmount.value = 0 // Reset input
    } else {
      targetWallet.status = `Partially completed: received ${actualTransferred.toFixed(3)}, still need ${remainingToTransfer.toFixed(3)} SOL`
    }
    
  } catch (error) {
    console.error('Failed to redistribute SOL:', error)
    targetWallet.status = `SOL redistribution error: ${error.message}`
  } finally {
    targetWallet.loading = false
  }
}
</script>

<style scoped>
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

/* Public key display styles */
.public-key-container {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.clickable {
  cursor: pointer;
  transition: all 0.2s ease;
}

.public-key-short:hover {
  color: #007bff;
  text-decoration: underline;
}

.public-key-full {
  word-break: break-all;
  color: #007bff;
  font-family: monospace;
  font-size: 11px;
  line-height: 1.2;
}

.public-key-full:hover {
  background-color: #f0f8ff;
  padding: 2px;
  border-radius: 3px;
}

.copy-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
  border-radius: 3px;
  transition: all 0.2s ease;
  margin-left: 4px;
}

.copy-btn:hover {
  background-color: #e9ecef;
  transform: scale(1.1);
}

.copy-btn:active {
  transform: scale(0.95);
}

/* Token Balance Styles */
.token-balance {
  margin-top: 4px;
  padding: 6px;
  background: #e8f4f8;
  border-radius: 4px;
  border: 1px solid #b8e0d2;
}

.balance-container {
  max-height: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.balance-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.balance-amount {
  font-size: 16px;
  font-weight: bold;
  color: #27ae60;
  font-family: monospace;
  transition: all 0.3s ease;
}

.balance-amount:hover {
  transform: scale(1.02);
}

.token-symbol {
  font-size: 11px;
  color: #7f8c8d;
}

.sol-balance {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
}

.sol-amount {
  font-size: 14px;
  font-weight: bold;
  color: #8e44ad;
  font-family: monospace;
}

.sol-symbol {
  font-size: 10px;
  color: #7f8c8d;
}

.redistribute-section {
  margin: 4px 0;
}

.redistribute-input {
  display: flex;
  gap: 4px;
  align-items: center;
}

.redistribute-amount-input {
  width: 60px;
  padding: 4px 6px;
  border: 1px solid #ddd;
  border-radius: 3px;
  font-size: 12px;
  box-sizing: border-box;
}

.redistribute-amount-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.redistribute-btn {
  background: #28a745;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 8px;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.redistribute-btn:hover:not(:disabled) {
  background: #218838;
  transform: scale(1.05);
}

.redistribute-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
  transform: none;
}

.balance-actions {
  display: flex;
  gap: 4px;
}

.refresh-balance-btn {
  background: #3498db;
  color: white;
  border: none;
  padding: 2px 2px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 10px;
  transition: all 0.2s ease;
}

.refresh-balance-btn:hover:not(:disabled) {
  background: #2980b9;
  transform: scale(1.05);
}

.refresh-balance-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
  transform: none;
}

.transfer-btn {
  background: #53b45d;
  color: white;
  border: none;
  padding: 2px 4px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 10px;
  transition: all 0.2s ease;
}

.transfer-btn:hover:not(:disabled) {
  background: #c0392b;
  transform: scale(1.05);
}

.transfer-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
  transform: none;
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

</style>