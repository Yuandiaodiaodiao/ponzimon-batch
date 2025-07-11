<template>
  <div class="operation-bar">
    <h2>Wallet List</h2>
    <InitFarmRule />
    <div class="wallet-controls">
      <button @click="handleAddWallet">Add</button>
      <button @click="showImportDialog = true">Import</button>
      <button @click="testConnection" class="test-connection">Test Connection</button>
      <button @click="handleBatchInitGameAccounts" :disabled="!canBatchInit || batchLoading" class="batch-init">
        {{ batchLoading ? 'Processing...' : `一键开户(${availableForInit})` }}
      </button>
      <button @click="handleBatchInitGameAccountsInSingleTx" :disabled="!canBatchInit || batchLoading" class="batch-init-single-tx">
        {{ batchLoading ? 'Processing...' : `合并开户(${availableForInit})` }}
      </button>
      <button @click="handleBatchClaimRewards" :disabled="!canBatchClaim || batchLoading" class="batch-claim">
        {{ batchLoading ? 'Processing...' : `合并claim & 合并归集(${availableForClaim})` }}
      </button>
      <button @click="batchTransferTokens" :disabled="batchLoading" class="batch-transfer">
        {{ batchLoading ? 'Processing...' : `转移现有余额(${walletsWithTokens})` }}
      </button>
      <button @click="exportPrivateKeys" :disabled="wallets.length === 0" class="export-backup">
        导出备份私钥
      </button>
      <button @click="clearAllWallets" class="danger">Clear</button>
    </div>
    
    <!-- Import Wallet Dialog -->
    <ImportWallet :visible="showImportDialog" @close="showImportDialog = false" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useNetworkStore } from '../stores/useNetworkStore'
import { useWalletStore } from '../stores/useWalletStore'
import { useWalletOperationsStore } from '../stores/useWalletOperationsStore'
import { storeToRefs } from 'pinia'
import ImportWallet from './ImportWallet.vue'
import InitFarmRule from './InitFarmRule.vue'

// Network configuration
const networkStore = useNetworkStore()
const { config } = storeToRefs(networkStore)

// Wallet storage
const walletStore = useWalletStore()
const { wallets } = storeToRefs(walletStore)
const {  addWallet, clearAllWallets, refreshBalance } = walletStore

// Wallet operations
const walletOperationsStore = useWalletOperationsStore()
const {
  initializeWallet,
  batchInitGameAccounts,
  batchInitGameAccountsInSingleTx,
  batchClaimRewards
} = walletOperationsStore

// Batch operation state
const batchLoading = ref(false)

// Import dialog state
const showImportDialog = ref(false)

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

// Computed properties for batch claim operations
const availableForClaim = computed(() => {
  return wallets.value.filter(wallet => 
    wallet.firstQueryDone && 
    wallet.accountInitialized && 
    wallet.tools && 
    !wallet.loading
  ).length
})

const canBatchClaim = computed(() => {
  return availableForClaim.value > 0
})

// Computed property for wallets with tokens
const walletsWithTokens = computed(() => {
  return wallets.value.filter(wallet => 
    wallet.firstQueryDone && 
    wallet.tools && 
    !wallet.loading &&
    hasTokenBalance(wallet.tokenBalance)
  ).length
})

// Check if wallet has token balance
const hasTokenBalance = (balance) => {
  return balance && balance !== '0' && Number(balance) > 0
}

// Handle add wallet with auto-initialization
const handleAddWallet = async () => {
  try {
    const newWalletIndex = addWallet()
    console.log('New wallet added at index:', newWalletIndex)
    
    // Automatically initialize the wallet with the generated key
    await initializeWallet(newWalletIndex)
    console.log('Wallet initialized successfully')
  } catch (error) {
    console.error('Failed to add or initialize wallet:', error)
    // 如果初始化失败，设置一个错误状态
    if (wallets.value.length > 0) {
      const lastWallet = wallets.value[wallets.value.length - 1]
      lastWallet.status = `Error: ${error.message}`
      lastWallet.loading = false
      lastWallet.firstQueryDone = true
    }
  }
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

// Batch initialize game accounts in single transaction wrapper
const handleBatchInitGameAccountsInSingleTx = async () => {
  if (!canBatchInit.value || batchLoading.value) return
  
  batchLoading.value = true
  
  try {
    const result = await batchInitGameAccountsInSingleTx()
    console.log('Batch single-tx result:', result)
    
    if (result.success > 0) {
      alert(`合并开户成功!\n成功: ${result.success}\n失败: ${result.failed}`)
    } else if (result.failed > 0) {
      alert(`合并开户失败: ${result.failed} 个钱包`)
    }
  } catch (error) {
    console.error('Batch single-tx initialization failed:', error)
    alert(`合并开户失败: ${error.message}`)
  } finally {
    batchLoading.value = false
  }
}

// Batch claim rewards wrapper
const handleBatchClaimRewards = async () => {
  if (!canBatchClaim.value || batchLoading.value) return
  
  batchLoading.value = true
  
  try {
    const result = await batchClaimRewards()
    console.log('Batch claim and transfer result:', result)
    
    if (result.success > 0) {
      alert(`合并claim & 合并归集成功!\n成功: ${result.success}\n失败: ${result.failed}`)
    } else if (result.failed > 0) {
      alert(`合并claim & 合并归集失败: ${result.failed} 个钱包`)
    }
  } catch (error) {
    console.error('Batch claim and transfer failed:', error)
    alert(`合并claim & 合并归集失败: ${error.message}`)
  } finally {
    batchLoading.value = false
  }
}

// Batch transfer tokens
const batchTransferTokens = async () => {
  if (batchLoading.value) return
  
  const walletsToTransfer = wallets.value
    .map((wallet, index) => ({ wallet, index }))
    .filter(({ wallet }) => 
      wallet.firstQueryDone && 
      wallet.tools && 
      !wallet.loading &&
      hasTokenBalance(wallet.tokenBalance)
    )
  
  if (walletsToTransfer.length === 0) {
    alert('没有可转账的钱包')
    return
  }
  
  batchLoading.value = true
  
  try {
    let successCount = 0
    let failCount = 0
    
    for (const { index } of walletsToTransfer) {
      try {
        console.log(`批量转账: 处理钱包 ${index + 1}/${walletsToTransfer.length}`)
        
        await transferTokens(index)
        successCount++
        
        // 延迟避免网络压力
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        console.error(`批量转账失败 钱包 ${index + 1}:`, error)
        failCount++
      }
    }
    
    alert(`批量转账完成!\n成功: ${successCount}\n失败: ${failCount}`)
    
  } catch (error) {
    console.error('批量转账失败:', error)
    alert(`批量转账失败: ${error.message}`)
  } finally {
    batchLoading.value = false
  }
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
        refreshBalance(index)
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

// Test connection function
const testConnection = async () => {
  try {
    console.log('Testing connection with config:', config.value)
    const url = config.value.rpcUrl
    if (!url) {
      throw new Error('No RPC URL configured')
    }
    
    const { Connection } = await import('@solana/web3.js')
    const connection = new Connection(url, 'confirmed')
    
    console.log('Testing connection to:', url)
    const version = await connection.getVersion()
    console.log('Connection successful, version:', version)
    
    alert(`Connection successful!\nRPC: ${url}\nVersion: ${version['solana-core']}`)
  } catch (error) {
    console.error('Connection test failed:', error)
    alert(`Connection failed: ${error.message}`)
  }
}

// Generate random password
const generateRandomPassword = (length = 12) => {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  return password
}

// Export private keys as password-protected ZIP
const exportPrivateKeys = async () => {
  if (wallets.value.length === 0) {
    alert('没有钱包可导出')
    return
  }

  try {
    // Import zip.js for password-protected ZIP creation
    const { ZipWriter, BlobWriter, TextReader } = await import('@zip.js/zip.js')
    
    // Collect all private keys
    const privateKeys = wallets.value
      .filter(wallet => wallet.privateKey)
      .map((wallet, index) => {
        const publicKey = wallet.publicKey || 'Unknown'
        return `钱包${index + 1},${wallet.privateKey},${publicKey}`
      })
    
    if (privateKeys.length === 0) {
      alert('没有找到私钥可导出')
      return
    }
    
    // Create CSV content
    const csvHeader = '钱包编号,私钥,公钥'
    const csvContent = [csvHeader, ...privateKeys].join('\n')
    
    // Generate random password
    const password = generateRandomPassword(16)
    
    // Create README content
    const readmeContent = `私钥备份文件
    
创建时间: ${new Date().toLocaleString()}
钱包数量: ${privateKeys.length}

⚠️ 安全提醒:
- 此文件包含您的私钥，请妥善保管
- 不要将私钥分享给任何人
- 建议离线存储此备份文件
- 定期检查备份文件的完整性

📋 文件说明:
- private_keys.csv: 包含所有钱包的私钥和公钥
- 格式: 钱包编号,私钥,公钥`

    // Create ZIP with password protection using zip.js
    const blobWriter = new BlobWriter('application/zip')
    const zipWriter = new ZipWriter(blobWriter, { password })
    
    // Add CSV file to ZIP
    await zipWriter.add('private_keys.csv', new TextReader(csvContent))
    
    // Add README file to ZIP
    await zipWriter.add('README.txt', new TextReader(readmeContent))
    
    // Close the ZIP writer and get the blob
    const zipBlob = await zipWriter.close()
    
    // Create download link
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
    const filename = `wallet_backup_${timestamp}.zip`
    
    const downloadLink = document.createElement('a')
    downloadLink.href = URL.createObjectURL(zipBlob)
    downloadLink.download = filename
    
    // Trigger download
    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)
    
    // Clean up URL
    setTimeout(() => {
      URL.revokeObjectURL(downloadLink.href)
    }, 100)
    
    // Show password to user
    const message = `🔐 密码保护ZIP备份已创建！\n\n文件名: ${filename}\n包含 ${privateKeys.length} 个钱包的私钥\n\n🔑 ZIP解压密码: ${password}\n\n✅ 安全特性：\n- ZIP文件已设置密码保护\n- 解压时需要输入密码\n- 密码已复制到剪贴板\n- 包含CSV格式的私钥文件\n\n⚠️ 重要提醒：\n- 请妥善保管ZIP解压密码\n- 解压后查看README.txt文件\n- 不要将私钥分享给任何人\n- 建议离线存储备份文件`
    
    alert(message)
    
    // Copy password to clipboard for reference
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(password)
        console.log('Password copied to clipboard')
      } catch (err) {
        console.warn('Could not copy password to clipboard:', err)
      }
    }
    
    console.log(`Successfully exported ${privateKeys.length} private keys to ${filename}`)
    
  } catch (error) {
    console.error('Failed to export private keys:', error)
    alert(`导出失败: ${error.message}`)
  }
}

</script>

<style scoped>
.operation-bar {
  margin-top: 8px;
  padding: 4px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.wallet-controls {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
}

.wallet-controls button {
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  border-radius: 3px;
  font-size: 12px;
  transition: all 0.3s ease;
}

.wallet-controls button:hover {
  background: var(--bg-tertiary);
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

.wallet-controls button.batch-init-single-tx {
  background: #17a2b8;
  color: white;
  border-color: #17a2b8;
}

.wallet-controls button.batch-init-single-tx:disabled {
  background: #6c757d;
  border-color: #6c757d;
  color: white;
  cursor: not-allowed;
}

.wallet-controls button.batch-claim {
  background: #6f42c1;
  color: white;
  border-color: #6f42c1;
}

.wallet-controls button.batch-claim:disabled {
  background: #6c757d;
  border-color: #6c757d;
  color: white;
  cursor: not-allowed;
}

.wallet-controls button.batch-claim-transfer {
  background: #e83e8c;
  color: white;
  border-color: #e83e8c;
}

.wallet-controls button.batch-claim-transfer:disabled {
  background: #6c757d;
  border-color: #6c757d;
  color: white;
  cursor: not-allowed;
}

.wallet-controls button.test-connection {
  background: #17a2b8;
  color: white;
  border-color: #17a2b8;
}

.wallet-controls button.test-connection:hover {
  background: #138496;
  border-color: #117a8b;
}

.wallet-controls button.batch-transfer {
  background: #f39c12;
  color: white;
  border-color: #f39c12;
}

.wallet-controls button.batch-transfer:hover {
  background: #e67e22;
  border-color: #d68910;
}

.wallet-controls button.batch-transfer:disabled {
  background: #6c757d;
  border-color: #6c757d;
  color: white;
  cursor: not-allowed;
}

.wallet-controls button.export-backup {
  background: #fd7e14;
  color: white;
  border-color: #fd7e14;
}

.wallet-controls button.export-backup:hover:not(:disabled) {
  background: #e8590c;
  border-color: #dc5200;
}

.wallet-controls button.export-backup:disabled {
  background: #6c757d;
  border-color: #6c757d;
  color: white;
  cursor: not-allowed;
}

</style>