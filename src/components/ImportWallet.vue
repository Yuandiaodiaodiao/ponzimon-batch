<template>
  <div v-if="visible" class="import-dialog-overlay" @click="handleClose">
    <div class="import-dialog" @click.stop>
      <div class="dialog-header">
        <h3>批量导入钱包</h3>
        <button @click="handleClose" class="close-btn">×</button>
      </div>
      <div class="dialog-content">
        <div class="input-group">
          <label>私钥 (每行一个):</label>
          <textarea 
            v-model="importPrivateKey" 
            placeholder="请输入私钥（Base58格式），每行一个私钥&#10;例如：&#10;2xD5F3h...&#10;4bK8J2m...&#10;7cL9P6n..."
            rows="8"
            class="private-key-input"
          ></textarea>
          <div class="import-info">
            <span class="key-count">检测到 {{ privateKeyCount }} 个私钥</span>
          </div>
        </div>
        <div class="dialog-actions">
          <button @click="handleBatchImport" :disabled="!importPrivateKey.trim() || importLoading" class="import-btn">
            {{ importLoading ? `导入中... (${importProgress.current}/${importProgress.total})` : `批量导入 (${privateKeyCount}个钱包)` }}
          </button>
          <button @click="handleClose" class="cancel-btn">取消</button>
        </div>
        <div v-if="importProgress.total > 0" class="import-progress">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${(importProgress.current / importProgress.total) * 100}%` }"></div>
          </div>
          <div class="progress-text">
            {{ importProgress.current }}/{{ importProgress.total }} 
            (成功: {{ importProgress.success }}, 失败: {{ importProgress.failed }})
          </div>
        </div>
        <div v-if="importMessage" class="import-message" :class="{ error: importError }">
          {{ importMessage }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useWalletOperationsStore } from '../stores/useWalletOperationsStore'

const props = defineProps({
  visible: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['close'])

const walletOperationsStore = useWalletOperationsStore()
const { importWalletByPrivateKey } = walletOperationsStore

const importPrivateKey = ref('')
const importLoading = ref(false)
const importMessage = ref('')
const importError = ref(false)
const importProgress = ref({
  current: 0,
  total: 0,
  success: 0,
  failed: 0
})

const privateKeyCount = computed(() => {
  if (!importPrivateKey.value.trim()) return 0
  return importPrivateKey.value
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .length
})

const handleClose = () => {
  importPrivateKey.value = ''
  importMessage.value = ''
  importError.value = false
  importProgress.value = {
    current: 0,
    total: 0,
    success: 0,
    failed: 0
  }
  emit('close')
}

const handleBatchImport = async () => {
  if (!importPrivateKey.value.trim()) {
    importMessage.value = '请输入私钥'
    importError.value = true
    return
  }
  
  const privateKeys = importPrivateKey.value
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
  
  if (privateKeys.length === 0) {
    importMessage.value = '请输入有效的私钥'
    importError.value = true
    return
  }
  
  importLoading.value = true
  importMessage.value = ''
  importError.value = false
  importProgress.value = {
    current: 0,
    total: privateKeys.length,
    success: 0,
    failed: 0
  }
  
  try {
    for (let i = 0; i < privateKeys.length; i++) {
      const privateKey = privateKeys[i]
      importProgress.value.current = i + 1
      
      try {
        const result = await importWalletByPrivateKey(privateKey)
        
        if (result.success) {
          importProgress.value.success++
        } else {
          importProgress.value.failed++
          console.error(`Failed to import wallet ${i + 1}:`, result.message)
        }
      } catch (error) {
        importProgress.value.failed++
        console.error(`Error importing wallet ${i + 1}:`, error)
      }
      
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    if (importProgress.value.success > 0) {
      importMessage.value = `批量导入完成！成功导入 ${importProgress.value.success} 个钱包，失败 ${importProgress.value.failed} 个`
      importError.value = false
      
      setTimeout(() => {
        handleClose()
      }, 3000)
    } else {
      importMessage.value = '批量导入失败：所有私钥都无法导入'
      importError.value = true
    }
    
  } catch (error) {
    console.error('Batch import failed:', error)
    importMessage.value = `批量导入失败: ${error.message}`
    importError.value = true
  } finally {
    importLoading.value = false
  }
}
</script>

<style scoped>
.import-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.import-dialog {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e5e5;
  background: #f8f9fa;
  border-radius: 8px 8px 0 0;
}

.dialog-header h3 {
  margin: 0;
  color: #333;
  font-size: 18px;
}

.dialog-header .close-btn {
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
  transition: all 0.2s ease;
}

.dialog-header .close-btn:hover {
  background: #e9ecef;
  color: #333;
}

.dialog-content {
  padding: 20px;
}

.dialog-content .input-group {
  margin-bottom: 16px;
}

.dialog-content .input-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: bold;
  color: #333;
  font-size: 14px;
}

.private-key-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  font-family: monospace;
  resize: vertical;
  min-height: 120px;
  box-sizing: border-box;
  line-height: 1.4;
}

.private-key-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.import-info {
  margin-top: 8px;
  padding: 6px 10px;
  background: #e8f4f8;
  border-radius: 4px;
  border: 1px solid #b8e0d2;
}

.key-count {
  color: #2c3e50;
  font-size: 13px;
  font-weight: 500;
}

.import-progress {
  margin-top: 16px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 4px;
  border: 1px solid #e5e5e5;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #007bff, #0056b3);
  transition: width 0.3s ease;
  border-radius: 4px;
}

.progress-text {
  font-size: 13px;
  color: #666;
  text-align: center;
  font-weight: 500;
}

.dialog-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.import-btn {
  flex: 1;
  padding: 12px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.import-btn:hover:not(:disabled) {
  background: #0056b3;
  transform: translateY(-1px);
}

.import-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
  transform: none;
}

.cancel-btn {
  flex: 1;
  padding: 12px 16px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.cancel-btn:hover {
  background: #5a6268;
  transform: translateY(-1px);
}

.import-message {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 4px;
  font-size: 14px;
  text-align: center;
  font-weight: 500;
}

.import-message:not(.error) {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.import-message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}
</style>