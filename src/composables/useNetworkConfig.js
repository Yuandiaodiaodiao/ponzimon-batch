import { ref, reactive, watch } from 'vue'
import { NETWORK_PRESETS, STORAGE_KEYS } from '../utils/constants.js'
import { StorageHelper, Validator } from '../utils/helpers.js'

export function useNetworkConfig() {
  const currentNetwork = ref('devnet')
  const config = reactive({
    rpcUrl: '',
    programId: '',
    tokenMint: '',
    feesWallet: '',
    recipientAccount: '',
    referrerWallet: ''
  })

  // 配置变更回调函数列表
  const configChangeCallbacks = []

  // 注册配置变更回调
  const onConfigChange = (callback) => {
    configChangeCallbacks.push(callback)
  }

  // 触发配置变更回调
  const triggerConfigChangeCallbacks = () => {
    configChangeCallbacks.forEach(callback => {
      try {
        callback(config)
      } catch (error) {
        console.error('Error in config change callback:', error)
      }
    })
  }

  // 监听配置变化，自动保存
  watch(() => ({ ...config }), () => {
    console.log('config changed', config)
    saveConfig()
    triggerConfigChangeCallbacks()
  }, { deep: true })

  // 监听网络变化，自动保存
  watch(currentNetwork, () => {
    saveConfig()
    triggerConfigChangeCallbacks()
  })

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
  loadConfig();
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

  return {
    currentNetwork,
    config,
    presets: NETWORK_PRESETS,
    loadConfig,
    saveConfig,
    applyPreset,
    validateCurrentConfig,
    getAvailableNetworks,
    isValidNetwork,
    onConfigChange
  }
}