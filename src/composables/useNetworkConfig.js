import { ref, reactive } from 'vue'

export function useNetworkConfig() {
  const currentNetwork = ref('devnet')
  const config = reactive({
    rpcUrl: '',
    programId: '',
    tokenMint: '',
    feesWallet: '',
    recipientAccount: ''
  })

  const presets = {
    devnet: {
      rpcUrl: 'https://cool-indulgent-mountain.solana-devnet.quiknode.pro/2ed54ae3de7c4ae7428da73509cdd97da4fa7f71/',
      programId: 'pv5gAmRb1GZ92k7iuLe5JdNmj5R8Ch61N4beuf2yEdK',
      tokenMint: 'mmMeBvEs7dmLXPJZmVQGrV3rTujsAJQHrbJVHQApgJz',
      feesWallet: '8kvqgxQG77pv6RvEou8f2kHSWi3rtx8F7MksXUqNLGmn',
      recipientAccount: '2BhbtC6zXu5eFXfyXQ2aq6icA7xSXEeJTBUDC1ESqc9k'
    },
    mainnet: {
      rpcUrl: 'https://api.mainnet-beta.solana.com',
      programId: 'pv5gAmRb1GZ92k7iuLe5JdNmj5R8Ch61N4beuf2yEdK',
      tokenMint: 'mmMeBvEs7dmLXPJZmVQGrV3rTujsAJQHrbJVHQApgJz',
      feesWallet: '8kvqgxQG77pv6RvEou8f2kHSWi3rtx8F7MksXUqNLGmn',
      recipientAccount: '2BhbtC6zXu5eFXfyXQ2aq6icA7xSXEeJTBUDC1ESqc9k'
    }
  }

  const loadConfig = () => {
    const savedConfig = localStorage.getItem('solana-config')
    if (savedConfig) {
      Object.assign(config, JSON.parse(savedConfig))
    }

    const savedNetwork = localStorage.getItem('solana-network')
    if (savedNetwork) {
      currentNetwork.value = savedNetwork
    }
  }

  const saveConfig = () => {
    localStorage.setItem('solana-config', JSON.stringify(config))
    localStorage.setItem('solana-network', currentNetwork.value)
  }

  const applyPreset = (network) => {
    currentNetwork.value = network
    Object.assign(config, presets[network])
    saveConfig()
  }

  return {
    currentNetwork,
    config,
    presets,
    loadConfig,
    saveConfig,
    applyPreset
  }
}