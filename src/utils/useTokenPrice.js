import { ref, computed, watch } from 'vue'
import { useNetworkStore } from '../stores/useNetworkStore.js'
import { storeToRefs } from 'pinia'

export function useTokenPrice() {
  const networkStore = useNetworkStore()
  const { currentNetwork, config } = storeToRefs(networkStore)
  const tokenPrice = ref(null)
  const loading = ref(false)
  const error = ref(null)

  const isMainnet = computed(() => currentNetwork.value === 'mainnet')

  const fetchTokenPrice = async () => {
    if (!config.tokenMint || !isMainnet.value) {
      tokenPrice.value = null
      return
    }

    loading.value = true
    error.value = null

    try {
      const response = await fetch(`https://price.jup.ag/v6/price?ids=${config.tokenMint}&vsToken=USDC`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.data && data.data[config.tokenMint]) {
        tokenPrice.value = data.data[config.tokenMint].price
      } else {
        tokenPrice.value = null
      }
    } catch (err) {
      error.value = err.message
      tokenPrice.value = null
    } finally {
      loading.value = false
    }
  }

  // 监听网络和tokenMint变化
  watch([isMainnet, () => config.tokenMint], () => {
    fetchTokenPrice()
  }, { immediate: true })

  return {
    tokenPrice,
    loading,
    error,
    fetchTokenPrice,
    isMainnet
  }
}