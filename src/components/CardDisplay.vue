<template>
  <div v-show="visible" class="flex flex-col gap-1">
    <div class="flex justify-between no-wrap  gap-2 min-h-[30px]">
      <CardFilter 
      v-model="activeFilter" 
      :cards="cards"
    />
    <Recycle 
      :filteredCards="filteredCards"
      :activeFilter="activeFilter"
      @recycle="handleBatchRecycle"
    />
    </div>
    
    <div class="cards-grid">
      <div 
        v-for="(card, cardIndex) in filteredCards" 
        :key="`${card.id}-${cardIndex}`"
        class="card-item"
        :class="{ 
          recyclable: card.id !== 0 && card.berry_consumption && !card.isStaked,
          staked: card.isStaked
        }"
      >
        <div class="card-info">
          <div class="flex justify-between">
            <p><strong>ID:</strong> {{ card.id }} {{ card.isStaked ? '🔒' : '' }}</p>
            <p><strong>R:</strong> {{ card.rarity }}</p>
          </div>
          <div class="flex justify-between">
            <Berries>{{ card.berry_consumption   }}</Berries>
            <Power>{{ card.hashpower }}</Power>
          </div>
         
        </div>
      
      <!-- Buttons for non-staked cards -->
      <div v-if="card.id !== 0 && !card.isStaked" class="card-actions">
        <button 
          @click="handleStakeCard(card, cardIndex)"
          class="stake-btn"
          :disabled="loading"
        >
          Stake
        </button>
        <button 
          v-if="card.berry_consumption"
          @click="handleRecycleCard(card, cardIndex)"
          class="recycle-btn"
          :disabled="loading"
        >
          Recycle
        </button>
      </div>
      
      <!-- Buttons for staked cards -->
      <div v-else-if="card.isStaked" class="card-actions staked-actions">
        <button 
          @click="handleUnstakeCard(card, cardIndex)"
          class="unstake-btn"
          :disabled="loading"
        >
          Unstake
        </button>
        <div class="staked-label">
          🔒 Staked
        </div>
      </div>
    </div>
    </div>
  </div>  
</template>

<script setup>
import { computed, ref } from 'vue'
import CardFilter from './CardFilter.vue'
import Recycle from './Recycle.vue'
import Power from './ui/Power.vue'
import Berries from './ui/Berries.vue'

const props = defineProps({
  cards: {
    type: Array,
    required: true
  },
  visible: {
    type: Boolean,
    default: true
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['stake-card', 'recycle-card', 'unstake-card', 'batch-recycle'])

const activeFilter = ref('all')

const rarityMap = {
  0: 'common',
  1: 'uncommon', 
  2: 'rare',
  3: 'double_rare',
  4: 'very_rare',
  5: 'super_rare',
  6: 'mega_rare'
}

const filteredCards = computed(() => {
  if (activeFilter.value === 'all') {
    return props.cards
  }
  
  return props.cards.filter(card => {
    const cardRarity = typeof card.rarity === 'number' ? rarityMap[card.rarity] : card.rarity?.toLowerCase()
    return cardRarity === activeFilter.value
  })
})

const getOriginalCardIndex = (card, filteredIndex) => {
  return props.cards.findIndex(originalCard => 
    originalCard.id === card.id && 
    originalCard.rarity === card.rarity &&
    originalCard.hashpower === card.hashpower
  )
}

const handleStakeCard = (card, filteredIndex) => {
  const originalIndex = getOriginalCardIndex(card, filteredIndex)
  emit('stake-card', originalIndex)
}

const handleRecycleCard = (card, filteredIndex) => {
  const originalIndex = getOriginalCardIndex(card, filteredIndex)
  emit('recycle-card', originalIndex)
}

const handleUnstakeCard = (card, filteredIndex) => {
  const originalIndex = getOriginalCardIndex(card, filteredIndex)
  emit('unstake-card', originalIndex)
}

const handleBatchRecycle = (data) => {
  emit('batch-recycle', data)
}
</script>

<style scoped>
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 3px;
  margin-top: 3px;
}

.card-item {
  opacity: 0.85;
  padding: 4px;
  border: 1px solid #ddd;
  border-radius: 3px;
  background: white;
}

.card-item.recyclable {
  border-color: #28a745;
  background: #f8fff8;
}

.card-item.staked {
  opacity: 0.7;
  border-color: #ffc107;
  background: #fffdf0;
}

.card-info p {
  margin: 1px 0;
  font-size: 10px;
}

.card-actions {
  display: flex;
  gap: 2px;
  margin-top: 2px;
}

.stake-btn {
  flex: 1;
  padding: 2px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 10px;
}

.stake-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.recycle-btn {
  flex: 1;
  padding: 2px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 10px;
}

.recycle-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.unstake-btn {
  flex: 1;
  padding: 2px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 10px;
  margin-bottom: 2px;
}

.unstake-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.unstake-btn:hover:not(:disabled) {
  background: #c82333;
}

.staked-actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.staked-actions .staked-label {
  width: 100%;
  padding: 2px;
  background: #ffc107;
  color: #333;
  text-align: center;
  border-radius: 3px;
  font-size: 9px;
  font-weight: bold;
}

.staked-label {
  width: 100%;
  padding: 2px;
  background: #ffc107;
  color: #333;
  text-align: center;
  border-radius: 3px;
  margin-top: 2px;
  font-size: 10px;
  font-weight: bold;
}
</style>