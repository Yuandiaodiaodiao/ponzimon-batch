import { SolanaWalletTools } from '../utils/solanaTools.js'
import { ErrorHandler } from '../utils/helpers.js'
import { WALLET_STATUS, DEFAULT_CONFIG } from '../utils/constants.js'

/**
 * 钱包操作基类 - 提供公共的操作模式
 */
class WalletOperationBase {
  constructor(wallets, config, saveWallets) {
    this.wallets = wallets
    this.config = config
    this.saveWallets = saveWallets
  }

  /**
   * 通用的钱包操作包装器
   * @param {number} walletIndex - 钱包索引
   * @param {string} loadingStatus - 加载状态文本
   * @param {string} successStatus - 成功状态文本
   * @param {Function} operation - 要执行的操作
   * @param {Function} afterOperation - 操作完成后的回调
   * @returns {Promise<any>} 操作结果
   */
  async executeWalletOperation(walletIndex, loadingStatus, successStatus, operation, afterOperation = null) {
    const wallet = this.wallets.value[walletIndex]
    if (!wallet?.tools) {
      throw new Error('Wallet tools not initialized')
    }

    const originalStatus = wallet.status
    
    try {
      wallet.loading = true
      wallet.status = loadingStatus
      
      const result = await ErrorHandler.handleAsyncOperation(
        () => operation(wallet.tools),
        {
          retryCount: DEFAULT_CONFIG.RETRY_COUNT,
          retryDelay: DEFAULT_CONFIG.RETRY_DELAY,
          onError: (error, attempt) => {
            console.error(`Operation failed (attempt ${attempt}):`, error)
            wallet.status = `${loadingStatus} (Retry ${attempt}/${DEFAULT_CONFIG.RETRY_COUNT})`
          }
        }
      )
      
      wallet.status = successStatus
      
      if (afterOperation) {
        await afterOperation(walletIndex, result)
      }
      
      return result
    } catch (error) {
      wallet.status = `Error: ${ErrorHandler.formatError(error)}`
      console.error('Wallet operation failed:', error)
      throw error
    } finally {
      wallet.loading = false
    }
  }

  /**
   * 批量操作处理器
   * @param {Array} targetWallets - 目标钱包列表
   * @param {Function} operation - 要执行的操作
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 批量操作结果
   */
  async executeBatchOperation(targetWallets, operation, options = {}) {
    const { 
      concurrent = false, 
      delay = DEFAULT_CONFIG.BATCH_DELAY,
      onProgress = null 
    } = options

    const results = []
    let successCount = 0
    let failedCount = 0

    if (concurrent) {
      // 并发执行
      const promises = targetWallets.map(async ({ index }) => {
        try {
          await operation(index)
          successCount++
          return { walletIndex: index, success: true }
        } catch (error) {
          failedCount++
          return { walletIndex: index, success: false, error: error.message }
        }
      })

      const batchResults = await Promise.all(promises)
      results.push(...batchResults)
    } else {
      // 顺序执行
      for (const { index } of targetWallets) {
        try {
          await operation(index)
          successCount++
          results.push({ walletIndex: index, success: true })
          
          if (onProgress) {
            onProgress(results.length, targetWallets.length)
          }
          
          // 操作间延迟
          if (delay > 0 && index < targetWallets.length - 1) {
            await ErrorHandler.delay(delay)
          }
        } catch (error) {
          failedCount++
          results.push({ walletIndex: index, success: false, error: error.message })
          console.error(`Batch operation failed for wallet ${index + 1}:`, error)
        }
      }
    }

    return {
      success: successCount,
      failed: failedCount,
      results
    }
  }
}

/**
 * 钱包操作管理器
 */
export class WalletOperationManager extends WalletOperationBase {
  constructor(wallets, config, saveWallets, addWallet) {
    super(wallets, config, saveWallets)
    this.addWallet = addWallet
  }
  /**
   * 初始化钱包
   */
  async initializeWallet(index) {
    const wallet = this.wallets.value[index]
    if (!wallet?.privateKey) {
      throw new Error('Private key not found')
    }

    const originalStatus = wallet.status
    
    try {
      wallet.loading = true
      wallet.status = WALLET_STATUS.LOADING
      
      // 直接初始化钱包工具，不使用 executeWalletOperation
      wallet.tools = new SolanaWalletTools(wallet.privateKey, this.config)
      wallet.publicKey = wallet.tools.getPublicKey()
      this.saveWallets()
      
      wallet.status = WALLET_STATUS.INITIALIZED
      
      // 初始化后自动查询卡片
      await this.queryCards(index)
      
      return wallet.tools
    } catch (error) {
      wallet.status = `Error: ${ErrorHandler.formatError(error)}`
      console.error('Wallet initialization failed:', error)
      throw error
    } finally {
      wallet.loading = false
    }
  }

  /**
   * 查询卡片信息
   */
  async queryCards(index) {
    return await this.executeWalletOperation(
      index,
      WALLET_STATUS.QUERYING,
      'Cards queried successfully',
      async (tools) => {
        console.log('Starting to query user account info...')
        
        // 添加超时机制
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Query timeout after 30 seconds')), 30000)
        })
        
        const accountInfo = await Promise.race([
          tools.getUserAccountInfo(),
          timeoutPromise
        ])
        
        console.log('Account info result:', accountInfo)
        
        const wallet = this.wallets.value[index]
        
        if (!accountInfo) {
          wallet.accountInitialized = false
          wallet.cards = []
          wallet.accountInfo = null
          wallet.tokenBalance = '0'
          wallet.status = WALLET_STATUS.ACCOUNT_NOT_INITIALIZED
        } else {
          wallet.accountInitialized = true
          wallet.cards = accountInfo.cards
          wallet.accountInfo = accountInfo
          
          // 获取代币余额
          try {
            const tokenBalance = await tools.getTokenBalance()
            wallet.tokenBalance = tokenBalance.toString()
            const tokenBalanceReadable = (Number(tokenBalance) / 1000000).toFixed(6)
            wallet.status = `Found ${accountInfo.cards.length} cards | Berries: ${accountInfo.berries} | Tokens: ${tokenBalanceReadable} | Hashpower: ${accountInfo.totalHashpower}`
          } catch (error) {
            wallet.tokenBalance = '0'
            wallet.status = `Found ${accountInfo.cards.length} cards | Berries: ${accountInfo.berries} | Hashpower: ${accountInfo.totalHashpower}`
          }
        }
        
        wallet.firstQueryDone = true
        return accountInfo
      }
    )
  }

  /**
   * 初始化游戏账户
   */
  async initGameAccount(index) {
    return await this.executeWalletOperation(
      index,
      WALLET_STATUS.INITIALIZING_GAME_ACCOUNT,
      WALLET_STATUS.GAME_ACCOUNT_INITIALIZED,
      async (tools) => {
        return await tools.initGameAccountTransaction()
      },
      async (walletIndex) => {
        // 初始化后刷新卡片信息
        await this.queryCards(walletIndex)
      }
    )
  }

  /**
   * 打开补充包
   */
  async openBooster(index) {
    return await this.executeWalletOperation(
      index,
      WALLET_STATUS.OPENING_BOOSTER,
      WALLET_STATUS.BOOSTER_OPENED,
      async (tools) => {
        return await tools.openBooster()
      }
    )
  }

  /**
   * 领取奖励
   */
  async claimReward(index) {
    return await this.executeWalletOperation(
      index,
      WALLET_STATUS.CLAIMING_REWARD,
      WALLET_STATUS.REWARD_CLAIMED,
      async (tools) => {
        return await tools.executeClaimReward()
      }
    )
  }

  /**
   * 回收卡片
   */
  async recycleCard(walletIndex, cardIndex) {
    return await this.executeWalletOperation(
      walletIndex,
      WALLET_STATUS.RECYCLING_CARD,
      WALLET_STATUS.CARD_RECYCLED,
      async (tools) => {
        return await tools.recycleCard(cardIndex)
      },
      async (walletIndex) => {
        // 回收后刷新卡片信息
        await this.queryCards(walletIndex)
      }
    )
  }

  /**
   * 质押卡片
   */
  async stakeCard(walletIndex, cardIndex) {
    return await this.executeWalletOperation(
      walletIndex,
      WALLET_STATUS.STAKING_CARD,
      WALLET_STATUS.CARD_STAKED,
      async (tools) => {
        return await tools.stakeCard(cardIndex)
      },
      async (walletIndex) => {
        // 质押后刷新卡片信息
        await this.queryCards(walletIndex)
      }
    )
  }

  /**
   * 批量初始化游戏账户
   */
  async batchInitGameAccounts() {
    // 筛选需要初始化的钱包
    const targetWallets = this.wallets.value
      .map((wallet, index) => ({ wallet, index }))
      .filter(({ wallet }) => 
        wallet.firstQueryDone && 
        !wallet.accountInitialized && 
        wallet.tools && 
        !wallet.loading
      )

    if (targetWallets.length === 0) {
      console.log('No wallets available for batch initialization')
      return { success: 0, failed: 0, results: [] }
    }

    console.log(`Starting batch initialization for ${targetWallets.length} wallets`)

    const result = await this.executeBatchOperation(
      targetWallets,
      (index) => this.initGameAccount(index),
      {
        concurrent: false, // 顺序执行，避免网络压力
        delay: DEFAULT_CONFIG.BATCH_DELAY,
        onProgress: (completed, total) => {
          console.log(`Batch initialization progress: ${completed}/${total}`)
        }
      }
    )

    console.log('Batch initialization completed:', result)
    return result
  }

  /**
   * 批量查询卡片
   */
  async batchQueryCards() {
    const targetWallets = this.wallets.value
      .map((wallet, index) => ({ wallet, index }))
      .filter(({ wallet }) => wallet.tools && !wallet.loading)

    if (targetWallets.length === 0) {
      return { success: 0, failed: 0, results: [] }
    }

    return await this.executeBatchOperation(
      targetWallets,
      (index) => this.queryCards(index),
      {
        concurrent: true, // 查询可以并发执行
        delay: 0
      }
    )
  }

  /**
   * 批量开启补充包
   */
  async batchOpenBoosters() {
    const targetWallets = this.wallets.value
      .map((wallet, index) => ({ wallet, index }))
      .filter(({ wallet }) => 
        wallet.accountInitialized && 
        wallet.tools && 
        !wallet.loading
      )

    if (targetWallets.length === 0) {
      return { success: 0, failed: 0, results: [] }
    }

    return await this.executeBatchOperation(
      targetWallets,
      (index) => this.openBooster(index),
      {
        concurrent: false,
        delay: DEFAULT_CONFIG.BATCH_DELAY
      }
    )
  }

  /**
   * 批量领取奖励
   */
  async batchClaimRewards() {
    const targetWallets = this.wallets.value
      .map((wallet, index) => ({ wallet, index }))
      .filter(({ wallet }) => 
        wallet.accountInitialized && 
        wallet.tools && 
        !wallet.loading
      )

    if (targetWallets.length === 0) {
      return { success: 0, failed: 0, results: [] }
    }

    return await this.executeBatchOperation(
      targetWallets,
      (index) => this.claimReward(index),
      {
        concurrent: false,
        delay: DEFAULT_CONFIG.BATCH_DELAY
      }
    )
  }

  /**
   * 通过私钥导入钱包
   */
  async importWalletByPrivateKey(privateKey) {
    try {
      // 直接调用 addWallet 方法添加钱包
      const walletIndex = this.addWallet(privateKey)
      
      // 自动初始化导入的钱包
      await this.initializeWallet(walletIndex)
      
      return {
        success: true,
        walletIndex,
        message: `钱包导入成功 (索引: ${walletIndex})`
      }
    } catch (error) {
      console.error('Import wallet failed:', error)
      return {
        success: false,
        error: error.message,
        message: `导入失败: ${error.message}`
      }
    }
  }
}

/**
 * 钱包操作组合式API
 */
export function useWalletOperations(wallets, config, saveWallets, addWallet) {
  const operationManager = new WalletOperationManager(wallets, config, saveWallets, addWallet)

  return {
    // 单个钱包操作
    initializeWallet: (index) => operationManager.initializeWallet(index),
    queryCards: (index) => operationManager.queryCards(index),
    initGameAccount: (index) => operationManager.initGameAccount(index),
    openBooster: (index) => operationManager.openBooster(index),
    claimReward: (index) => operationManager.claimReward(index),
    recycleCard: (walletIndex, cardIndex) => operationManager.recycleCard(walletIndex, cardIndex),
    stakeCard: (walletIndex, cardIndex) => operationManager.stakeCard(walletIndex, cardIndex),
    
    // 私钥导入
    importWalletByPrivateKey: (privateKey) => operationManager.importWalletByPrivateKey(privateKey),
    
    // 批量操作
    batchInitGameAccounts: () => operationManager.batchInitGameAccounts(),
    batchQueryCards: () => operationManager.batchQueryCards(),
    batchOpenBoosters: () => operationManager.batchOpenBoosters(),
    batchClaimRewards: () => operationManager.batchClaimRewards()
  }
}