<template>
  <div v-if="visible" class="modal-overlay" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>⚠️ 检测到合约参数错误</h3>
        <button @click="closeModal" class="close-btn">×</button>
      </div>
      
      <div class="modal-body">
        <p class="error-message">当前配置与合约参数不匹配，请检查以下参数：</p>
        
        <div class="parameter-section">
          <div class="parameter-item">
            <label>Token Mint:</label>
            <div class="parameter-value">
              <span class="value-text">{{ tokenMint }}</span>
              <button @click="copyToClipboard(tokenMint)" class="copy-btn" title="复制">📋</button>
            </div>
          </div>
          
          <div class="parameter-item">
            <label>Fees Wallet:</label>
            <div class="parameter-value">
              <span class="value-text">{{ feesWallet }}</span>
              <button @click="copyToClipboard(feesWallet)" class="copy-btn" title="复制">📋</button>
            </div>
          </div>
        </div>
        
        <div class="actions">
          <button @click="openNetworkConfig" class="config-btn">打开网络配置</button>
          <button @click="closeModal" class="close-action-btn">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { copyToClipboard } from '../utils/helpers.js'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  tokenMint: {
    type: String,
    default: ''
  },
  feesWallet: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close', 'open-config'])

const closeModal = () => {
  emit('close')
}

const openNetworkConfig = () => {
  emit('open-config')
  closeModal()
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
  background: #f8f9fa;
  border-radius: 8px 8px 0 0;
}

.modal-header h3 {
  margin: 0;
  color: #dc3545;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background: #f0f0f0;
}

.modal-body {
  padding: 20px;
}

.error-message {
  color: #666;
  margin-bottom: 20px;
  font-size: 14px;
}

.parameter-section {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 20px;
}

.parameter-item {
  margin-bottom: 16px;
}

.parameter-item:last-child {
  margin-bottom: 0;
}

.parameter-item label {
  display: block;
  font-weight: bold;
  color: #333;
  margin-bottom: 6px;
  font-size: 14px;
}

.parameter-value {
  display: flex;
  align-items: center;
  gap: 8px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px 12px;
}

.value-text {
  flex: 1;
  font-family: monospace;
  font-size: 12px;
  color: #007bff;
  word-break: break-all;
  line-height: 1.4;
}

.copy-btn {
  background: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
  flex-shrink: 0;
}

.copy-btn:hover {
  background: #e9ecef;
  transform: scale(1.05);
}

.actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.config-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.config-btn:hover {
  background: #0056b3;
}

.close-action-btn {
  background: #6c757d;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.close-action-btn:hover {
  background: #545b62;
}
</style>