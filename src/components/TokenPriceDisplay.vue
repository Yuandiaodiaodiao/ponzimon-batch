<template>
  <div class="token-price-display">
    <div v-if="loading" class="loading">
      Loading price...
    </div>
    <div v-else-if="error" class="error">
      Price unavailable: {{ error }}
    </div>
    <div v-else-if="tokenPrice !== null" class="price">
      ${{ tokenPrice.toFixed(6) }} USDC
    </div>
    <div v-else-if="!isMainnet" class="disabled">
      Price only available on mainnet
    </div>
    <div v-else class="no-price">
      No price data
    </div>
  </div>
</template>

<script setup>
import { useTokenPrice } from '../utils/useTokenPrice.js'


const { tokenPrice, loading, error, isMainnet } = useTokenPrice()


</script>

<style scoped>
.token-price-display {
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
}

.loading {
  color: #666;
}

.error {
  color: #dc3545;
}

.price {
  color: #28a745;
  font-weight: 600;
}

.disabled {
  color: #6c757d;
  font-style: italic;
}

.no-price {
  color: #ffc107;
}
</style>