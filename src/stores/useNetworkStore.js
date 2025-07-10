import { defineStore } from 'pinia'
import { ref, reactive, watch } from 'vue'
import { NETWORK_PRESETS, STORAGE_KEYS } from '../utils/constants.js'
import { StorageHelper, Validator } from '../utils/helpers.js'

export const useNetworkStore = defineStore('network', () => {
  // State
  const currentNetwork = ref('devnet')
  const config = reactive({
    rpcUrl: '',
    programId: '',
    tokenMint: '',
    feesWallet: '',
    recipientAccount: '',
    referrerWallet: ''
  })

  // Getters
  const presets = NETWORK_PRESETS

  // Actions
  /**
   * 加载配置
   */
  const loadConfig = () => {
    console.log('loadConfig from storage')
    try {
      // 加载保存的配置
      const savedConfig = StorageHelper.get(STORAGE_KEYS.SOLANA_CONFIG)
      if (savedConfig) {
        const validation = Validator.validateConfig(savedConfig)
        if (validation.valid) {
          Object.assign(config, savedConfig)
        } else {
          console.warn('Invalid saved config, using defaults:', validation.errors)
        }
      }

      // 加载保存的网络
      const savedNetwork = StorageHelper.get(STORAGE_KEYS.SOLANA_NETWORK, 'devnet')
      if (savedNetwork && NETWORK_PRESETS[savedNetwork]) {
        currentNetwork.value = savedNetwork
      }
    } catch (error) {
      console.error('Failed to load config:', error)
      // 使用默认配置
      applyPreset('devnet')
    }
  }

  /**
   * 保存配置
   */
  const saveConfig = () => {
    try {
      StorageHelper.set(STORAGE_KEYS.SOLANA_CONFIG, { ...config })
      StorageHelper.set(STORAGE_KEYS.SOLANA_NETWORK, currentNetwork.value)
    } catch (error) {
      console.error('Failed to save config:', error)
    }
  }

  /**
   * 应用预设配置
   */
  const applyPreset = (network) => {
    if (!NETWORK_PRESETS[network]) {
      console.error(`Unknown network preset: ${network}`)
      return false
    }

    try {
      currentNetwork.value = network
      
      // 保存当前的 recipientAccount 和 referrerWallet
      const currentRecipientAccount = config.recipientAccount
      const currentReferrerWallet = config.referrerWallet
      
      // 应用预设配置
      Object.assign(config, NETWORK_PRESETS[network])
      
      // 恢复用户自定义的 recipientAccount 和 referrerWallet
      if (currentRecipientAccount) {
        config.recipientAccount = currentRecipientAccount
      }
      if (currentReferrerWallet) {
        config.referrerWallet = currentReferrerWallet
      }
      
      return true
    } catch (error) {
      console.error('Failed to apply preset:', error)
      return false
    }
  }

  /**
   * 验证当前配置
   */
  const validateCurrentConfig = () => {
    return Validator.validateConfig(config)
  }

  /**
   * 获取所有可用的网络预设
   */
  const getAvailableNetworks = () => {
    return Object.keys(NETWORK_PRESETS)
  }

  /**
   * 检查是否为有效的网络
   */
  const isValidNetwork = (network) => {
    return NETWORK_PRESETS.hasOwnProperty(network)
  }

  // Watchers
  // 监听配置变化，自动保存
  watch(() => ({ ...config }), () => {
    console.log('config changed', config)
    saveConfig()
  }, { deep: true })

  // 监听网络变化，自动保存
  watch(currentNetwork, () => {
    saveConfig()
  })

  // Initialize
  loadConfig()

  return {
    // State
    currentNetwork,
    config,
    
    // Getters
    presets,
    
    // Actions
    loadConfig,
    saveConfig,
    applyPreset,
    validateCurrentConfig,
    getAvailableNetworks,
    isValidNetwork
  }
})