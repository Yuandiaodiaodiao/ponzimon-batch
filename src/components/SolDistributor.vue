<template>
  <div class="sol-distributor">
    <div class="distributor-container">
      <div class="distributor-header">
        <h3 class="distributor-title">SOL分发器 (动用所有可用的私钥向未开户钱包中转账使其达到设定的阈值)</h3>
        <div class="distributor-controls">
          <div class="input-group">
            <label for="min-sol-amount">最少拥有SOL数量:</label>
            <input
              id="min-sol-amount"
              v-model.number="minSolAmount"
              type="number"
              step="0.001"
              min="0"
              placeholder="0.010"
              class="min-sol-input"
            />
            <span class="sol-unit">SOL</span>
          </div>
          <button
            @click="distributeSol"
            :disabled="distributing || !minSolAmount || minSolAmount <= 0"
            class="distribute-btn"
            title="自动分发SOL使更多钱包达到最小阈值"
          >
            {{ distributing ? '分发中...' : '分发SOL' }}
          </button>
        </div>
      </div>
      
      <div v-if="lastDistributionReport" class="distribution-report">
        <div class="report-header">
          <h4>分发报告</h4>
          <span class="report-time">{{ formatTime(lastDistributionReport.timestamp) }}</span>
        </div>
        <div class="report-content">
          <div class="report-item">
            <span class="label">目标阈值:</span>
            <span class="value">{{ lastDistributionReport.minSolAmount }} SOL</span>
          </div>
          <div class="report-item">
            <span class="label">符合条件的捐赠钱包:</span>
            <span class="value">{{ lastDistributionReport.donorCount }}</span>
          </div>
          <div class="report-item">
            <span class="label">需要SOL的钱包:</span>
            <span class="value">{{ lastDistributionReport.recipientCount }}</span>
          </div>
          <div class="report-item">
            <span class="label">总分发量:</span>
            <span class="value success">{{ lastDistributionReport.totalDistributed.toFixed(6) }} SOL</span>
          </div>
          <div class="report-item">
            <span class="label">成功分发:</span>
            <span class="value success">{{ lastDistributionReport.successfulTransfers }}</span>
          </div>
          <div class="report-item">
            <span class="label">达标钱包数:</span>
            <span class="value success">{{ lastDistributionReport.walletsMeetingThreshold }}</span>
          </div>
          <div v-if="lastDistributionReport.errors.length > 0" class="report-item">
            <span class="label">错误:</span>
            <span class="value error">{{ lastDistributionReport.errors.length }} 个转账失败</span>
          </div>
        </div>
      </div>
      
      <div v-if="distributing" class="distribution-progress">
        <div class="progress-info">
          <span>{{ distributionStatus }}</span>
          <span v-if="progressInfo.current > 0">
            ({{ progressInfo.current }}/{{ progressInfo.total }})
          </span>
        </div>
        <div class="progress-bar">
          <div 
            class="progress-fill"
            :style="{ width: progressPercentage + '%' }"
          ></div>
        </div>
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
const { wallets } = storeToRefs(walletStore)

// State
const minSolAmount = ref(0.4) // Default 0.010 SOL
const distributing = ref(false)
const distributionStatus = ref('')
const progressInfo = ref({ current: 0, total: 0 })
const lastDistributionReport = ref(null)

// Computed
const progressPercentage = computed(() => {
  if (progressInfo.value.total === 0) return 0
  return (progressInfo.value.current / progressInfo.value.total) * 100
})

// Methods
const formatTime = (timestamp) => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

const distributeSol = async () => {
  if (distributing.value || !minSolAmount.value || minSolAmount.value <= 0) return
  
  distributing.value = true
  distributionStatus.value = '正在分析钱包状态...'
  progressInfo.value = { current: 0, total: 0 }
  
  try {
    // Get all wallets with complete data
    const allWallets = wallets.value
      .map((wallet, index) => ({ wallet, index }))
      .filter(({ wallet }) => wallet.firstQueryDone && wallet.tools)
    
    if (allWallets.length === 0) {
      alert('没有可用的钱包进行分发')
      return
    }
    
    const threshold = minSolAmount.value
    const feeReserve = 0.001 // Reserve for transaction fees
    
    // Categorize wallets
    const donorWallets = []
    const recipientWallets = []
    
    for (const { wallet, index } of allWallets) {
      const solBalance = Number(wallet.solBalance || 0)
      
      if (solBalance > threshold + feeReserve) {
        // Has excess SOL to donate
        const excessAmount = solBalance - threshold - feeReserve
        donorWallets.push({
          wallet,
          index,
          balance: solBalance,
          excess: excessAmount
        })
      } else if (solBalance < threshold && (!wallet.accountInitialized && solBalance < threshold)) {
        // Needs SOL (either not initialized or below threshold)
        const needed = threshold - solBalance
        recipientWallets.push({
          wallet,
          index,
          balance: solBalance,
          needed: needed
        })
      }
    }
    
    console.log('SOL Distribution Analysis:', {
      threshold,
      donors: donorWallets.length,
      recipients: recipientWallets.length,
      totalExcess: donorWallets.reduce((sum, d) => sum + d.excess, 0),
      totalNeeded: recipientWallets.reduce((sum, r) => sum + r.needed, 0)
    })
    
    if (donorWallets.length === 0) {
      alert('没有钱包有多余的SOL可以分发')
      return
    }
    
    if (recipientWallets.length === 0) {
      alert('所有钱包都已满足最小SOL阈值')
      return
    }
    
    // Sort donors by excess amount (descending) and recipients by needed amount (ascending)
    donorWallets.sort((a, b) => b.excess - a.excess)
    recipientWallets.sort((a, b) => a.needed - b.needed)
    
    distributionStatus.value = '开始分发SOL...'
    progressInfo.value = { current: 0, total: recipientWallets.length }
    
    const report = {
      timestamp: Date.now(),
      minSolAmount: threshold,
      donorCount: donorWallets.length,
      recipientCount: recipientWallets.length,
      totalDistributed: 0,
      successfulTransfers: 0,
      walletsMeetingThreshold: 0,
      errors: []
    }
    
    // Distribute SOL
    for (let i = 0; i < recipientWallets.length; i++) {
      const recipient = recipientWallets[i]
      const needed = recipient.needed
      
      progressInfo.value.current = i + 1
      distributionStatus.value = `分发给钱包 ${recipient.index + 1} (需要 ${needed.toFixed(6)} SOL)`
      
      let remainingNeeded = needed
      let transfersForThisRecipient = 0
      
      // Try to fulfill this recipient's needs from available donors
      for (const donor of donorWallets) {
        if (remainingNeeded <= 0) break
        if (donor.excess <= 0) continue
        
        const transferAmount = Math.min(remainingNeeded, donor.excess)
        
        try {
          console.log(`Transferring ${transferAmount.toFixed(6)} SOL from wallet ${donor.index} to wallet ${recipient.index}`)
          
          const result = await donor.wallet.tools.transferSolToWallet(
            recipient.wallet.publicKey,
            transferAmount
          )
          
          if (result) {
            // Update balances
            donor.wallet.solBalance = (donor.balance - transferAmount).toFixed(9)
            donor.balance -= transferAmount
            donor.excess -= transferAmount
            
            recipient.wallet.solBalance = (recipient.balance + transferAmount).toFixed(9)
            recipient.balance += transferAmount
            remainingNeeded -= transferAmount
            
            report.totalDistributed += transferAmount
            transfersForThisRecipient++
            
            console.log(`Successfully transferred ${transferAmount.toFixed(6)} SOL`)
          } else {
            console.error(`Failed to transfer SOL from wallet ${donor.index} to wallet ${recipient.index}`)
            report.errors.push(`Transfer failed: ${donor.index} -> ${recipient.index}`)
          }
        } catch (error) {
          console.error(`Error transferring SOL:`, error)
          report.errors.push(`Error: ${donor.index} -> ${recipient.index}: ${error.message}`)
        }
        
        // Wait between transfers to avoid network congestion
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      if (transfersForThisRecipient > 0) {
        report.successfulTransfers += transfersForThisRecipient
      }
      
      // Check if this wallet now meets the threshold
      if (recipient.balance >= threshold) {
        report.walletsMeetingThreshold++
      }
      
      // Wait between recipients
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    lastDistributionReport.value = report
    distributionStatus.value = '分发完成！'
    
    // Show summary
    const summary = `
分发完成！
- 总分发量: ${report.totalDistributed.toFixed(6)} SOL
- 成功转账: ${report.successfulTransfers} 次
- 达标钱包: ${report.walletsMeetingThreshold} 个
- 失败次数: ${report.errors.length} 次
    `.trim()
    
    alert(summary)
    
  } catch (error) {
    console.error('SOL distribution failed:', error)
    distributionStatus.value = `分发失败: ${error.message}`
    alert(`SOL分发失败: ${error.message}`)
  } finally {
    distributing.value = false
    
    // Reset progress after a delay
    setTimeout(() => {
      if (!distributing.value) {
        distributionStatus.value = ''
        progressInfo.value = { current: 0, total: 0 }
      }
    }, 3000)
  }
}
</script>

<style scoped>
.sol-distributor {
  margin: 16px 0;
  padding: 0 8px;
}

.distributor-container {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  border-radius: 8px;
  padding: 16px;
  color: white;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.distributor-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.distributor-title {
  margin: 0;
  font-size: 18px;
  font-weight: bold;
  color: white;
}

.distributor-controls {
  display: flex;
  align-items: end;
  gap: 12px;
  flex-wrap: wrap;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.input-group label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

.min-sol-input {
  width: 80px;
  padding: 6px 8px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  text-align: center;
}

.min-sol-input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

.min-sol-input:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.15);
}

.sol-unit {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  margin-left: 4px;
}

.distribute-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.distribute-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

.distribute-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.distribution-progress {
  margin-top: 16px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 14px;
  color: white;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #00f2fe 0%, #4facfe 100%);
  transition: width 0.3s ease;
  border-radius: 3px;
}

.distribution-report {
  margin-top: 16px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
}

.report-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.report-header h4 {
  margin: 0;
  font-size: 14px;
  color: white;
}

.report-time {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
}

.report-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.report-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.report-item .label {
  color: rgba(255, 255, 255, 0.8);
}

.report-item .value {
  color: white;
  font-weight: 500;
}

.report-item .value.success {
  color: #4ade80;
}

.report-item .value.error {
  color: #f87171;
}
</style>