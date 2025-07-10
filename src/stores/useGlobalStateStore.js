import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { queryGlobalState } from '../utils/solanaTools.js'
import { useNetworkStore } from './useNetworkStore.js'
import { createApp } from 'vue'
import ParameterMismatchModal from '../components/ParameterMismatchModal.vue'

export const useGlobalStateStore = defineStore('globalState', () => {
  // State
  const globalState = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const lastUpdated = ref(null)
  const parameterMismatchModal = ref(null)

  // Network store for config
  const networkStore = useNetworkStore()

  // Computed
  const isLoaded = computed(() => globalState.value !== null)
  
  const formattedStats = computed(() => {
    if (!globalState.value) return null
    
    return {
      totalSupply: formatTokenAmount(globalState.value.total_supply),
      burnedTokens: formatTokenAmount(globalState.value.burned_tokens),
      cumulativeRewards: formatTokenAmount(globalState.value.cumulative_rewards),
      totalBerries: formatNumber(globalState.value.total_berries),
      totalHashpower: formatNumber(globalState.value.total_hashpower),
      totalBoosterPacksOpened: formatNumber(globalState.value.total_booster_packs_opened),
      totalStakedTokens: formatTokenAmount(globalState.value.total_staked_tokens),
      totalSolDeposited: formatSolAmount(globalState.value.total_sol_deposited),
      productionEnabled: globalState.value.production_enabled,
      burnRate: globalState.value.burn_rate,
      referralFee: globalState.value.referral_fee
    }
  })

  const gameStatistics = computed(() => {
    if (!globalState.value) return null
    
    return {
      totalGambles: formatNumber(globalState.value.total_global_gambles),
      totalGambleWins: formatNumber(globalState.value.total_global_gamble_wins),
      winRate: globalState.value.total_global_gambles > 0 
        ? ((Number(globalState.value.total_global_gamble_wins) / Number(globalState.value.total_global_gambles)) * 100).toFixed(2) + '%'
        : '0%',
      recyclingAttempts: formatNumber(globalState.value.total_card_recycling_attempts),
      successfulRecycling: formatNumber(globalState.value.total_successful_card_recycling),
      recyclingSuccessRate: globalState.value.total_card_recycling_attempts > 0
        ? ((Number(globalState.value.total_successful_card_recycling) / Number(globalState.value.total_card_recycling_attempts)) * 100).toFixed(2) + '%'
        : '0%'
    }
  })

  const economicData = computed(() => {
    if (!globalState.value) return null
    
    return {
      rewardRate: formatNumber(globalState.value.reward_rate),
      tokenRewardRate: formatNumber(globalState.value.token_reward_rate),
      boosterCost: formatTokenAmount(globalState.value.booster_pack_cost_microtokens),
      farmPurchaseFee: formatSolAmount(globalState.value.initial_farm_purchase_fee_lamports),
      gambleFee: formatSolAmount(globalState.value.gamble_fee_lamports),
      cooldownSlots: formatNumber(globalState.value.cooldown_slots),
      stakingLockupSlots: formatNumber(globalState.value.staking_lockup_slots)
    }
  })

  // Actions
  const fetchGlobalState = async () => {
    try {
      loading.value = true
      error.value = null
      
      console.log('Fetching global state...')
      
      const config = networkStore.config
      if (!config) {
        throw new Error('Network configuration not available')
      }
      
      const result = await queryGlobalState(config)
      console.log('Global state fetched successfully:', result)
      if (result) {
        globalState.value = result
        lastUpdated.value = new Date()
        
        // 验证参数是否匹配
        console.log('开始验证')
        validateContractParameters(result, config)
      } else {
        throw new Error('Global state not found')
      }
      
    } catch (err) {
      console.error('Failed to fetch global state:', err)
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  const refreshGlobalState = async () => {
    console.log('Refreshing global state...')
    await fetchGlobalState()
  }
  setTimeout(() => {
    refreshGlobalState()
  }, 30e3)

  const clearGlobalState = () => {
    globalState.value = null
    error.value = null
    lastUpdated.value = null
  }

  // 验证合约参数
  const validateContractParameters = (globalStateData, currentConfig) => {
    const contractTokenMint = globalStateData.token_mint
    const contractFeesWallet = globalStateData.fees_wallet
    
    const configTokenMint = currentConfig.tokenMint
    const configFeesWallet = currentConfig.feesWallet
    
    console.log('Parameter validation:', {
      contract: { tokenMint: contractTokenMint, feesWallet: contractFeesWallet },
      config: { tokenMint: configTokenMint, feesWallet: configFeesWallet }
    })
    
    const tokenMintMismatch = contractTokenMint !== configTokenMint
    const feesWalletMismatch = contractFeesWallet !== configFeesWallet
    
    if (tokenMintMismatch || feesWalletMismatch) {
      console.warn('Contract parameter mismatch detected!')
      showParameterMismatchModal(contractTokenMint, contractFeesWallet)
    }
  }

  // 显示参数错误弹窗
  const showParameterMismatchModal = (tokenMint, feesWallet) => {
    // 创建弹窗容器
    const modalContainer = document.createElement('div')
    modalContainer.id = 'parameter-mismatch-modal'
    document.body.appendChild(modalContainer)
    
    // 创建Vue应用实例
    const modalApp = createApp(ParameterMismatchModal, {
      visible: true,
      tokenMint: tokenMint,
      feesWallet: feesWallet,
      onClose: () => {
        modalApp.unmount()
        document.body.removeChild(modalContainer)
      },
      onOpenConfig: () => {
        // 可以在这里触发打开网络配置的事件
        console.log('User requested to open network config')
        // 这里可以发送全局事件或调用路由
      }
    })
    
    modalApp.mount(modalContainer)
  }

  // Formatting helpers
  function formatTokenAmount(amount) {
    if (!amount) return '0'
    const tokenAmount = Number(amount) / 1000000 // 6 decimals
    return tokenAmount.toLocaleString('en-US', { maximumFractionDigits: 6 })
  }

  function formatSolAmount(lamports) {
    if (!lamports) return '0'
    const solAmount = Number(lamports) / 1000000000 // 9 decimals for SOL
    return solAmount.toLocaleString('en-US', { maximumFractionDigits: 9 })
  }

  function formatNumber(value) {
    if (!value) return '0'
    return Number(value).toLocaleString('en-US')
  }

  return {
    // State
    globalState,
    loading,
    error,
    lastUpdated,
    
    // Computed
    isLoaded,
    formattedStats,
    gameStatistics,
    economicData,
    
    // Actions
    fetchGlobalState,
    refreshGlobalState,
    clearGlobalState
  }
})