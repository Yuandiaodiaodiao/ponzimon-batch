<template>
  <button 
    class="recycle-btn"
    @click="handleRecycle"
  >
    回收({{ activeFilter }})
  </button>
</template>

<script setup>
const props = defineProps({
  filteredCards: {
    type: Array,
    required: true
  },
  activeFilter: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['recycle'])

const handleRecycle = () => {
  emit('recycle', {
    filteredCards: props.filteredCards,
    activeFilter: props.activeFilter
  })
}
</script>

<style scoped>
.recycle-btn {
  min-width: 60px;
  width: fit-content;
  flex-grow: 0;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 10px;
  font-weight: bold;
  transition: background-color 0.2s;
}

.recycle-btn:hover {
  background: #218838;
}

.recycle-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}
</style>