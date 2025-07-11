import { defineStore } from 'pinia'
import { SolanaWalletTools } from '../utils/solanaTools.js'
import { ErrorHandler } from '../utils/helpers.js'
import { WALLET_STATUS, DEFAULT_CONFIG } from '../utils/constants.js'
import { useWalletStore } from './useWalletStore.js'
import { useNetworkStore } from './useNetworkStore.js'
import { useFarmRuleStore } from './useFarmRuleStore.js'
import { useMasterWalletStore } from './useMasterWalletStore.js'
import { PublicKey } from '@solana/web3.js'

/**
 * 钱包操作基类 - 提供公共的操作模式
 */
class WalletOperationBase {
  constructor() {
    this.walletStore = useWalletStore()
    this.networkStore = useNetworkStore()
    this.farmRuleStore = useFarmRuleStore()
    this.masterWalletStore = useMasterWalletStore()
  }

  get wallets() {
    return this.walletStore.wallets
  }

  get config() {
    return this.networkStore.config
  }

  get saveWallets() {
    return this.walletStore.saveWallets
  }

  get addWallet() {
    return this.walletStore.addWallet
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
    const wallet = this.wallets[walletIndex]
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
          return { walletIndex: index, success: true }
        } catch (error) {
          return { walletIndex: index, success: false, error: error.message }
        }
      })

      const batchResults = await Promise.all(promises)
      results.push(...batchResults)
      
      // 统计成功和失败数量
      successCount = batchResults.filter(r => r.success).length
      failedCount = batchResults.filter(r => !r.success).length
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
  constructor() {
    super()
  }

  /**
   * 初始化钱包
   */
  async initializeWallet(index) {
    const wallet = this.wallets[index]
    if (!wallet?.privateKey) {
      throw new Error('Private key not found')
    }

    const originalStatus = wallet.status
    
    try {
      wallet.loading = true
      wallet.status = WALLET_STATUS.LOADING
      
      // Get master wallet keypair if enabled and valid
      let masterWallet = null
      if (this.masterWalletStore.isReady) {
        try {
          masterWallet = this.masterWalletStore.getMasterKeypair()
          console.log('Using master wallet for fee payment:', masterWallet.publicKey.toBase58())
        } catch (error) {
          console.warn('Failed to get master wallet, using own wallet for fees:', error)
        }
      }
      
      // 初始化钱包工具，传入主钱包
      wallet.tools = new SolanaWalletTools(wallet.privateKey, this.config, masterWallet)
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
        
        const wallet = this.wallets[index]
        
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
        // Get selected strategy from farm rule store
        const selectedStrategy = this.farmRuleStore.selectedStrategy
        console.log('Initializing game account with strategy:', selectedStrategy)
        
        // Check if master wallet is available and log fee payment info
        if (this.masterWalletStore.isReady) {
          console.log('Using master wallet for all transaction fees during account initialization')
          await this.masterWalletStore.validateMasterWallet()
        } else {
          console.log('Using individual wallet for transaction fees')
        }
        
        return await tools.initGameAccountTransaction(selectedStrategy)
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
  async claimReward(index,execTransfer=false) {
    return await this.executeWalletOperation(
      index,
      WALLET_STATUS.CLAIMING_REWARD,
      WALLET_STATUS.REWARD_CLAIMED,
      async (tools) => {
        return await tools.executeClaimReward(execTransfer)
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
   * 取消质押卡片
   */
  async unstakeCard(walletIndex, cardIndex) {
    return await this.executeWalletOperation(
      walletIndex,
      WALLET_STATUS.UNSTAKING_CARD,
      WALLET_STATUS.CARD_UNSTAKED,
      async (tools) => {
        return await tools.unstakeCard(cardIndex)
      },
      async (walletIndex) => {
        // 取消质押后刷新卡片信息
        await this.queryCards(walletIndex)
      }
    )
  }

  /**
   * 批量初始化游戏账户
   */
  async batchInitGameAccounts() {
    // 如果启用了主钱包，验证其可用性
    if (this.masterWalletStore.isReady) {
      try {
        await this.masterWalletStore.validateMasterWallet()
        console.log('Master wallet validated for batch initialization')
      } catch (error) {
        throw new Error(`Master wallet validation failed: ${error.message}`)
      }
    }

    // 筛选需要初始化的钱包
    const targetWallets = this.wallets
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

    console.log(`Starting batch initialization for ${targetWallets.length} wallets with master wallet: ${this.masterWalletStore.isReady ? 'enabled' : 'disabled'}`)

    const result = await this.executeBatchOperation(
      targetWallets,
      (index) => this.initGameAccount(index),
      {
        concurrent: true, // 并发执行提高效率
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
   * 钱包分组工具函数
   * @param {Array} wallets - 钱包数组
   * @param {number} groupSize - 每组大小，根据操作复杂度调整：
   *   - 开户操作：5个（指令复杂，交易大小限制）
   *   - Claim/归集操作：8个（指令相对简单）
   * @returns {Array} 分组后的钱包数组
   */
  groupWallets(wallets, groupSize = 10) {
    const groups = []
    for (let i = 0; i < wallets.length; i += groupSize) {
      groups.push(wallets.slice(i, i + groupSize))
    }
    console.log(`Grouped ${wallets.length} wallets into ${groups.length} groups of max ${groupSize} wallets each`)
    return groups
  }

  /**
   * 批量初始化游戏账户 - 合并到单个交易
   */
  async batchInitGameAccountsInSingleTx() {
    // 如果启用了主钱包，验证其可用性
    if (this.masterWalletStore.isReady) {
      try {
        await this.masterWalletStore.validateMasterWallet()
        console.log('Master wallet validated for batch initialization')
      } catch (error) {
        throw new Error(`Master wallet validation failed: ${error.message}`)
      }
    }

    // 筛选需要初始化的钱包
    const targetWallets = this.wallets
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

    // 使用较小的分组：每组最多5个钱包（开户操作指令复杂，交易容易超大小限制）
    const config = this.getConcurrencyConfig()
    const batches = this.groupWallets(targetWallets, config.batchSizes.accountCreation)

    console.log(`Starting batch initialization for ${targetWallets.length} wallets in ${batches.length} groups (max ${config.batchSizes.accountCreation} wallets per group, max ${config.maxConcurrency} concurrent)`)

    let totalSuccess = 0
    let totalFailed = 0
    const allResults = []

    // 使用并发控制，最多10个并发操作
    const semaphore = this.createSemaphore(config.maxConcurrency)

    // 创建所有批次的 Promise
    const batchPromises = batches.map(async (batch, batchIndex) => {
      return await semaphore.acquire(async () => {
        console.log(`Starting batch ${batchIndex + 1}/${batches.length} with ${batch.length} wallets`)
        try {
          const result = await this.executeBatchInitInSingleTransaction(batch)
          console.log(`Batch ${batchIndex + 1} completed: ${result.success} success, ${result.failed} failed`)
          return result
        } catch (error) {
          console.error(`Batch ${batchIndex + 1} transaction failed:`, error)
          // 如果批量交易失败，回退到单个交易处理
          console.log(`Falling back to individual transactions for batch ${batchIndex + 1}`)
          
          let batchSuccess = 0
          let batchFailed = 0
          const batchResults = []
          
          for (const { index } of batch) {
            try {
              await this.initGameAccount(index)
              batchSuccess++
              batchResults.push({ walletIndex: index, success: true })
            } catch (individualError) {
              batchFailed++
              batchResults.push({ walletIndex: index, success: false, error: individualError.message })
            }
          }
          
          return { success: batchSuccess, failed: batchFailed, results: batchResults }
        }
      })
    })

    // 等待所有批次完成
    const results = await Promise.all(batchPromises)
    
    // 汇总结果
    for (const result of results) {
      totalSuccess += result.success
      totalFailed += result.failed
      allResults.push(...result.results)
    }

    console.log('Batch initialization completed:', { success: totalSuccess, failed: totalFailed })
    return { success: totalSuccess, failed: totalFailed, results: allResults }
  }

  /**
   * 创建信号量来控制并发数量
   * @param {number} maxConcurrency - 最大并发数
   * @returns {Object} 信号量对象
   */
  createSemaphore(maxConcurrency) {
    let currentConcurrency = 0
    const waitingQueue = []

    return {
      async acquire(task) {
        return new Promise((resolve, reject) => {
          const executeTask = async () => {
            currentConcurrency++
            try {
              const result = await task()
              resolve(result)
            } catch (error) {
              reject(error)
            } finally {
              currentConcurrency--
              if (waitingQueue.length > 0) {
                const nextTask = waitingQueue.shift()
                nextTask()
              }
            }
          }

          if (currentConcurrency < maxConcurrency) {
            executeTask()
          } else {
            waitingQueue.push(executeTask)
          }
        })
      }
    }
  }

  /**
   * 获取批量操作的并发配置
   * @returns {Object} 并发配置
   */
  getConcurrencyConfig() {
    return {
      maxConcurrency: 10, // 最大并发数，可以根据需要调整
      batchSizes: {
        accountCreation: 4, // 开户操作每组钱包数
        claimRewards: 8,    // Claim操作每组钱包数  
        transfer: 8         // 转账操作每组钱包数
      }
    }
  }

  /**
   * 批量质押卡片和回收commit合并操作
   * @param {Array} walletBatch - 钱包批次
   * @param {number} stakeCardIndex - 要质押的卡片索引
   * @param {number} recycleCardIndex - 要回收的卡片索引
   * @param {string} description - 描述信息
   */
  async executeBatchStakeAndRecycleCommit(walletBatch, stakeCardIndex, recycleCardIndex, description) {
    const instructions = []
    const signers = []
    let masterWallet = null
    
    console.log(`Starting combined batch stake + recycle commit for ${walletBatch.length} wallets (${description})`)
    
    // 获取主钱包
    if (this.masterWalletStore.isReady) {
      masterWallet = this.masterWalletStore.getMasterKeypair()
      signers.push(masterWallet)
    }
    
    // 添加计算预算指令
    instructions.push(...this.createComputeBudgetInstructions())
    
    // 为每个钱包创建质押指令和回收commit指令
    for (const { wallet, index } of walletBatch) {
      try {
        wallet.status = `Preparing stake + recycle commit for ${description}...`
        
        // 1. 创建质押指令
        const stakeInstruction = await wallet.tools.createStakeCardInstruction(stakeCardIndex)
        instructions.push(stakeInstruction)
        
        // 2. 创建回收commit指令
        const recycleCommitInstruction = await wallet.tools.createRecycleCardsCommitInstruction([recycleCardIndex])
        instructions.push(recycleCommitInstruction)
        
        // 添加钱包作为签名者
        const walletKeypair = wallet.tools.wallet
        if (!signers.find(s => s.publicKey.equals(walletKeypair.publicKey))) {
          signers.push(walletKeypair)
        }
        
        console.log(`Wallet ${index}: Will stake card ${stakeCardIndex} and recycle commit card ${recycleCardIndex}`)
        
      } catch (error) {
        console.error(`Failed to create combined instructions for wallet ${index}:`, error)
        wallet.status = `Combined operation prep failed: ${error.message}`
        throw error
      }
    }
    
    try {
      // 执行合并的批量交易
      console.log(`Executing combined batch transaction with ${instructions.length} instructions for ${walletBatch.length} wallets`)
      
      const firstWallet = walletBatch[0].wallet
      const signature = await firstWallet.tools.buildAndSendBatchTransaction(instructions, signers)
      
      if (!signature) {
        throw new Error('Combined batch transaction failed')
      }
      
      console.log(`Combined batch stake + recycle commit completed for ${walletBatch.length} wallets`)
      
      // 更新所有钱包状态
      for (const { wallet, index } of walletBatch) {
        wallet.status = `Stake + recycle commit completed for ${description}`
      }
      
      return signature
      
    } catch (error) {
      console.error(`Combined batch operation failed for ${description}:`, error)
      
      // 更新失败钱包的状态
      for (const { wallet } of walletBatch) {
        wallet.status = `Combined operation failed: ${error.message}`
      }
      
      throw error
    }
  }

  /**
   * 在单个交易中执行多个钱包的初始化
   */
  async executeBatchInitInSingleTransaction(walletBatch) {
    const instructions = []
    const signers = []
    let masterWallet = null
    
    // 获取主钱包
    if (this.masterWalletStore.isReady) {
      masterWallet = this.masterWalletStore.getMasterKeypair()
      signers.push(masterWallet)
    }

    // 为每个钱包创建指令
    for (const { wallet, index } of walletBatch) {
      try {
        wallet.loading = true
        wallet.status = WALLET_STATUS.INITIALIZING_GAME_ACCOUNT
        
        // 添加计算预算指令（只在第一个钱包时添加）
        if (instructions.length === 0) {
          const computeBudgetInstructions = this.createComputeBudgetInstructions()
          instructions.push(...computeBudgetInstructions)
        }
        
        // 创建购买农场指令
        const farmInstruction = await wallet.tools.createPurchaseInitialFarmInstruction()
        instructions.push(farmInstruction)
        
        // 添加钱包作为签名者
        const walletKeypair = wallet.tools.wallet
        if (!signers.find(s => s.publicKey.equals(walletKeypair.publicKey))) {
          signers.push(walletKeypair)
        }
        
      } catch (error) {
        console.error(`Failed to create instructions for wallet ${index}:`, error)
        wallet.loading = false
        wallet.status = `Error: ${error.message}`
        throw error
      }
    }

    try {
      // 构建并发送合并交易（只包含农场购买）
      console.log(`Executing batch farm purchase transaction with ${instructions.length} instructions for ${walletBatch.length} wallets`)
      
      // 使用第一个钱包的工具发送交易
      const firstWallet = walletBatch[0].wallet
      const signature = await firstWallet.tools.buildAndSendBatchTransaction(instructions, signers)
      
      if (!signature) {
        throw new Error('Farm purchase transaction failed')
      }
      
      console.log('Batch farm purchase completed, now waiting for account state update...')
      
      // 等待交易确认并检查账户状态
      await new Promise(resolve => setTimeout(resolve, 1500)) // 减少等待时间
      
      // 验证所有钱包的账户状态
      console.log('Verifying account states before staking...')
      const accountStates = []
      
      for (const { wallet, index } of walletBatch) {
        try {
          wallet.status = 'Checking account state...'
          const accountInfo = await wallet.tools.getUserAccountInfo()
          
          if (!accountInfo || !accountInfo.cards || accountInfo.cards.length < 2) {
            console.error(`Wallet ${index} account not ready for staking:`, accountInfo)
            accountStates.push({ index, ready: false, reason: 'Cards not found' })
          } else {
            console.log(`Wallet ${index} ready for staking, found ${accountInfo.cards.length} cards`)
            accountStates.push({ index, ready: true })
          }
        } catch (error) {
          console.error(`Failed to check account state for wallet ${index}:`, error)
          accountStates.push({ index, ready: false, reason: error.message })
        }
      }
      
      const readyWallets = accountStates.filter(state => state.ready)
      console.log(`${readyWallets.length}/${walletBatch.length} wallets ready for staking`)
      
      if (readyWallets.length === 0) {
        console.log('No wallets ready for staking, skipping staking phase')
        
        // 更新所有钱包状态为农场已购买但未质押
        for (const { wallet } of walletBatch) {
          wallet.status = 'Farm purchased, staking skipped'
          wallet.loading = false
        }
        
        return {
          success: walletBatch.length,
          failed: 0,
          results: walletBatch.map(({ index }) => ({ walletIndex: index, success: true, note: 'Farm purchased only' }))
        }
      }
      
      // 第二步：分批质押卡片
      const selectedStrategy = this.farmRuleStore.selectedStrategy || 'stake_12'
      
      if (selectedStrategy === 'stake_12') {
        console.log('Executing batch staking strategy in two phases...')
        
        try {
          // Phase 1: 批量质押第一张卡片
          console.log('Phase 1: Batch staking first cards...')
          await this.executeBatchStakeCards(walletBatch, 0, 'first card')
          
          // 等待Phase 1完成
          await new Promise(resolve => setTimeout(resolve, 1000)) // 减少等待时间
          
          // Phase 2: 批量质押第二张卡片
          console.log('Phase 2: Batch staking second cards...')
          await this.executeBatchStakeCards(walletBatch, 1, 'second card')
          
        } catch (error) {
          console.error('Batch staking failed, falling back to individual staking:', error)
          
          // 回退到单独质押
          for (const { wallet, index } of walletBatch) {
            try {
              wallet.status = 'Individual staking...'
              await new Promise(resolve => setTimeout(resolve, 1000))
              
              try {
                await wallet.tools.stakeCardWithoutLock(0)
                console.log(`Individual staking card 0 for wallet ${index} succeeded`)
              } catch (e) {
                console.error(`Individual staking card 0 for wallet ${index} failed:`, e)
              }
              
              await new Promise(resolve => setTimeout(resolve, 500))
              
              try {
                await wallet.tools.stakeCardWithoutLock(1)
                console.log(`Individual staking card 1 for wallet ${index} succeeded`)
              } catch (e) {
                console.error(`Individual staking card 1 for wallet ${index} failed:`, e)
              }
              
              wallet.status = 'Individual staking completed'
            } catch (error) {
              console.error(`Individual staking failed for wallet ${index}:`, error)
              wallet.status = `Staking failed: ${error.message}`
            }
          }
        }
      } else if (selectedStrategy === 'stake_recycle_stake') {
        console.log('🚀 stake_recycle_stake strategy detected - using optimized batch recycle mode')
        console.log('This strategy will use batch commit for recycle operations')
        
        try {
          // Phase 1: 批量质押第一张卡片 + 批量回收第三张卡片 (合并到单个交易)
          console.log('Phase 1: Combined batch staking first cards + recycle commit third cards...')
          await this.executeBatchStakeAndRecycleCommit(walletBatch, 0, 2, 'first card stake + third card recycle commit')
          await new Promise(resolve => setTimeout(resolve, 2000)) // 等待commit完成
          
          // Phase 2: 批量回收结算 (Settle阶段)
          console.log('Phase 2: Batch recycle settle for third cards...')
          let settleResult = await this.executeBatchRecycleSettle(walletBatch, 'third card')
          
          // 如果有钱包未准备好settle，等待并重试
          let retryCount = 0
          const maxRetries = 3
          while (settleResult.readyCount < settleResult.totalCount && retryCount < maxRetries) {
            console.log(`Retrying settle in 3 seconds... (${retryCount + 1}/${maxRetries})`) // 减少重试等待时间
            await new Promise(resolve => setTimeout(resolve, 3000))
            settleResult = await this.executeBatchRecycleSettle(walletBatch, 'third card')
            retryCount++
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000)) // 减少等待时间
          
          // Phase 3: 检查账户状态并执行后续操作
          console.log('Phase 3: Checking account states and finding highest rarity cards to stake...')
          
          // 为每个钱包找到最高稀有度的未质押卡片
          const walletStakeActions = []
          
          for (const { wallet, index } of walletBatch) {
            try {
              wallet.status = 'Finding highest rarity card to stake...'
              const accountInfo = await wallet.tools.getUserAccountInfo()
              
              if (!accountInfo || !accountInfo.cards) {
                console.error(`Failed to get account info after recycling for wallet ${index}`)
                // 默认质押第2张卡片
                walletStakeActions.push({ wallet, index, cardIndex: 1, reason: 'account_error' })
                continue
              }
              
              // 找到所有未质押的卡片及其稀有度
              const unstakedCards = accountInfo.cards
                .map((card, cardIndex) => ({ card, cardIndex }))
                .filter(({ card }) => !card.isStaked)  // 使用card.isStaked属性判断
              
              if (unstakedCards.length === 0) {
                console.log(`Wallet ${index}: No unstaked cards available`)
                walletStakeActions.push({ wallet, index, cardIndex: null, reason: 'no_cards' })
                continue
              }
              
              // 找到稀有度最高的卡片
              const highestRarityCard = unstakedCards.reduce((highest, current) => 
                current.card.rarity > highest.card.rarity ? current : highest
              )
              
              console.log(`Wallet ${index}: Found highest rarity card at index ${highestRarityCard.cardIndex} (rarity: ${highestRarityCard.card.rarity}, staked: ${highestRarityCard.card.isStaked})`)
              walletStakeActions.push({ 
                wallet, 
                index, 
                cardIndex: highestRarityCard.cardIndex, 
                rarity: highestRarityCard.card.rarity,
                reason: 'highest_rarity' 
              })
              
            } catch (error) {
              console.error(`Failed to check account state for wallet ${index}:`, error)
              // 默认质押第2张卡片
              walletStakeActions.push({ wallet, index, cardIndex: 1, reason: 'error' })
            }
          }
          
          // Phase 4: 批量质押所有钱包的最高稀有度卡片 (单个交易)
          console.log('Phase 4: Executing single batch transaction for all final stakes...')
          
          // 过滤掉没有卡片要质押的钱包
          const validStakeActions = walletStakeActions.filter(action => action.cardIndex !== null)
          
          if (validStakeActions.length === 0) {
            console.log('No cards to stake, strategy completed')
          } else {
            console.log(`Preparing single batch stake transaction for ${validStakeActions.length} wallets`)
            
            try {
              await this.executeBatchMixedStakeCards(validStakeActions, 'final stakes')
              
              // 更新所有成功的钱包状态
              for (const action of validStakeActions) {
                action.wallet.status = `stake_recycle_stake completed (staked card ${action.cardIndex}, rarity: ${action.rarity || 'unknown'})`
              }
              
            } catch (error) {
              console.error(`Batch mixed staking failed, falling back to individual staking:`, error)
              
              // 回退到单独质押
              for (const action of validStakeActions) {
                try {
                  action.wallet.status = `Individual staking card ${action.cardIndex}...`
                  await action.wallet.tools.stakeCardWithoutLock(action.cardIndex)
                  action.wallet.status = `stake_recycle_stake completed (individual staked card ${action.cardIndex})`
                } catch (individualError) {
                  console.error(`Individual staking failed for wallet ${action.index}:`, individualError)
                  action.wallet.status = `Final staking failed: ${individualError.message}`
                }
              }
            }
          }
          
          console.log('🎉 Optimized stake_recycle_stake strategy completed successfully!')
          
        } catch (error) {
          console.error('Batch stake_recycle_stake strategy failed, falling back to individual execution:', error)
          
          // 回退到原来的单独执行模式
          for (const { wallet, index } of walletBatch) {
            try {
              wallet.status = 'Executing stake_recycle_stake strategy (fallback)...'
              console.log(`Executing stake_recycle_stake strategy for wallet ${index} (fallback)`)
              
              // 注意：第一张卡片(index 0)在Phase 1已经被质押了，所以跳过
              console.log(`Wallet ${index}: Card 0 already staked in Phase 1, skipping...`)
              
              // 回收第三张卡片 (index 2)
              console.log(`Wallet ${index}: Recycling card 2`)
              await wallet.tools.recycleCardWithoutLock(2)
              await new Promise(resolve => setTimeout(resolve, 1500)) // 减少回收等待时间
              
              // 检查账户状态，找到最高稀有度的卡片来质押
              let accountInfo = await wallet.tools.getUserAccountInfo()
              if (!accountInfo || !accountInfo.cards) {
                console.error(`Failed to get account info after recycling for wallet ${index}`)
                // fallback: 质押第二张卡片
                await wallet.tools.stakeCardWithoutLock(1)
                wallet.status = 'Strategy completed (fallback)'
                continue
              }
              
              // 找到所有未质押的卡片（注意：第一张卡片已经质押了）
              const unstakedCards = accountInfo.cards
                .map((card, cardIndex) => ({ card, cardIndex }))
                .filter(({ card, cardIndex }) => {
                  // 使用card.isStaked属性判断，而不是stakedCards数组
                  if (card.isStaked) {
                    return false
                  }
                  // 排除第一张卡片，因为它在Phase 1已经被质押
                  if (cardIndex === 0) {
                    return false
                  }
                  return true
                })
              
              if (unstakedCards.length === 0) {
                console.log(`Wallet ${index}: No unstaked cards available after recycle`)
                wallet.status = 'Strategy completed (no cards to stake)'
                continue
              }
              
              // 找到稀有度最高的卡片
              const highestRarityCard = unstakedCards.reduce((highest, current) => 
                current.card.rarity > highest.card.rarity ? current : highest
              )
              
              console.log(`Wallet ${index}: Staking highest rarity card at index ${highestRarityCard.cardIndex} (rarity: ${highestRarityCard.card.rarity})`)
              await wallet.tools.stakeCardWithoutLock(highestRarityCard.cardIndex)
              
              wallet.status = 'stake_recycle_stake strategy completed (fallback)'
              console.log(`Wallet ${index}: stake_recycle_stake strategy completed successfully (fallback)`)
              
            } catch (error) {
              console.error(`stake_recycle_stake strategy failed for wallet ${index}:`, error)
              wallet.status = `Strategy failed: ${error.message}`
            }
          }
        }
      }
      
      // 更新所有钱包状态
      for (const { wallet, index } of walletBatch) {
        wallet.status = WALLET_STATUS.GAME_ACCOUNT_INITIALIZED
        wallet.loading = false
        // 异步刷新卡片信息
        this.queryCards(index).catch(error => {
          console.error(`Failed to query cards for wallet ${index}:`, error)
        })
      }
      
      return {
        success: walletBatch.length,
        failed: 0,
        results: walletBatch.map(({ index }) => ({ walletIndex: index, success: true }))
      }
      
    } catch (error) {
      console.error('Batch transaction failed:', error)
      
      // 更新所有钱包状态为失败
      for (const { wallet } of walletBatch) {
        wallet.loading = false
        wallet.status = `Error: ${error.message}`
      }
      
      return {
        success: 0,
        failed: walletBatch.length,
        results: walletBatch.map(({ index }) => ({ 
          walletIndex: index, 
          success: false, 
          error: error.message 
        }))
      }
    }
  }

  /**
   * 创建计算预算指令
   */
  createComputeBudgetInstructions() {
    // 这个方法需要从 solanaTools.js 中导入或重新实现
    const instructions = []

    // 1. Set compute unit limit
    const computeUnitLimit = 1000000
    const computeUnitLimitInstruction = {
      keys: [],
      programId: new PublicKey('ComputeBudget111111111111111111111111111111'),
      data: Buffer.concat([
        Buffer.from([0x02]), // SetComputeUnitLimit instruction
        Buffer.from(new Uint8Array(new Uint32Array([computeUnitLimit]).buffer))
      ])
    }
    instructions.push(computeUnitLimitInstruction)

    // 2. Set compute unit price
    const computeUnitPrice = 200
    const computeUnitPriceInstruction = {
      keys: [],
      programId: new PublicKey('ComputeBudget111111111111111111111111111111'),
      data: Buffer.concat([
        Buffer.from([0x03]), // SetComputeUnitPrice instruction
        Buffer.from(new Uint8Array(new BigUint64Array([BigInt(computeUnitPrice)]).buffer))
      ])
    }
    instructions.push(computeUnitPriceInstruction)

    return instructions
  }

  /**
   * 批量回收指定卡片 - Commit阶段
   * @param {Array} walletBatch - 钱包批次
   * @param {number} cardIndex - 要回收的卡片索引
   * @param {string} description - 描述信息
   */
  async executeBatchRecycleCommit(walletBatch, cardIndex, description) {
    const instructions = []
    const signers = []
    
    console.log(`Starting batch recycle commit for ${description} (card ${cardIndex})...`)
    
    // 获取主钱包
    let masterWallet = null
    if (this.masterWalletStore.isReady) {
      masterWallet = this.masterWalletStore.getMasterKeypair()
      signers.push(masterWallet)
    }
    
    // 添加计算预算指令
    instructions.push(...this.createComputeBudgetInstructions())
    
    // 为每个钱包创建回收commit指令
    for (const { wallet, index } of walletBatch) {
      try {
        wallet.status = `Preparing recycle commit for ${description}...`
        
        const recycleCommitInstruction = await wallet.tools.createRecycleCardsCommitInstruction([cardIndex])
        instructions.push(recycleCommitInstruction)
        
        // 添加钱包作为签名者
        const walletKeypair = wallet.tools.wallet
        if (!signers.find(s => s.publicKey.equals(walletKeypair.publicKey))) {
          signers.push(walletKeypair)
        }
        
      } catch (error) {
        console.error(`Failed to create recycle commit instruction for wallet ${index}:`, error)
        wallet.status = `Recycle commit prep failed: ${error.message}`
        throw error
      }
    }
    
    try {
      // 执行批量recycle commit交易
      console.log(`Executing batch recycle commit transaction with ${instructions.length} instructions`)
      
      const firstWallet = walletBatch[0].wallet
      const signature = await firstWallet.tools.buildAndSendBatchTransaction(instructions, signers)
      
      if (!signature) {
        throw new Error('Batch recycle commit transaction failed')
      }
      
      console.log(`Batch recycle commit completed for ${description}`)
      
      // 更新所有钱包状态
      for (const { wallet } of walletBatch) {
        wallet.status = `Recycle commit completed for ${description}`
      }
      
      return signature
      
    } catch (error) {
      console.error(`Batch recycle commit failed for ${description}:`, error)
      
      // 更新失败钱包的状态
      for (const { wallet } of walletBatch) {
        wallet.status = `Recycle commit failed: ${error.message}`
      }
      
      throw error
    }
  }

  /**
   * 批量回收结算 - Settle阶段 (优化版：单个交易)
   * @param {Array} walletBatch - 钱包批次
   * @param {string} description - 描述信息
   */
  async executeBatchRecycleSettle(walletBatch, description) {
    console.log(`Starting optimized batch recycle settle for ${description}...`)
    
    // 检查所有钱包是否都可以settle（延迟时间满足）
    const currentSlot = await walletBatch[0].wallet.tools.getSlot()
    const MIN_DELAY = 5 // 最小延迟slot数
    
    const readyWallets = []
    const notReadyWallets = []
    
    for (const { wallet, index } of walletBatch) {
      try {
        const accountInfo = await wallet.tools.getUserAccountInfo()
        const commitSlot = accountInfo?.commitSlot || 0
        
        if (currentSlot >= commitSlot + MIN_DELAY) {
          readyWallets.push({ wallet, index, commitSlot })
        } else {
          notReadyWallets.push({ wallet, index, waitSlots: (commitSlot + MIN_DELAY) - currentSlot })
          wallet.status = `Waiting for settle (${(commitSlot + MIN_DELAY) - currentSlot} slots remaining)`
        }
      } catch (error) {
        console.error(`Failed to check settle readiness for wallet ${index}:`, error)
        notReadyWallets.push({ wallet, index, error: error.message })
      }
    }
    
    console.log(`${readyWallets.length}/${walletBatch.length} wallets ready for settle`)
    
    if (readyWallets.length === 0) {
      console.log('No wallets ready for settle, will retry later')
      return { readyCount: 0, totalCount: walletBatch.length, successCount: 0 }
    }
    
    // 检查是否所有ready的钱包都有相同的commit slot（可以使用同一个随机数）
    const commitSlots = [...new Set(readyWallets.map(w => w.commitSlot))]
    
    if (commitSlots.length === 1) {
      // 所有钱包都有相同的commit slot，可以在单个交易中处理所有settle
      console.log(`All ${readyWallets.length} wallets have same commit slot, executing single batch settle transaction`)
      
      try {
        await this.executeSingleBatchRecycleSettle(readyWallets, description)
        
        // 更新所有钱包状态
        for (const { wallet } of readyWallets) {
          wallet.status = `Recycle settle completed for ${description}`
        }
        
        return { 
          readyCount: readyWallets.length, 
          totalCount: walletBatch.length,
          successCount: readyWallets.length 
        }
        
      } catch (error) {
        console.error(`Single batch settle failed, falling back to individual processing:`, error)
        
        // 回退到单个处理
        let successCount = 0
        for (const { wallet, index } of readyWallets) {
          try {
            wallet.status = `Individual settle for ${description}...`
            await wallet.tools.executeSettleRecycle()
            wallet.status = `Recycle settle completed for ${description}`
            successCount++
          } catch (individualError) {
            console.error(`Individual settle failed for wallet ${index}:`, individualError)
            wallet.status = `Settle failed: ${individualError.message}`
          }
        }
        
        return { 
          readyCount: readyWallets.length, 
          totalCount: walletBatch.length,
          successCount 
        }
      }
      
    } else {
      // 钱包有不同的commit slot，需要分组处理
      console.log(`Wallets have different commit slots (${commitSlots.length} groups), processing by groups`)
      
      let totalSuccessCount = 0
      
      for (const commitSlot of commitSlots) {
        const sameSlotWallets = readyWallets.filter(w => w.commitSlot === commitSlot)
        console.log(`Processing ${sameSlotWallets.length} wallets with commit slot ${commitSlot}`)
        
        try {
          await this.executeSingleBatchRecycleSettle(sameSlotWallets, `${description} (slot ${commitSlot})`)
          
          // 更新状态
          for (const { wallet } of sameSlotWallets) {
            wallet.status = `Recycle settle completed for ${description}`
          }
          
          totalSuccessCount += sameSlotWallets.length
          
        } catch (error) {
          console.error(`Batch settle failed for commit slot ${commitSlot}, falling back to individual:`, error)
          
          // 对这组进行单个处理
          for (const { wallet, index } of sameSlotWallets) {
            try {
              wallet.status = `Individual settle for ${description}...`
              await wallet.tools.executeSettleRecycle()
              wallet.status = `Recycle settle completed for ${description}`
              totalSuccessCount++
            } catch (individualError) {
              console.error(`Individual settle failed for wallet ${index}:`, individualError)
              wallet.status = `Settle failed: ${individualError.message}`
            }
          }
        }
        
        // 组间延迟
        await new Promise(resolve => setTimeout(resolve, 500)) // 减少组间等待时间
      }
      
      return { 
        readyCount: readyWallets.length, 
        totalCount: walletBatch.length,
        successCount: totalSuccessCount 
      }
    }
  }

  /**
   * 单个交易批量回收结算
   * @param {Array} readyWallets - 准备好的钱包列表
   * @param {string} description - 描述信息
   */
  async executeSingleBatchRecycleSettle(readyWallets, description) {
    const instructions = []
    const signers = []
    
    console.log(`Executing single batch settle for ${readyWallets.length} wallets`)
    
    // 获取主钱包
    let masterWallet = null
    if (this.masterWalletStore.isReady) {
      masterWallet = this.masterWalletStore.getMasterKeypair()
      signers.push(masterWallet)
    }
    
    // 添加计算预算指令（增加CU限制以支持更多钱包）
    const computeBudgetInstructions = this.createComputeBudgetInstructions()
    // 为批量settle增加CU限制
    computeBudgetInstructions[0].data = Buffer.concat([
      Buffer.from([0x02]), // SetComputeUnitLimit instruction
      Buffer.from(new Uint8Array(new Uint32Array([1400000]).buffer)) // 增加到1.4M CU
    ])
    instructions.push(...computeBudgetInstructions)
    
    // 为每个钱包创建settle指令
    for (const { wallet, index } of readyWallets) {
      try {
        wallet.status = `Preparing settle for ${description}...`
        
        const settleInstruction = await wallet.tools.createRecycleCardsSettleInstruction()
        instructions.push(settleInstruction)
        
        // 添加钱包作为签名者
        const walletKeypair = wallet.tools.wallet
        if (!signers.find(s => s.publicKey.equals(walletKeypair.publicKey))) {
          signers.push(walletKeypair)
        }
        
      } catch (error) {
        console.error(`Failed to create settle instruction for wallet ${index}:`, error)
        throw error
      }
    }
    
    // 执行单个大批量settle交易
    console.log(`Executing single batch settle transaction with ${instructions.length} instructions for ${readyWallets.length} wallets`)
    
    const firstWallet = readyWallets[0].wallet
    const signature = await firstWallet.tools.buildAndSendBatchTransaction(instructions, signers)
    
    if (!signature) {
      throw new Error('Single batch settle transaction failed')
    }
    
    console.log(`Single batch settle completed successfully for ${readyWallets.length} wallets`)
    return signature
  }

  /**
   * 批量混合质押卡片 (不同钱包质押不同卡片索引)
   * @param {Array} stakeActions - 质押动作数组 [{wallet, index, cardIndex, rarity}]
   * @param {string} description - 描述信息
   */
  async executeBatchMixedStakeCards(stakeActions, description) {
    const instructions = []
    const signers = []
    
    console.log(`Starting batch mixed stake for ${stakeActions.length} wallets (${description})`)
    
    // 获取主钱包
    let masterWallet = null
    if (this.masterWalletStore.isReady) {
      masterWallet = this.masterWalletStore.getMasterKeypair()
      signers.push(masterWallet)
    }
    
    // 添加计算预算指令
    instructions.push(...this.createComputeBudgetInstructions())
    
    // 为每个钱包创建质押指令（可能是不同的卡片索引）
    for (const action of stakeActions) {
      try {
        action.wallet.status = `Preparing stake for card ${action.cardIndex} (${description})...`
        
        const stakeInstruction = await action.wallet.tools.createStakeCardInstruction(action.cardIndex)
        instructions.push(stakeInstruction)
        
        // 添加钱包作为签名者
        const walletKeypair = action.wallet.tools.wallet
        if (!signers.find(s => s.publicKey.equals(walletKeypair.publicKey))) {
          signers.push(walletKeypair)
        }
        
        console.log(`Wallet ${action.index}: Will stake card ${action.cardIndex} (rarity: ${action.rarity || 'unknown'})`)
        
      } catch (error) {
        console.error(`Failed to create stake instruction for wallet ${action.index}:`, error)
        action.wallet.status = `Stake prep failed: ${error.message}`
        throw error
      }
    }
    
    try {
      // 执行批量质押交易
      console.log(`Executing batch mixed stake transaction with ${instructions.length} instructions`)
      
      const firstWallet = stakeActions[0].wallet
      const signature = await firstWallet.tools.buildAndSendBatchTransaction(instructions, signers)
      
      if (!signature) {
        throw new Error('Batch mixed stake transaction failed')
      }
      
      console.log(`Batch mixed stake completed for ${stakeActions.length} wallets`)
      
      // 更新所有钱包状态
      for (const action of stakeActions) {
        action.wallet.status = `Stake completed for card ${action.cardIndex} (${description})`
      }
      
      return signature
      
    } catch (error) {
      console.error(`Batch mixed stake failed for ${description}:`, error)
      
      // 更新失败钱包的状态
      for (const action of stakeActions) {
        action.wallet.status = `Stake failed: ${error.message}`
      }
      
      throw error
    }
  }

  /**
   * 批量质押特定卡片索引的卡片
   * @param {Array} walletBatch - 钱包批次
   * @param {number} cardIndex - 要质押的卡片索引 (0 或 1)
   * @param {string} description - 描述信息
   */
  async executeBatchStakeCards(walletBatch, cardIndex, description) {
    const instructions = []
    const signers = []
    let masterWallet = null
    
    // 获取主钱包
    if (this.masterWalletStore.isReady) {
      masterWallet = this.masterWalletStore.getMasterKeypair()
      signers.push(masterWallet)
    }

    console.log(`Creating batch stake instructions for ${description} (card index ${cardIndex})...`)
    
    // 为每个钱包创建质押指令
    for (const { wallet, index } of walletBatch) {
      try {
        wallet.status = `Staking ${description}...`
        
        // 添加计算预算指令（只在第一个钱包时添加）
        if (instructions.length === 0) {
          const computeBudgetInstructions = this.createComputeBudgetInstructions()
          instructions.push(...computeBudgetInstructions)
        }
        
        // 创建质押指令
        const stakeInstruction = await wallet.tools.createStakeCardInstruction(cardIndex)
        instructions.push(stakeInstruction)
        
        // 添加钱包作为签名者
        const walletKeypair = wallet.tools.wallet
        if (!signers.find(s => s.publicKey.equals(walletKeypair.publicKey))) {
          signers.push(walletKeypair)
        }
        
      } catch (error) {
        console.error(`Failed to create stake instruction for wallet ${index}, ${description}:`, error)
        wallet.status = `Error creating stake instruction: ${error.message}`
        throw error
      }
    }

    try {
      // 构建并发送批量质押交易
      console.log(`Executing batch stake transaction for ${description} with ${instructions.length} instructions for ${walletBatch.length} wallets`)
      
      // 使用第一个钱包的工具发送交易
      const firstWallet = walletBatch[0].wallet
      const signature = await firstWallet.tools.buildAndSendBatchTransaction(instructions, signers)
      
      if (!signature) {
        throw new Error(`Batch ${description} staking transaction failed`)
      }
      
      console.log(`Batch ${description} staking completed successfully:`, signature)
      
      // 更新所有钱包状态
      for (const { wallet } of walletBatch) {
        wallet.status = `${description} staked successfully`
      }
      
      return signature
      
    } catch (error) {
      console.error(`Batch ${description} staking failed:`, error)
      
      // 更新所有钱包状态为失败
      for (const { wallet } of walletBatch) {
        wallet.status = `${description} staking failed: ${error.message}`
      }
      
      throw error
    }
  }

  /**
   * 批量领取奖励 - 合并到单个交易
   */
  async batchClaimRewardsInSingleTx() {
    // 如果启用了主钱包，验证其可用性
    if (this.masterWalletStore.isReady) {
      try {
        await this.masterWalletStore.validateMasterWallet()
        console.log('Master wallet validated for batch claim rewards')
      } catch (error) {
        throw new Error(`Master wallet validation failed: ${error.message}`)
      }
    }

    // 筛选可以claim的钱包
    const targetWallets = this.wallets
      .map((wallet, index) => ({ wallet, index }))
      .filter(({ wallet }) => 
        wallet.firstQueryDone && 
        wallet.accountInitialized && 
        wallet.tools && 
        !wallet.loading
      )

    if (targetWallets.length === 0) {
      console.log('No wallets available for batch claim rewards')
      return { success: 0, failed: 0, results: [] }
    }

    // 使用较大的分组：每组最多8个钱包（claim操作相对简单）
    const config = this.getConcurrencyConfig()
    const batches = this.groupWallets(targetWallets, config.batchSizes.claimRewards)

    console.log(`Starting batch claim rewards for ${targetWallets.length} wallets in ${batches.length} groups (max ${config.batchSizes.claimRewards} wallets per group, max ${config.maxConcurrency} concurrent)`)

    let totalSuccess = 0
    let totalFailed = 0
    const allResults = []

    // 使用并发控制，最多10个并发操作
    const semaphore = this.createSemaphore(config.maxConcurrency)

    // 创建所有批次的 Promise
    const batchPromises = batches.map(async (batch, batchIndex) => {
      return await semaphore.acquire(async () => {
        console.log(`Starting claim batch ${batchIndex + 1}/${batches.length} with ${batch.length} wallets`)
        try {
          const result = await this.executeBatchClaimRewardsInSingleTransaction(batch)
          console.log(`Claim batch ${batchIndex + 1} completed: ${result.success} success, ${result.failed} failed`)
          return result
        } catch (error) {
          console.error(`Claim batch ${batchIndex + 1} transaction failed:`, error)
          // 如果批量交易失败，回退到单个交易处理
          console.log(`Falling back to individual claim rewards for batch ${batchIndex + 1}`)
          
          let batchSuccess = 0
          let batchFailed = 0
          const batchResults = []
          
          for (const { index } of batch) {
            try {
              await this.claimReward(index, false) // execTransfer = false
              batchSuccess++
              batchResults.push({ walletIndex: index, success: true })
            } catch (individualError) {
              batchFailed++
              batchResults.push({ walletIndex: index, success: false, error: individualError.message })
            }
          }
          
          return { success: batchSuccess, failed: batchFailed, results: batchResults }
        }
      })
    })

    // 等待所有批次完成
    const results = await Promise.all(batchPromises)
    
    // 汇总结果
    for (const result of results) {
      totalSuccess += result.success
      totalFailed += result.failed
      allResults.push(...result.results)
    }

    console.log('Batch claim rewards completed:', { success: totalSuccess, failed: totalFailed })
    return { success: totalSuccess, failed: totalFailed, results: allResults }
  }

  /**
   * 在单个交易中执行多个钱包的claim操作
   */
  async executeBatchClaimRewardsInSingleTransaction(walletBatch) {
    const instructions = []
    const signers = []
    let masterWallet = null
    
    // 获取主钱包
    if (this.masterWalletStore.isReady) {
      masterWallet = this.masterWalletStore.getMasterKeypair()
      signers.push(masterWallet)
    }

    // 添加计算预算指令
    const computeBudgetInstructions = this.createComputeBudgetInstructions()
    instructions.push(...computeBudgetInstructions)

    // 为每个钱包创建claim指令
    for (const { wallet, index } of walletBatch) {
      try {
        wallet.loading = true
        wallet.status = 'Claiming rewards...'
        
        // 创建claim指令
        const claimInstruction = {
          keys: [
            { pubkey: wallet.tools.wallet.publicKey, isSigner: true, isWritable: true },
            { pubkey: wallet.tools.playerPDA, isSigner: false, isWritable: true },
            { pubkey: wallet.tools.globalState, isSigner: false, isWritable: true },
            { pubkey: wallet.tools.rewardsVault, isSigner: false, isWritable: true },
            { pubkey: wallet.tools.playerTokenAccount, isSigner: false, isWritable: true },
            { pubkey: wallet.tools.tokenMint, isSigner: false, isWritable: true },
            { pubkey: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), isSigner: false, isWritable: false } // TOKEN_PROGRAM_ID
          ],
          programId: wallet.tools.programId,
          data: Buffer.from('0490844774179750', 'hex')
        }
        instructions.push(claimInstruction)
        
        // 添加钱包作为签名者
        const walletKeypair = wallet.tools.wallet
        if (!signers.find(s => s.publicKey.equals(walletKeypair.publicKey))) {
          signers.push(walletKeypair)
        }
        
      } catch (error) {
        console.error(`Failed to create claim instruction for wallet ${index}:`, error)
        wallet.loading = false
        wallet.status = `Error: ${error.message}`
        throw error
      }
    }

    try {
      // 构建并发送合并交易
      console.log(`Executing batch claim rewards transaction with ${instructions.length} instructions for ${walletBatch.length} wallets`)
      
      // 使用第一个钱包的工具发送交易
      const firstWallet = walletBatch[0].wallet
      const signature = await firstWallet.tools.buildAndSendBatchTransaction(instructions, signers)
      
      if (!signature) {
        throw new Error('Batch claim rewards transaction failed')
      }
      
      console.log('Batch claim rewards completed successfully:', signature)
      
      // 更新所有钱包状态
      for (const { wallet, index } of walletBatch) {
        wallet.status = 'Rewards claimed successfully'
        wallet.loading = false
        
        // 异步刷新卡片信息和余额
        this.queryCards(index).catch(error => {
          console.error(`Failed to query cards for wallet ${index}:`, error)
        })
      }
      
      return {
        success: walletBatch.length,
        failed: 0,
        results: walletBatch.map(({ index }) => ({ walletIndex: index, success: true }))
      }
      
    } catch (error) {
      console.error('Batch claim rewards transaction failed:', error)
      
      // 更新所有钱包状态为失败
      for (const { wallet } of walletBatch) {
        wallet.loading = false
        wallet.status = `Error: ${error.message}`
      }
      
      return {
        success: 0,
        failed: walletBatch.length,
        results: walletBatch.map(({ index }) => ({ 
          walletIndex: index, 
          success: false, 
          error: error.message 
        }))
      }
    }
  }

  /**
   * 批量领取奖励并归集 - 分两步执行
   */
  async batchClaimAndTransferInSingleTx() {
    console.log('🚀 Starting batch claim and transfer in two separate transactions...')
    
    try {
      // 第一步：批量claim奖励
      console.log('📋 Step 1: Batch claiming rewards...')
      const claimResult = await this.batchClaimRewardsInSingleTx()
      
      console.log('✅ Step 1 completed:', claimResult)
      
      if (claimResult.failed > 0) {
        console.warn(`⚠️ Some wallets failed to claim rewards: ${claimResult.failed} failed, ${claimResult.success} succeeded`)
      }
      
      // 等待claim交易确认
      console.log('⏳ Waiting 2 seconds for claim transactions to confirm...') // 减少等待时间
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // 第二步：批量转移所有余额
      console.log('💰 Step 2: Batch transferring all balances...')
      const transferResult = await this.batchTransferAllBalances()
      
      console.log('✅ Step 2 completed:', transferResult)
      
      // 合并结果
      const finalResult = {
        success: Math.min(claimResult.success, transferResult.success),
        failed: Math.max(claimResult.failed, transferResult.failed),
        results: transferResult.results,
        claimResults: claimResult.results,
        transferResults: transferResult.results
      }
      
      console.log('🎉 Both steps completed! Final result:', finalResult)
      return finalResult
      
    } catch (error) {
      console.error('❌ Error during batch claim and transfer:', error)
      throw error
    }
  }

  /**
   * 批量转移所有钱包的全部余额到归集账户
   */
  async batchTransferAllBalances() {
    // 如果启用了主钱包，验证其可用性
    if (this.masterWalletStore.isReady) {
      try {
        await this.masterWalletStore.validateMasterWallet()
        console.log('Master wallet validated for batch transfer')
      } catch (error) {
        throw new Error(`Master wallet validation failed: ${error.message}`)
      }
    }

    // 筛选有余额的钱包
    const targetWallets = this.wallets
      .map((wallet, index) => ({ wallet, index }))
      .filter(({ wallet }) => 
        wallet.firstQueryDone && 
        wallet.accountInitialized && 
        wallet.tools && 
        !wallet.loading
      )

    if (targetWallets.length === 0) {
      console.log('No wallets available for batch transfer')
      return { success: 0, failed: 0, results: [] }
    }

    // 使用较大的分组：每组最多8个钱包（transfer操作相对简单）
    const config = this.getConcurrencyConfig()
    const batches = this.groupWallets(targetWallets, config.batchSizes.transfer)

    console.log(`Starting batch transfer for ${targetWallets.length} wallets in ${batches.length} groups (max ${config.batchSizes.transfer} wallets per group, max ${config.maxConcurrency} concurrent)`)

    let totalSuccess = 0
    let totalFailed = 0
    const allResults = []

    // 使用并发控制，最多10个并发操作
    const semaphore = this.createSemaphore(config.maxConcurrency)

    // 创建所有批次的 Promise
    const batchPromises = batches.map(async (batch, batchIndex) => {
      return await semaphore.acquire(async () => {
        console.log(`Starting transfer batch ${batchIndex + 1}/${batches.length} with ${batch.length} wallets`)
        try {
          const result = await this.executeBatchTransferAllBalances(batch)
          console.log(`Transfer batch ${batchIndex + 1} completed: ${result.success} success, ${result.failed} failed`)
          return result
        } catch (error) {
          console.error(`Transfer batch ${batchIndex + 1} transaction failed:`, error)
          // 如果批量交易失败，回退到单个交易处理
          console.log(`Falling back to individual transfers for batch ${batchIndex + 1}`)
          
          let batchSuccess = 0
          let batchFailed = 0
          const batchResults = []
          
          for (const { index } of batch) {
            try {
              const wallet = this.wallets[index]
              const balance = await wallet.tools.getTokenBalance()
              if (balance > 0n) {
                await wallet.tools.transferAllTokensToRecipient()
                batchSuccess++
                batchResults.push({ walletIndex: index, success: true })
              } else {
                console.log(`Wallet ${index} has no balance to transfer`)
                batchResults.push({ walletIndex: index, success: true, note: 'No balance to transfer' })
              }
            } catch (individualError) {
              batchFailed++
              batchResults.push({ walletIndex: index, success: false, error: individualError.message })
            }
          }
          
          return { success: batchSuccess, failed: batchFailed, results: batchResults }
        }
      })
    })

    // 等待所有批次完成
    const results = await Promise.all(batchPromises)
    
    // 汇总结果
    for (const result of results) {
      totalSuccess += result.success
      totalFailed += result.failed
      allResults.push(...result.results)
    }

    console.log('Batch transfer completed:', { success: totalSuccess, failed: totalFailed })
    return { success: totalSuccess, failed: totalFailed, results: allResults }
  }

  /**
   * 在单个交易中执行多个钱包的转移操作
   */
  async executeBatchTransferAllBalances(walletBatch) {
    const instructions = []
    const signers = []
    let masterWallet = null
    
    // 获取主钱包
    if (this.masterWalletStore.isReady) {
      masterWallet = this.masterWalletStore.getMasterKeypair()
      signers.push(masterWallet)
    }

    // 添加计算预算指令
    const computeBudgetInstructions = this.createComputeBudgetInstructions()
    instructions.push(...computeBudgetInstructions)

    // 检查归集地址的ATA是否存在（只检查一次）
    const firstWallet = walletBatch[0].wallet
    const recipientTokenAccount = firstWallet.tools.recipientTokenAccount
    const recipientAccountExists = await firstWallet.tools.checkAccountExists(recipientTokenAccount)
    
    // 如果归集账户不存在，创建它（只创建一次）
    if (!recipientAccountExists) {
      console.log('Creating recipient ATA for batch transfer...')
      const { createAssociatedTokenAccountInstruction } = await import('@solana/spl-token')
      
      const createATAInstruction = createAssociatedTokenAccountInstruction(
        masterWallet ? masterWallet.publicKey : firstWallet.tools.wallet.publicKey, // payer
        recipientTokenAccount, // ata
        firstWallet.tools.recipientAccount, // owner
        firstWallet.tools.tokenMint // mint
      )
      instructions.push(createATAInstruction)
    }

    // 为每个钱包创建transfer指令
    const walletsWithBalance = []
    
    for (const { wallet, index } of walletBatch) {
      try {
        wallet.loading = true
        wallet.status = 'Checking balance for transfer...'
        
        // 获取当前余额
        const currentBalance = await wallet.tools.getTokenBalance()
        
        console.log(`Wallet ${index} balance check:`, {
          currentBalance: currentBalance.toString(),
          currentBalanceReadable: (Number(currentBalance) / 1000000).toFixed(6)
        })
        
        // 只有当余额大于0时才创建transfer指令
        if (currentBalance > 0n) {
          const { createTransferCheckedInstruction } = await import('@solana/spl-token')
          const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
          
          const transferInstruction = createTransferCheckedInstruction(
            wallet.tools.playerTokenAccount,     // from
            wallet.tools.tokenMint,              // mint
            recipientTokenAccount,               // to
            wallet.tools.wallet.publicKey,       // owner
            currentBalance,                      // 转移全部余额
            6,                                   // decimals
            [],                                  // signers
            TOKEN_PROGRAM_ID
          )
          instructions.push(transferInstruction)
          
          walletsWithBalance.push({ wallet, index, balance: currentBalance })
          wallet.status = `Transfer prepared (${(Number(currentBalance) / 1000000).toFixed(6)} tokens)`
        } else {
          console.log(`Wallet ${index} has no balance to transfer`)
          wallet.status = 'No balance to transfer'
        }
        
        // 添加钱包作为签名者
        const walletKeypair = wallet.tools.wallet
        if (!signers.find(s => s.publicKey.equals(walletKeypair.publicKey))) {
          signers.push(walletKeypair)
        }
        
      } catch (error) {
        console.error(`Failed to create transfer instruction for wallet ${index}:`, error)
        wallet.loading = false
        wallet.status = `Error: ${error.message}`
        throw error
      }
    }

    // 如果没有钱包有余额，直接返回成功
    if (walletsWithBalance.length === 0) {
      console.log('No wallets have balance to transfer')
      for (const { wallet } of walletBatch) {
        wallet.loading = false
        wallet.status = 'No balance to transfer'
      }
      return {
        success: walletBatch.length,
        failed: 0,
        results: walletBatch.map(({ index }) => ({ walletIndex: index, success: true, note: 'No balance to transfer' }))
      }
    }

    try {
      // 构建并发送批量转移交易
      console.log(`Executing batch transfer transaction with ${instructions.length} instructions for ${walletsWithBalance.length} wallets with balance`)
      
      // 使用第一个钱包的工具发送交易
      const firstWallet = walletBatch[0].wallet
      const signature = await firstWallet.tools.buildAndSendBatchTransaction(instructions, signers)
      
      if (!signature) {
        throw new Error('Batch transfer transaction failed')
      }
      
      console.log('Batch transfer completed successfully:', signature)
      
      // 更新所有钱包状态
      for (const { wallet, index } of walletBatch) {
        wallet.status = 'Transfer completed successfully'
        wallet.loading = false
        wallet.tokenBalance = '0' // 假设全部转移
        
        // 异步刷新卡片信息
        this.queryCards(index).catch(error => {
          console.error(`Failed to query cards for wallet ${index}:`, error)
        })
      }
      
      return {
        success: walletBatch.length,
        failed: 0,
        results: walletBatch.map(({ index }) => ({ walletIndex: index, success: true }))
      }
      
    } catch (error) {
      console.error('Batch transfer transaction failed:', error)
      
      // 更新所有钱包状态为失败
      for (const { wallet } of walletBatch) {
        wallet.loading = false
        wallet.status = `Transfer failed: ${error.message}`
      }
      
      return {
        success: 0,
        failed: walletBatch.length,
        results: walletBatch.map(({ index }) => ({ 
          walletIndex: index, 
          success: false, 
          error: error.message 
        }))
      }
    }
  }

  /**
   * 批量查询卡片
   */
  async batchQueryCards() {
    const targetWallets = this.wallets
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
    const targetWallets = this.wallets
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
   * 批量领取奖励（直接使用claim+transfer合并交易）
   */
  async batchClaimRewards() {
    return await this.batchClaimAndTransferInSingleTx()
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

export const useWalletOperationsStore = defineStore('walletOperations', () => {
  // 单例模式的 WalletOperationManager
  let operationManager = null

  const getOperationManager = () => {
    if (!operationManager) {
      operationManager = new WalletOperationManager()
    }
    return operationManager
  }

  // Actions - 直接暴露操作管理器的方法
  const initializeWallet = (index) => getOperationManager().initializeWallet(index)
  const queryCards = (index) => getOperationManager().queryCards(index)
  const initGameAccount = (index) => getOperationManager().initGameAccount(index)
  const openBooster = (index) => getOperationManager().openBooster(index)
  const claimReward = (index) => getOperationManager().claimReward(index)
  const recycleCard = (walletIndex, cardIndex) => getOperationManager().recycleCard(walletIndex, cardIndex)
  const stakeCard = (walletIndex, cardIndex) => getOperationManager().stakeCard(walletIndex, cardIndex)
  const unstakeCard = (walletIndex, cardIndex) => getOperationManager().unstakeCard(walletIndex, cardIndex)
  
  // 私钥导入
  const importWalletByPrivateKey = (privateKey) => getOperationManager().importWalletByPrivateKey(privateKey)
  
  // 批量操作
  const batchInitGameAccounts = () => getOperationManager().batchInitGameAccounts()
  const batchInitGameAccountsInSingleTx = () => getOperationManager().batchInitGameAccountsInSingleTx()
  const batchClaimAndTransferInSingleTx = () => getOperationManager().batchClaimAndTransferInSingleTx()
  const batchTransferAllBalances = () => getOperationManager().batchTransferAllBalances()
  const batchQueryCards = () => getOperationManager().batchQueryCards()
  const batchOpenBoosters = () => getOperationManager().batchOpenBoosters()
  const batchClaimRewards = () => getOperationManager().batchClaimRewards()

  return {
    // 单个钱包操作
    initializeWallet,
    queryCards,
    initGameAccount,
    openBooster,
    claimReward,
    recycleCard,
    stakeCard,
    unstakeCard,
    
    // 私钥导入
    importWalletByPrivateKey,
    
    // 批量操作
    batchInitGameAccounts,
    batchInitGameAccountsInSingleTx,
    batchClaimAndTransferInSingleTx,
    batchTransferAllBalances,
    batchQueryCards,
    batchOpenBoosters,
    batchClaimRewards,

    // 暴露操作管理器实例（如果需要直接访问）
    getOperationManager
  }
})