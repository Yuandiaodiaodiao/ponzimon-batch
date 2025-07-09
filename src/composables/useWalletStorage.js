import { ref, watch } from 'vue'
import { Keypair } from '@solana/web3.js'
import bs58 from 'bs58'
import { SolanaWalletTools } from '../utils/solanaTools.js'
import { STORAGE_KEYS, WALLET_STATUS, FILE_SIZE_LIMITS } from '../utils/constants.js'
import { StorageHelper, Validator, deepClone } from '../utils/helpers.js'

export function useWalletStorage() {
  const wallets = ref([])

  // 监听钱包变化，自动保存（但排除 tools 属性）
  watch(wallets, () => {
    saveWallets()
  }, { deep: true })

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
      tokenBalance: '0' // 代币余额
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
      // 清理所有工具资源
      wallets.value.forEach(wallet => {
        if (wallet.tools) {
          wallet.tools = null
        }
      })

      wallets.value = []
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

  return {
    wallets,
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
    exportWallets
  }
}