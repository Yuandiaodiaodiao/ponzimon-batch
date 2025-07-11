import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { SolanaWalletTools } from '../utils/solanaTools.js'
import { useNetworkStore } from './useNetworkStore.js'
import bs58 from 'bs58'
import { Keypair, Connection } from '@solana/web3.js'

export const useMasterWalletStore = defineStore('masterWallet', () => {
  // State
  const masterPrivateKey = ref('')
  const isEnabled = ref(false)
  const isInitialized = ref(false)
  const masterWalletTools = ref(null)
  const balance = ref(0)
  const lastBalanceUpdate = ref(0)

  // Network store
  const networkStore = useNetworkStore()

  // Getters
  const hasValidPrivateKey = computed(() => {
    return masterPrivateKey.value && masterPrivateKey.value.length > 0
  })

  const publicKey = computed(() => {
    if (!masterWalletTools.value) return ''
    return masterWalletTools.value.getPublicKey()
  })

  const isReady = computed(() => {
    return isEnabled.value && isInitialized.value && masterWalletTools.value
  })

  // Actions
  const setMasterPrivateKey = (privateKey) => {
    masterPrivateKey.value = privateKey
    if (privateKey) {
      initializeMasterWallet()
    } else {
      clearMasterWallet()
    }
    saveMasterWalletData()
  }

  const setEnabled = (enabled) => {
    isEnabled.value = enabled
    if (enabled && hasValidPrivateKey.value) {
      initializeMasterWallet()
    } else if (!enabled) {
      clearMasterWallet()
    }
    saveMasterWalletData()
  }

  const initializeMasterWallet = async () => {
    try {
      if (!masterPrivateKey.value || !networkStore.config) {
        throw new Error('Missing private key or network config')
      }

      // Validate private key format
      try {
        const secretKey = bs58.decode(masterPrivateKey.value)
        const keypair = Keypair.fromSecretKey(secretKey)
        console.log('Master wallet validated, public key:', keypair.publicKey.toBase58())
      } catch (error) {
        throw new Error('Invalid private key format')
      }

      // Create master wallet tools
      masterWalletTools.value = new SolanaWalletTools(masterPrivateKey.value, networkStore.config)
      isInitialized.value = true
      
      // Update balance
      await updateBalance()
      
      console.log('Master wallet initialized successfully')
    } catch (error) {
      console.error('Failed to initialize master wallet:', error)
      clearMasterWallet()
      throw error
    }
  }

  const clearMasterWallet = () => {
    masterWalletTools.value = null
    isInitialized.value = false
    balance.value = 0
    lastBalanceUpdate.value = 0
  }

  const updateBalance = async () => {
    if (!masterWalletTools.value) return

    try {
      const solBalance = await masterWalletTools.value.getSolBalance()
      balance.value = solBalance
      lastBalanceUpdate.value = Date.now()
      console.log('Master wallet SOL balance updated:', solBalance)
    } catch (error) {
      console.error('Failed to update master wallet balance:', error)
    }
  }

  const getMasterKeypair = () => {
    if (!masterPrivateKey.value) {
      throw new Error('Master wallet not configured')
    }
    
    try {
      const secretKey = bs58.decode(masterPrivateKey.value)
      return Keypair.fromSecretKey(secretKey)
    } catch (error) {
      throw new Error('Invalid master wallet private key')
    }
  }

  const saveMasterWalletData = () => {
    const data = {
      privateKey: masterPrivateKey.value,
      enabled: isEnabled.value
    }
    localStorage.setItem('ponzimon-master-wallet', JSON.stringify(data))
  }

  const loadMasterWalletData = () => {
    try {
      const saved = localStorage.getItem('ponzimon-master-wallet')
      if (saved) {
        const data = JSON.parse(saved)
        masterPrivateKey.value = data.privateKey || ''
        isEnabled.value = data.enabled || false
        
        if (isEnabled.value && hasValidPrivateKey.value && networkStore.config) {
          initializeMasterWallet()
        }
      }
    } catch (error) {
      console.error('Failed to load master wallet data:', error)
    }
  }

  const validateMasterWallet = () => {
    if (!isReady.value) {
      throw new Error('Master wallet is not ready. Please configure and enable master wallet first.')
    }
    
    if (balance.value < 0.01) { // Need at least 0.01 SOL for fees
      throw new Error(`Insufficient SOL in master wallet. Current balance: ${balance.value.toFixed(4)} SOL`)
    }
    
    return true
  }

  // Load data on store creation
  loadMasterWalletData()

  return {
    // State
    masterPrivateKey,
    isEnabled,
    isInitialized,
    masterWalletTools,
    balance,
    lastBalanceUpdate,
    
    // Getters
    hasValidPrivateKey,
    publicKey,
    isReady,
    
    // Actions
    setMasterPrivateKey,
    setEnabled,
    initializeMasterWallet,
    clearMasterWallet,
    updateBalance,
    getMasterKeypair,
    validateMasterWallet,
    saveMasterWalletData,
    loadMasterWalletData
  }
})