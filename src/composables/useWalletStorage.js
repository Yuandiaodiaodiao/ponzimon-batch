import { ref } from 'vue'
import { Keypair } from '@solana/web3.js'
import bs58 from 'bs58'
import { SolanaWalletTools } from '../utils/solanaTools.js'

export function useWalletStorage() {
  const wallets = ref([])

  const loadWallets = (config) => {
    const savedWallets = localStorage.getItem('solana-wallets')
    if (savedWallets) {
      wallets.value = JSON.parse(savedWallets)
      wallets.value.forEach((item, index) => {
        wallets.value[index].tools = new SolanaWalletTools(item.privateKey, config)
        wallets.value[index].cards = []
        wallets.value[index].loading = false
        wallets.value[index].cardsExpanded = false
        wallets.value[index].accountInitialized = false
        wallets.value[index].accountInfo = null
        wallets.value[index].firstQueryDone = wallets.value[index].firstQueryDone || false
      })
    }
    return wallets.value
  }

  const saveWallets = () => {
    localStorage.setItem('solana-wallets', JSON.stringify(
      wallets.value.map(item => ({ ...item, tools: null }))
    ))
  }

  const addWallet = () => {
    // Generate a new random Solana keypair
    const keypair = Keypair.generate()
    const privateKeyBase58 = bs58.encode(keypair.secretKey)

    const newWallet = {
      id: Date.now(),
      privateKey: privateKeyBase58,
      publicKey: keypair.publicKey.toBase58(),
      tools: null,
      status: 'Not initialized',
      loading: false,
      cards: [],
      cardsExpanded: false,
      accountInitialized: false,
      accountInfo: null,
      firstQueryDone: false // Track if first query has completed
    }
    wallets.value.push(newWallet)
    saveWallets()
    // Return the index of the newly added wallet for initialization
    return wallets.value.length - 1
  }

  const removeWallet = (index) => {
    wallets.value.splice(index, 1)
    saveWallets()
  }

  const clearAllWallets = () => {
    wallets.value = []
    saveWallets()
  }

  const toggleCardsExpanded = (index) => {
    wallets.value[index].cardsExpanded = !wallets.value[index].cardsExpanded
  }

  return {
    wallets,
    loadWallets,
    saveWallets,
    addWallet,
    removeWallet,
    clearAllWallets,
    toggleCardsExpanded
  }
}