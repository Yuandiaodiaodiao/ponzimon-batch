<template>
  <div class="pending-reward">
    <div v-if="loading" class="loading">
      <span class="loading-text">Calculating...</span>
    </div>
    <div v-else-if="error" class="error">
      <span class="error-text">Failed to load pending rewards</span>
    </div>
    <div v-else-if="pendingRewards > 0" class="has-rewards">
      <span class="rewards-text">
        You have <span class="reward-amount">{{ formatRewards(pendingRewards) }}</span><span class="token-symbol">$POKE</span> to claim.
      </span>
    </div>
    <div v-else class="no-rewards">
      <span class="no-rewards-text">No pending rewards</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'

const props = defineProps({
  wallet: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['pending-rewards-updated'])

// State
const pendingRewards = ref(0)
const loading = ref(false)
const error = ref(null)

// Format rewards for display
const formatRewards = (amount) => {
  return Number(amount).toLocaleString('en-US', { 
    minimumFractionDigits: 3, 
    maximumFractionDigits: 6 
  })
}

// Calculate pending rewards
const calculatePendingRewards = async () => {
  if (!props.wallet.tools || !props.wallet.accountInitialized) {
    pendingRewards.value = 0
    return
  }

  try {
    loading.value = true
    error.value = null
    
    console.log(`Calculating pending rewards for wallet: ${props.wallet.publicKey}`)
    const result = await props.wallet.tools.getPendingRewards()
    
    if (result.success) {
      pendingRewards.value = result.rewards
      emit('pending-rewards-updated', result.rewards)
      console.log(`Pending rewards for wallet ${props.wallet.publicKey}: ${result.rewards}`)
    } else {
      error.value = result.error || 'Failed to calculate rewards'
      pendingRewards.value = 0
      emit('pending-rewards-updated', 0)
    }
  } catch (err) {
    console.error('Error calculating pending rewards:', err)
    error.value = err.message
    pendingRewards.value = 0
    emit('pending-rewards-updated', 0)
  } finally {
    loading.value = false
  }
}

// Watch for wallet changes
watch(() => [props.wallet.accountInitialized, props.wallet.tools], () => {
  if (props.wallet.accountInitialized && props.wallet.tools) {
    calculatePendingRewards()
  }
}, { immediate: true })

// Initial calculation
onMounted(() => {
  if (props.wallet.accountInitialized && props.wallet.tools) {
    calculatePendingRewards()
  }
})

// Expose refresh function for parent components
defineExpose({
  refresh: calculatePendingRewards,
  pendingRewards
})
</script>

<style scoped>
.pending-reward {
  margin: 4px 0;
  font-size: 11px;
}

.loading {
  color: #6c757d;
  font-style: italic;
}

.loading-text {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.error {
  color: #dc3545;
}

.error-text {
  font-size: 10px;
}

.has-rewards {
  color: #28a745;
  font-weight: bold;
}

.rewards-text {
  display: flex;
  align-items: center;
  gap: 2px;
}

.reward-amount {
  color: #20c997;
  font-family: monospace;
  font-weight: bold;
  font-size: 12px;
}

.token-symbol {
  color: #ffc107;
  font-weight: bold;
  margin-left: 2px;
}

.no-rewards {
  color: #6c757d;
  font-size: 10px;
}

.no-rewards-text {
  font-style: italic;
}
</style>