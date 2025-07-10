<template>
  <div class="solana-wallet-manager">
    <!-- Network Configuration -->
    <div class="network-config">
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

    <!-- Wallet List -->
    <div class="wallet-list">
      <h2>Wallet List</h2>
      <div class="wallet-controls">
        <button @click="handleAddWallet">Add</button>
        <button @click="showImportDialog = true">Import</button>
        <button @click="testConnection" class="test-connection">Test Connection</button>
        <button @click="handleBatchInitGameAccounts" :disabled="!canBatchInit || batchLoading" class="batch-init">
          {{ batchLoading ? 'Processing...' : `一键开户(${availableForInit})` }}
        </button>
        <button @click="batchTransferTokens" :disabled="batchLoading" class="batch-transfer">
          {{ batchLoading ? 'Processing...' : `批量转账(${walletsWithTokens})` }}
        </button>
        <button @click="clearAllWallets" class="danger">Clear</button>
      </div>
      
      <!-- Private Key Import Dialog -->
      <div v-if="showImportDialog" class="import-dialog-overlay" @click="closeImportDialog">
        <div class="import-dialog" @click.stop>
          <div class="dialog-header">
            <h3>批量导入钱包</h3>
            <button @click="closeImportDialog" class="close-btn">×</button>
          </div>
          <div class="dialog-content">
            <div class="input-group">
              <label>私钥 (每行一个):</label>
              <textarea 
                v-model="importPrivateKey" 
                placeholder="请输入私钥（Base58格式），每行一个私钥&#10;例如：&#10;2xD5F3h...&#10;4bK8J2m...&#10;7cL9P6n..."
                rows="8"
                class="private-key-input"
              ></textarea>
              <div class="import-info">
                <span class="key-count">检测到 {{ privateKeyCount }} 个私钥</span>
              </div>
            </div>
            <div class="dialog-actions">
              <button @click="handleBatchImportWallet" :disabled="!importPrivateKey.trim() || importLoading" class="import-btn">
                {{ importLoading ? `导入中... (${importProgress.current}/${importProgress.total})` : `批量导入 (${privateKeyCount}个钱包)` }}
              </button>
              <button @click="closeImportDialog" class="cancel-btn">取消</button>
            </div>
            <div v-if="importProgress.total > 0" class="import-progress">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: `${(importProgress.current / importProgress.total) * 100}%` }"></div>
              </div>
              <div class="progress-text">
                {{ importProgress.current }}/{{ importProgress.total }} 
                (成功: {{ importProgress.success }}, 失败: {{ importProgress.failed }})
              </div>
            </div>
            <div v-if="importMessage" class="import-message" :class="{ error: importError }">
              {{ importMessage }}
            </div>
          </div>
        </div>
      </div>
      
      <div class="wallet-grid">
        <div v-for="(wallet, index) in wallets" :key="wallet.id" class="wallet-item">
        <div class="wallet-header">
          <h3>W{{ index + 1 }}</h3>
          <button @click="handleRemoveWallet(index)" class="remove-btn">×</button>
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
            <p class="public-key-container">
              <strong>Public:</strong>
              <span 
                v-if="!wallet.showFullPublicKey" 
                @click="togglePublicKeyDisplay(index)"
                class="public-key-short clickable"
                :title="wallet.publicKey"
              >
                {{ wallet.publicKey.slice(0, 20) }}...
              </span>
              <span 
                v-else 
                @click="togglePublicKeyDisplay(index)"
                class="public-key-full clickable"
                :title="'点击收起'"
              >
                {{ wallet.publicKey }}
              </span>
              <button 
                @click="copyToClipboard(wallet.publicKey, index)"
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
          
          <!-- Token Balance Display -->
          <div v-if="wallet.firstQueryDone" class="token-balance">
            <div class="balance-container">
              <div class="balance-info">
              <div>
                <span class="balance-amount">{{ formatTokenBalance(wallet.tokenBalance) }}</span>
                <span class="token-symbol">Tokens</span>
              </div>
               
                <div class="sol-balance">
                  <span class="sol-amount">{{ formatSolBalance(wallet.solBalance) }}</span>
                  <span class="sol-symbol">SOL</span>
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
                  💰 转出
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
                
                <!-- Buttons for staked cards -->
                <div v-else-if="card.isStaked" class="card-actions staked-actions">
                  <button 
                    @click="unstakeCard(index, cardIndex)"
                    class="unstake-btn"
                    :disabled="wallet.loading"
                  >
                    Unstake
                  </button>
                  <div class="staked-label">
                    🔒 Staked
                  </div>
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
      unstakeCard,
      batchInitGameAccounts,
      importWalletByPrivateKey
    } = useWalletOperations(wallets, config, saveWallets, addWallet)
    
    // Batch operation state
    const batchLoading = ref(false)
    
    // Import dialog state
    const showImportDialog = ref(false)
    const importPrivateKey = ref('')
    const importLoading = ref(false)
    const importMessage = ref('')
    const importError = ref(false)
    const importProgress = ref({
      current: 0,
      total: 0,
      success: 0,
      failed: 0
    })
    
    // Computed property for private key count
    const privateKeyCount = computed(() => {
      if (!importPrivateKey.value.trim()) return 0
      return importPrivateKey.value
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .length
    })
    
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
    
    // Computed property for wallets with tokens
    const walletsWithTokens = computed(() => {
      return wallets.value.filter(wallet => 
        wallet.firstQueryDone && 
        wallet.tools && 
        !wallet.loading &&
        hasTokenBalance(wallet.tokenBalance)
      ).length
    })
    
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
    
    // Toggle public key display
    const togglePublicKeyDisplay = (index) => {
      if (wallets.value[index]) {
        wallets.value[index].showFullPublicKey = !wallets.value[index].showFullPublicKey
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
            const wallet = wallets.value[index]
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
    
    // Test connection function
    const testConnection = async () => {
      try {
        console.log('Testing connection with config:', config)
        
        if (!config.rpcUrl) {
          throw new Error('No RPC URL configured')
        }
        
        const { Connection } = await import('@solana/web3.js')
        const connection = new Connection(config.rpcUrl, 'confirmed')
        
        console.log('Testing connection to:', config.rpcUrl)
        const version = await connection.getVersion()
        console.log('Connection successful, version:', version)
        
        alert(`Connection successful!\nRPC: ${config.rpcUrl}\nVersion: ${version['solana-core']}`)
      } catch (error) {
        console.error('Connection test failed:', error)
        alert(`Connection failed: ${error.message}`)
      }
    }
    
    // Format token balance for display
    const formatTokenBalance = (balance) => {
      if (!balance || balance === '0') return '0.000000'
      const numBalance = Number(balance) / 1000000
      return numBalance.toFixed(6)
    }
    
    // Check if wallet has token balance
    const hasTokenBalance = (balance) => {
      return balance && balance !== '0' && Number(balance) > 0
    }
    
    // Format SOL balance for display
    const formatSolBalance = (balance) => {
      if (!balance) return '0.000'
      return Number(balance).toFixed(3)
    }
    
    // Refresh token balance
    const refreshTokenBalance = async (index) => {
      const wallet = wallets.value[index]
      if (!wallet || !wallet.tools || wallet.loading) return
      
      try {
        wallet.loading = true
        const tokenBalance = await wallet.tools.getTokenBalance()
        wallet.tokenBalance = tokenBalance.toString()
        
        // Also refresh SOL balance
        const solBalance = await wallet.tools.getSolBalance()
        wallet.solBalance = solBalance
        
        // Update status to show refreshed balance
        const tokenBalanceReadable = (Number(tokenBalance) / 1000000).toFixed(6)
        wallet.status = `余额已刷新: ${tokenBalanceReadable} Tokens, ${formatSolBalance(solBalance)} SOL`
        
        // Reset status after 2 seconds
        setTimeout(() => {
          if (wallet.accountInfo) {
            wallet.status = `Found ${wallet.accountInfo.cards.length} cards | Berries: ${wallet.accountInfo.berries} | Tokens: ${tokenBalanceReadable} | SOL: ${formatSolBalance(solBalance)} | Hashpower: ${wallet.accountInfo.totalHashpower}`
          }
        }, 2000)
      } catch (error) {
        console.error('Failed to refresh token balance:', error)
        wallet.status = `Error refreshing balance: ${error.message}`
      } finally {
        wallet.loading = false
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
    
    // Copy to clipboard
    const copyToClipboard = async (text, index) => {
      try {
        await navigator.clipboard.writeText(text)
        // Show temporary feedback
        const wallet = wallets.value[index]
        const originalStatus = wallet.status
        wallet.status = '公钥已复制!'
        setTimeout(() => {
          wallet.status = originalStatus
        }, 2000)
      } catch (error) {
        console.error('Failed to copy to clipboard:', error)
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = text
        document.body.appendChild(textArea)
        textArea.select()
        try {
          document.execCommand('copy')
          const wallet = wallets.value[index]
          const originalStatus = wallet.status
          wallet.status = '公钥已复制!'
          setTimeout(() => {
            wallet.status = originalStatus
          }, 2000)
        } catch (fallbackError) {
          console.error('Fallback copy failed:', fallbackError)
        }
        document.body.removeChild(textArea)
      }
    }
    
    // Private key import methods
    const closeImportDialog = () => {
      showImportDialog.value = false
      importPrivateKey.value = ''
      importMessage.value = ''
      importError.value = false
      importProgress.value = {
        current: 0,
        total: 0,
        success: 0,
        failed: 0
      }
    }
    
    const handleBatchImportWallet = async () => {
      if (!importPrivateKey.value.trim()) {
        importMessage.value = '请输入私钥'
        importError.value = true
        return
      }
      
      // Parse private keys from input
      const privateKeys = importPrivateKey.value
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
      
      if (privateKeys.length === 0) {
        importMessage.value = '请输入有效的私钥'
        importError.value = true
        return
      }
      
      importLoading.value = true
      importMessage.value = ''
      importError.value = false
      importProgress.value = {
        current: 0,
        total: privateKeys.length,
        success: 0,
        failed: 0
      }
      
      try {
        for (let i = 0; i < privateKeys.length; i++) {
          const privateKey = privateKeys[i]
          importProgress.value.current = i + 1
          
          try {
            const result = await importWalletByPrivateKey(privateKey)
            
            if (result.success) {
              importProgress.value.success++
            } else {
              importProgress.value.failed++
              console.error(`Failed to import wallet ${i + 1}:`, result.message)
            }
          } catch (error) {
            importProgress.value.failed++
            console.error(`Error importing wallet ${i + 1}:`, error)
          }
          
          // Add a small delay to prevent overwhelming the UI
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        
        // Show final result
        if (importProgress.value.success > 0) {
          importMessage.value = `批量导入完成！成功导入 ${importProgress.value.success} 个钱包，失败 ${importProgress.value.failed} 个`
          importError.value = false
          
          // Auto-close dialog after showing success message
          setTimeout(() => {
            closeImportDialog()
          }, 3000)
        } else {
          importMessage.value = '批量导入失败：所有私钥都无法导入'
          importError.value = true
        }
        
      } catch (error) {
        console.error('Batch import failed:', error)
        importMessage.value = `批量导入失败: ${error.message}`
        importError.value = true
      } finally {
        importLoading.value = false
      }
    }
    
    // Keep the original single import method for backward compatibility
    const handleImportWallet = async () => {
      if (!importPrivateKey.value.trim()) {
        importMessage.value = '请输入私钥'
        importError.value = true
        return
      }
      
      importLoading.value = true
      importMessage.value = ''
      importError.value = false
      
      try {
        const result = await importWalletByPrivateKey(importPrivateKey.value.trim())
        
        if (result.success) {
          importMessage.value = result.message
          importError.value = false
          
          // 延迟关闭对话框以显示成功消息
          setTimeout(() => {
            closeImportDialog()
          }, 2000)
        } else {
          importMessage.value = result.message
          importError.value = true
        }
      } catch (error) {
        console.error('Import wallet failed:', error)
        importMessage.value = `导入失败: ${error.message}`
        importError.value = true
      } finally {
        importLoading.value = false
      }
    }
    
    // Initialize on mount
    onMounted(async () => {
      try {
        console.log('Initializing application...')
        
        loadConfig()
        console.log('Current config:', config)
        
        if (!config.rpcUrl) {
          console.log('No RPC URL found, applying devnet preset')
          applyPreset('devnet')
        }
        
        console.log('Loading existing wallets...')
        const loadedWallets = loadWallets(config)
        console.log('Loaded wallets:', loadedWallets.length)
        
        // Auto-initialize and query cards for loaded wallets
        for (let index = 0; index < loadedWallets.length; index++) {
          if (loadedWallets[index].privateKey) {
            console.log(`Auto-initializing wallet ${index}`)
            try {
              await initializeWallet(index)
            } catch (error) {
              console.error(`Failed to initialize wallet ${index}:`, error)
            }
          }
        }
        
        console.log('Application initialization complete')
      } catch (error) {
        console.error('Failed to initialize application:', error)
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
      handleRemoveWallet,
      removeWallet,
      clearAllWallets,
      toggleCardsExpanded,
      
      // Import dialog
      showImportDialog,
      importPrivateKey,
      importLoading,
      importMessage,
      importError,
      importProgress,
      privateKeyCount,
      closeImportDialog,
      handleBatchImportWallet,
      handleImportWallet,
      
      // Batch operations
      handleBatchInitGameAccounts,
      batchLoading,
      availableForInit,
      canBatchInit,
      walletsWithTokens,
      batchTransferTokens,
      
      // Wallet operations
      initializeWallet,
      queryCards,
      initGameAccount,
      openBooster,
      claimReward,
      recycleCard,
      stakeCard,
      unstakeCard,
      
      // UI operations
      togglePublicKeyDisplay,
      copyToClipboard,
      testConnection,
      formatTokenBalance,
      formatSolBalance,
      hasTokenBalance,
      refreshTokenBalance,
      transferTokens
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

.unstake-btn {
  flex: 1;
  padding: 2px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 10px;
  margin-bottom: 2px;
}

.unstake-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.unstake-btn:hover:not(:disabled) {
  background: #c82333;
}

.staked-actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.staked-actions .staked-label {
  width: 100%;
  padding: 2px;
  background: #ffc107;
  color: #333;
  text-align: center;
  border-radius: 3px;
  font-size: 9px;
  font-weight: bold;
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

.token-balance h4 {
  margin: 0 0 4px 0;
  color: #2c3e50;
  font-size: 12px;
}

.balance-container {
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

.balance-actions {
  display: flex;
  gap: 4px;
}

.refresh-balance-btn {
  background: #3498db;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
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
  background: #e74c3c;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
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

/* Animation for balance updates */
.balance-amount {
  transition: all 0.3s ease;
}

.balance-amount:hover {
  transform: scale(1.02);
}

/* Import Dialog Styles */
.import-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.import-dialog {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e5e5;
  background: #f8f9fa;
  border-radius: 8px 8px 0 0;
}

.dialog-header h3 {
  margin: 0;
  color: #333;
  font-size: 18px;
}

.dialog-header .close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.dialog-header .close-btn:hover {
  background: #e9ecef;
  color: #333;
}

.dialog-content {
  padding: 20px;
}

.dialog-content .input-group {
  margin-bottom: 16px;
}

.dialog-content .input-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: bold;
  color: #333;
  font-size: 14px;
}

.private-key-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  font-family: monospace;
  resize: vertical;
  min-height: 120px;
  box-sizing: border-box;
  line-height: 1.4;
}

.private-key-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.import-info {
  margin-top: 8px;
  padding: 6px 10px;
  background: #e8f4f8;
  border-radius: 4px;
  border: 1px solid #b8e0d2;
}

.key-count {
  color: #2c3e50;
  font-size: 13px;
  font-weight: 500;
}

.import-progress {
  margin-top: 16px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 4px;
  border: 1px solid #e5e5e5;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #007bff, #0056b3);
  transition: width 0.3s ease;
  border-radius: 4px;
}

.progress-text {
  font-size: 13px;
  color: #666;
  text-align: center;
  font-weight: 500;
}

.dialog-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.import-btn {
  flex: 1;
  padding: 12px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.import-btn:hover:not(:disabled) {
  background: #0056b3;
  transform: translateY(-1px);
}

.import-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
  transform: none;
}

.cancel-btn {
  flex: 1;
  padding: 12px 16px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.cancel-btn:hover {
  background: #5a6268;
  transform: translateY(-1px);
}

.import-message {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 4px;
  font-size: 14px;
  text-align: center;
  font-weight: 500;
}

.import-message:not(.error) {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.import-message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.wallet-controls button {
  padding: 4px 8px;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
  border-radius: 3px;
  font-size: 12px;
}

.wallet-controls button:hover {
  background: #f8f9fa;
}
</style>