<template>
      <button
        v-for="tab in filterTabs"
        :key="tab.value"
        :class="['filter-tab', { active: activeFilter === tab.value }]"
        @click="setFilter(tab.value)"
      >
        <span class="tab-symbol">{{ tab.symbol }}</span>
      </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  cards: {
    type: Array,
    required: true
  },
  modelValue: {
    type: String,
    default: 'all'
  }
})

const emit = defineEmits(['update:modelValue'])

const activeFilter = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const rarityMap = {
  0: 'common',
  1: 'uncommon', 
  2: 'rare',
  3: 'double_rare',
  4: 'very_rare',
  5: 'super_rare',
  6: 'mega_rare'
}

const getRaritySymbol = (rarity) => {
  switch (rarity) {
    case "all":
      return "All";
    case "rare":
    case "Rare":
      return "★";
    case "common":
    case "Common":
      return "●";
    case "uncommon":
    case "Uncommon":
      return "◆";
    case "double_rare":
    case "DoubleRare":
      return "★★";
    case "very_rare":
    case "VeryRare":
      return "★★★";
    case "super_rare":
    case "SuperRare":
      return "★★★★";
    case "mega_rare":
    case "MegaRare":
      return "★★★★★";
    default:
      return "●";
  }
}

const getCardsByRarity = (rarity) => {
  if (rarity === 'all') return props.cards.length
  
  return props.cards.filter(card => {
    const cardRarity = typeof card.rarity === 'number' ? rarityMap[card.rarity] : card.rarity?.toLowerCase()
    return cardRarity === rarity
  }).length
}

const filterTabs = computed(() => {
  const tabs = [
    { value: 'all', symbol: getRaritySymbol('all'), count: props.cards.length }
  ]
  
  const rarityOrder = ['common', 'uncommon', 'rare', 'double_rare', 'very_rare', 'super_rare', 'mega_rare']
  
  rarityOrder.forEach(rarity => {
    const count = getCardsByRarity(rarity)
    if (count > 0) {
      tabs.push({
        value: rarity,
        symbol: getRaritySymbol(rarity),
        count
      })
    }
  })
  
  return tabs
})

const setFilter = (value) => {
  activeFilter.value = value
}
</script>

<style scoped>
.card-filter {
  margin-bottom: 8px;
}

.filter-tabs {
  display: flex;
  gap: 1px;
  flex-wrap: wrap;
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.filter-tab {
  flex-grow: 1;
  padding: 0 2px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-radius: 3px;
  cursor: pointer;
  font-size: 8px;
  transition: all 0.2s ease;
  display: flex;
  justify-content: center;
  align-items: center;
}

.filter-tab:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-color);
}

.filter-tab.active {
  background: var(--button-primary);
  color: white;
  border-color: var(--button-primary);
}

.tab-symbol {
  font-weight: bold;
  font-size: 8px;
  color: inherit;
}

.tab-count {
  font-size: 11px;
  opacity: 0.8;
  color: inherit;
}

.filter-tab.active .tab-count {
  opacity: 0.9;
  color: white;
}

.filter-tab.active .tab-symbol {
  color: white;
}
</style>