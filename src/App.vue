<script setup>
import SolanaWalletManager from './components/SolanaWalletManager.vue'
</script>

<template>
  <div id="app">
    <SolanaWalletManager />
  </div>
</template>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}

body {
  margin: 0;
  padding: 0;
  background-color: #f5f5f5;
}

* {
  box-sizing: border-box;
}

button {
  cursor: pointer;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  transition: all 0.3s ease;
}

button:hover:not(:disabled) {
  opacity: 0.8;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

input[type="text"], input[type="password"] {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

input[type="text"]:focus, input[type="password"]:focus {
  outline: none;
  border-color: #007bff;
}

.text-success {
  color: #28a745;
}

.text-error {
  color: #dc3545;
}

.text-warning {
  color: #ffc107;
}
</style>
