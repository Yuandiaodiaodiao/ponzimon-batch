import { SolanaWalletTools } from '../utils/solanaTools.js'

export function useWalletOperations(wallets, config, saveWallets) {
  const initializeWallet = async (index) => {
    const wallet = wallets.value[index]
    if (!wallet.privateKey) return

    try {
      wallet.loading = true
      wallet.tools = new SolanaWalletTools(wallet.privateKey, config)
      wallet.publicKey = wallet.tools.getPublicKey()
      wallet.status = 'Initialized'
      saveWallets()
      await queryCards(index)
    } catch (error) {
      wallet.status = `Error: ${error.message}`
      console.error('Failed to initialize wallet:', error)
    } finally {
      wallet.loading = false
    }
  }

  const queryCards = async (index) => {
    const wallet = wallets.value[index]
    if (!wallet.tools) return

    try {
      wallet.loading = true
      wallet.status = 'Querying account info...'
      const accountInfo = await wallet.tools.getUserAccountInfo()

      if (!accountInfo) {
        // Account not initialized
        wallet.status = 'Account not initialized'
        wallet.accountInitialized = false
        wallet.cards = []
        wallet.accountInfo = null
      } else {
        // Account initialized, store all info
        wallet.accountInitialized = true
        wallet.cards = accountInfo.cards
        wallet.accountInfo = accountInfo
        wallet.status = `Found ${accountInfo.cards.length} cards | Berries: ${accountInfo.berries} | Hashpower: ${accountInfo.totalHashpower}`
      }

      // Mark first query as done
      wallet.firstQueryDone = true
    } catch (error) {
      wallet.status = `Error: ${error.message}`
      wallet.accountInitialized = false
      wallet.firstQueryDone = true // Even on error, mark as done
      console.error('Failed to query account info:', error)
    } finally {
      wallet.loading = false
    }
  }

  const initGameAccount = async (index) => {
    const wallet = wallets.value[index]
    if (!wallet.tools) return

    try {
      wallet.loading = true
      wallet.status = 'Initializing game account...'
      await wallet.tools.initGameAccountTransaction()
      wallet.status = 'Game account initialized'
    } catch (error) {
      wallet.status = `Error: ${error.message}`
      console.error('Failed to initialize game account:', error)
    } finally {
      await queryCards(index)
      wallet.loading = false
    }
  }

  const openBooster = async (index) => {
    const wallet = wallets.value[index]
    if (!wallet.tools) return

    try {
      wallet.loading = true
      wallet.status = 'Opening booster...'
      await wallet.tools.openBooster()
      wallet.status = 'Booster opened successfully'
    } catch (error) {
      wallet.status = `Error: ${error.message}`
      console.error('Failed to open booster:', error)
    } finally {
      wallet.loading = false
    }
  }

  const claimReward = async (index) => {
    const wallet = wallets.value[index]
    if (!wallet.tools) return

    try {
      wallet.loading = true
      wallet.status = 'Claiming reward...'
      await wallet.tools.executeClaimReward()
      wallet.status = 'Reward claimed successfully'
    } catch (error) {
      wallet.status = `Error: ${error.message}`
      console.error('Failed to claim reward:', error)
    } finally {
      wallet.loading = false
    }
  }

  const recycleCard = async (walletIndex, cardIndex) => {
    const wallet = wallets.value[walletIndex]
    if (!wallet.tools) return

    try {
      wallet.loading = true
      wallet.status = 'Recycling card...'
      await wallet.tools.recycleCard(cardIndex)
      wallet.status = 'Card recycled successfully'
      // Refresh cards list
      await queryCards(walletIndex)
    } catch (error) {
      wallet.status = `Error: ${error.message}`
      console.error('Failed to recycle card:', error)
    } finally {
      wallet.loading = false
    }
  }

  const stakeCard = async (walletIndex, cardIndex) => {
    const wallet = wallets.value[walletIndex]
    if (!wallet.tools) return

    try {
      wallet.loading = true
      wallet.status = 'Staking card...'

      // Use the existing stakeCard method pattern
      await wallet.tools.stakeCard(cardIndex)
      wallet.status = 'Card staked successfully'

      // Refresh cards list to update staking status
      await queryCards(walletIndex)
    } catch (error) {
      wallet.status = `Error: ${error.message}`
      console.error('Failed to stake card:', error)
    } finally {
      wallet.loading = false
    }
  }

  // Batch initialize game accounts
  const batchInitGameAccounts = async () => {
    const walletsToInit = wallets.value
      .map((wallet, index) => ({ wallet, index }))
      .filter(({ wallet }) => 
        wallet.firstQueryDone && 
        !wallet.accountInitialized && 
        wallet.tools && 
        !wallet.loading
      )
    
    if (walletsToInit.length === 0) return
    
    console.log(`Starting batch initialization for ${walletsToInit.length} wallets`)
    
    // Process wallets sequentially to avoid overwhelming the network
    for (const { index } of walletsToInit) {
      try {
        console.log(`Initializing wallet ${index + 1}...`)
        await initGameAccount(index)
        // Small delay between operations
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        console.error(`Failed to initialize wallet ${index + 1}:`, error)
        // Continue with next wallet even if one fails
      }
    }
    
    console.log('Batch initialization completed')
  }

  return {
    initializeWallet,
    queryCards,
    initGameAccount,
    openBooster,
    claimReward,
    recycleCard,
    stakeCard,
    batchInitGameAccounts
  }
}