import { defineStore } from 'pinia'
import { ref, watch, computed } from 'vue'
import { Keypair } from '@solana/web3.js'
import bs58 from 'bs58'
import { SolanaWalletTools } from '../utils/solanaTools.js'
import { STORAGE_KEYS, WALLET_STATUS, FILE_SIZE_LIMITS } from '../utils/constants.js'
import { StorageHelper, Validator, deepClone } from '../utils/helpers.js'

export const useWalletStore = defineStore('wallet', () => {
  // State
  const wallets = ref([])
  
  // Store pending rewards data
  const pendingRewards = ref(new Map()) // Map<walletIndex, rewardAmount>

  // Computed
  const totalPendingRewards = computed(() => {
    let total = 0
    for (const [walletIndex, rewardAmount] of pendingRewards.value) {
      if (typeof rewardAmount === 'number' && rewardAmount > 0) {
        total += rewardAmount
      }
    }
    return total
  })

  const formattedTotalPendingRewards = computed(() => {
    return Number(totalPendingRewards.value).toLocaleString('en-US', {
      minimumFractionDigits: 3,
      maximumFractionDigits: 6
    })
  })

  // Actions
  /**
   * 创建默认的钱包对象
   */
  const createDefaultWallet = (privateKey, publicKey) => {
    return {
      id: Date.now() + Math.random(), // 确保唯一性
      privateKey,
      publicKey,
      tools: null,
      status: WALLET_STATUS.NOT_INITIALIZED,
      loading: false,
      cards: [],
      cardsExpanded: false,
      accountInitialized: false,
      accountInfo: null,
      firstQueryDone: false,
      showFullPublicKey: false, // 默认不显示完整公钥
      tokenBalance: '0', // 代币余额
      solBalance: '0' // SOL余额
    }
  }

  /**
   * 加载钱包数据
   */
  const loadWallets = (config) => {
    try {
      const savedWallets = StorageHelper.get(STORAGE_KEYS.SOLANA_WALLETS, [])
      
      if (!Array.isArray(savedWallets)) {
        console.warn('Invalid wallet data format, using empty array')
        return []
      }

      // 验证和清理数据
      const validWallets = savedWallets
        .filter(wallet => {
          // 基本验证
          if (!wallet || typeof wallet !== 'object') return false
          if (!wallet.privateKey || !Validator.isValidPrivateKey(wallet.privateKey)) {
            console.warn('Invalid private key found, skipping wallet')
            return false
          }
          return true
        })
        .map(wallet => {
          // 创建完整的钱包对象
          const fullWallet = createDefaultWallet(wallet.privateKey, wallet.publicKey)
          
          // 合并保存的状态
          Object.assign(fullWallet, {
            ...wallet,
            // 重置运行时状态
            tools: null,
            loading: false,
            status: WALLET_STATUS.NOT_INITIALIZED
          })

          // 重新初始化工具
          if (config && config.rpcUrl) {
            try {
              fullWallet.tools = new SolanaWalletTools(wallet.privateKey, config)
            } catch (error) {
              console.error('Failed to initialize wallet tools:', error)
            }
          }

          return fullWallet
        })

      wallets.value = validWallets
      return validWallets
    } catch (error) {
      console.error('Failed to load wallets:', error)
      wallets.value = []
      return []
    }
  }

  /**
   * 保存钱包数据
   */
  const saveWallets = () => {
    try {
      // 创建可序列化的钱包数据（排除 tools 等不可序列化的属性）
      const serializableWallets = wallets.value.map(wallet => {
        const { tools, ...serializableWallet } = wallet
        return serializableWallet
      })

      StorageHelper.set(STORAGE_KEYS.SOLANA_WALLETS, serializableWallets)
    } catch (error) {
      console.error('Failed to save wallets:', error)
    }
  }

  /**
   * 添加新钱包
   */
  const addWallet = (privateKey = null) => {
    try {
      // 检查钱包数量限制
      if (wallets.value.length >= FILE_SIZE_LIMITS.MAX_WALLETS) {
        throw new Error(`Maximum ${FILE_SIZE_LIMITS.MAX_WALLETS} wallets allowed`)
      }

      let keypair
      let privateKeyBase58
      
      if (privateKey) {
        // 使用提供的私钥
        if (!Validator.isValidPrivateKey(privateKey)) {
          throw new Error('Invalid private key format')
        }
        privateKeyBase58 = privateKey
        const secretKey = bs58.decode(privateKey)
        keypair = Keypair.fromSecretKey(secretKey)
      } else {
        // 生成新的随机密钥对
        keypair = Keypair.generate()
        privateKeyBase58 = bs58.encode(keypair.secretKey)
      }

      // 检查是否已存在相同的钱包
      const existingWallet = wallets.value.find(w => w.privateKey === privateKeyBase58)
      if (existingWallet) {
        throw new Error('Wallet already exists')
      }

      const newWallet = createDefaultWallet(
        privateKeyBase58,
        keypair.publicKey.toBase58()
      )

      wallets.value.push(newWallet)
      
      // 返回新添加钱包的索引
      return wallets.value.length - 1
    } catch (error) {
      console.error('Failed to add wallet:', error)
      throw error
    }
  }

  /**
   * 移除钱包
   */
  const removeWallet = (index) => {
    try {
      if (index < 0 || index >= wallets.value.length) {
        throw new Error('Invalid wallet index')
      }

      const wallet = wallets.value[index]
      
      // 清理工具资源
      if (wallet.tools) {
        wallet.tools = null
      }

      wallets.value.splice(index, 1)
    } catch (error) {
      console.error('Failed to remove wallet:', error)
      throw error
    }
  }

  /**
   * 清空所有钱包
   */
  const clearAllWallets = () => {
    try {
      const confirmed = confirm(`确认清空所有钱包?\n\n当前有 ${wallets.value.length} 个钱包\n\n此操作无法撤销！`)
      
      if (!confirmed) {
        return false
      }

      // 清理所有工具资源
      wallets.value.forEach(wallet => {
        if (wallet.tools) {
          wallet.tools = null
        }
      })

      wallets.value = []
      return true
    } catch (error) {
      console.error('Failed to clear wallets:', error)
      throw error
    }
  }

  /**
   * 切换卡片展开状态
   */
  const toggleCardsExpanded = (index) => {
    try {
      if (index < 0 || index >= wallets.value.length) {
        throw new Error('Invalid wallet index')
      }

      wallets.value[index].cardsExpanded = !wallets.value[index].cardsExpanded
    } catch (error) {
      console.error('Failed to toggle cards expanded:', error)
    }
  }

  /**
   * 更新钱包状态
   */
  const updateWalletStatus = (index, status) => {
    try {
      if (index < 0 || index >= wallets.value.length) {
        throw new Error('Invalid wallet index')
      }

      wallets.value[index].status = status
    } catch (error) {
      console.error('Failed to update wallet status:', error)
    }
  }

  /**
   * 获取钱包统计信息
   */
  const getWalletStats = () => {
    const stats = {
      total: wallets.value.length,
      initialized: 0,
      accountInitialized: 0,
      withCards: 0,
      loading: 0,
      error: 0
    }

    wallets.value.forEach(wallet => {
      if (wallet.tools) stats.initialized++
      if (wallet.accountInitialized) stats.accountInitialized++
      if (wallet.cards && wallet.cards.length > 0) stats.withCards++
      if (wallet.loading) stats.loading++
      if (wallet.status && wallet.status.includes('Error')) stats.error++
    })

    return stats
  }

  /**
   * 根据状态筛选钱包
   */
  const getWalletsByStatus = (statusFilter) => {
    return wallets.value
      .map((wallet, index) => ({ wallet, index }))
      .filter(({ wallet }) => {
        switch (statusFilter) {
          case 'initialized':
            return wallet.tools !== null
          case 'accountInitialized':
            return wallet.accountInitialized
          case 'notInitialized':
            return !wallet.accountInitialized && wallet.firstQueryDone
          case 'loading':
            return wallet.loading
          case 'error':
            return wallet.status && wallet.status.includes('Error')
          default:
            return true
        }
      })
  }

  /**
   * 批量导入钱包
   */
  const importWallets = (privateKeys) => {
    try {
      if (!Array.isArray(privateKeys)) {
        throw new Error('Private keys must be an array')
      }

      const results = []
      
      for (const privateKey of privateKeys) {
        try {
          const index = addWallet(privateKey)
          results.push({ success: true, index, privateKey })
        } catch (error) {
          results.push({ success: false, error: error.message, privateKey })
        }
      }

      return results
    } catch (error) {
      console.error('Failed to import wallets:', error)
      throw error
    }
  }

  /**
   * 导出钱包数据
   */
  const exportWallets = () => {
    try {
      return wallets.value.map(wallet => ({
        privateKey: wallet.privateKey,
        publicKey: wallet.publicKey,
        accountInitialized: wallet.accountInitialized,
        status: wallet.status
      }))
    } catch (error) {
      console.error('Failed to export wallets:', error)
      throw error
    }
  }

  /**
   * 刷新钱包余额
   */
  const refreshBalance = async (index) => {
    try {
      if (index < 0 || index >= wallets.value.length) {
        throw new Error('Invalid wallet index')
      }

      const wallet = wallets.value[index]
      if (!wallet || !wallet.tools || wallet.loading) {
        console.warn('Wallet not ready for balance refresh')
        return false
      }

      wallet.loading = true
      
      try {
        // 获取代币余额
        const tokenBalance = await wallet.tools.getTokenBalance()
        wallet.tokenBalance = tokenBalance.toString()
        
        // 获取SOL余额
        const solBalance = await wallet.tools.getSolBalance()
        wallet.solBalance = solBalance
        
        // 更新状态显示刷新成功
        const tokenBalanceReadable = (Number(tokenBalance) / 1000000).toFixed(6)
        const solBalanceReadable = Number(solBalance).toFixed(3)
        wallet.status = `余额已刷新: ${tokenBalanceReadable} Tokens, ${solBalanceReadable} SOL`
        
        // 2秒后恢复原状态
        setTimeout(() => {
          if (wallet.accountInfo) {
            wallet.status = `Found ${wallet.accountInfo.cards.length} cards | Berries: ${wallet.accountInfo.berries} | Tokens: ${tokenBalanceReadable} | SOL: ${solBalanceReadable} | Hashpower: ${wallet.accountInfo.totalHashpower}`
          }
        }, 2000)
        
        return true
      } catch (error) {
        console.error('Failed to refresh balance:', error)
        wallet.status = `Error refreshing balance: ${error.message}`
        return false
      } finally {
        wallet.loading = false
      }
    } catch (error) {
      console.error('Failed to refresh wallet balance:', error)
      throw error
    }
  }

  /**
   * 更新指定钱包的待领取奖励
   */
  const updatePendingRewards = (walletIndex, rewardAmount) => {
    try {
      // Create a new Map to trigger reactivity
      const newMap = new Map(pendingRewards.value)
      newMap.set(walletIndex, rewardAmount)
      pendingRewards.value = newMap
    } catch (error) {
      console.error('Failed to update pending rewards:', error)
    }
  }

  /**
   * 移除指定钱包的待领取奖励记录
   */
  const removePendingRewards = (walletIndex) => {
    try {
      const newMap = new Map(pendingRewards.value)
      newMap.delete(walletIndex)
      pendingRewards.value = newMap
    } catch (error) {
      console.error('Failed to remove pending rewards:', error)
    }
  }

  /**
   * 清空所有待领取奖励记录
   */
  const clearAllPendingRewards = () => {
    try {
      pendingRewards.value = new Map()
    } catch (error) {
      console.error('Failed to clear pending rewards:', error)
    }
  }

  // Watchers
  // 监听钱包变化，自动保存（但排除 tools 属性）
  watch(wallets, () => {
    saveWallets()
  }, { deep: true })

  return {
    // State
    wallets,
    pendingRewards,
    
    // Computed
    totalPendingRewards,
    formattedTotalPendingRewards,
    
    // Actions
    loadWallets,
    saveWallets,
    addWallet,
    removeWallet,
    clearAllWallets,
    toggleCardsExpanded,
    updateWalletStatus,
    getWalletStats,
    getWalletsByStatus,
    importWallets,
    exportWallets,
    refreshBalance,
    updatePendingRewards,
    removePendingRewards,
    clearAllPendingRewards
  }
})