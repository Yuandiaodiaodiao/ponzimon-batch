import { STORAGE_KEYS } from './constants.js'
import { PublicKey } from '@solana/web3.js'
/**
 * 本地存储工具类
 */
export class StorageHelper {
  /**
   * 获取存储的数据
   * @param {string} key - 存储键
   * @param {any} defaultValue - 默认值
   * @returns {any} 存储的数据或默认值
   */
  static get(key, defaultValue = null) {
    try {
      const value = localStorage.getItem(key)
      return value ? JSON.parse(value) : defaultValue
    } catch (error) {
      console.error(`Error getting ${key} from localStorage:`, error)
      return defaultValue
    }
  }

  /**
   * 设置存储数据
   * @param {string} key - 存储键
   * @param {any} value - 要存储的值
   * @returns {boolean} 是否成功
   */
  static set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch (error) {
      console.error(`Error setting ${key} to localStorage:`, error)
      return false
    }
  }

  /**
   * 删除存储数据
   * @param {string} key - 存储键
   * @returns {boolean} 是否成功
   */
  static remove(key) {
    try {
      localStorage.removeItem(key)
      return true
    } catch (error) {
      console.error(`Error removing ${key} from localStorage:`, error)
      return false
    }
  }

  /**
   * 清空所有存储
   */
  static clear() {
    try {
      localStorage.clear()
      return true
    } catch (error) {
      console.error('Error clearing localStorage:', error)
      return false
    }
  }
}

/**
 * 通用错误处理器
 */
export class ErrorHandler {
  /**
   * 处理异步操作的错误
   * @param {Function} operation - 要执行的操作
   * @param {Object} options - 选项
   * @returns {Promise} 操作结果
   */
  static async handleAsyncOperation(operation, options = {}) {
    const { 
      retryCount = 3, 
      retryDelay = 1000, 
      onError = null,
      onRetry = null
    } = options

    let lastError
    
    for (let i = 0; i < retryCount; i++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error
        
        if (onError) {
          onError(error, i + 1)
        }
        
        if (i < retryCount - 1) {
          if (onRetry) {
            onRetry(i + 1, retryCount)
          }
          await this.delay(retryDelay)
        }
      }
    }
    
    throw lastError
  }

  /**
   * 延迟执行
   * @param {number} ms - 延迟时间（毫秒）
   */
  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 格式化错误消息
   * @param {Error} error - 错误对象
   * @returns {string} 格式化后的错误消息
   */
  static formatError(error) {
    if (!error) return 'Unknown error'
    
    if (error.name === 'NetworkError') {
      return 'Network connection failed. Please check your internet connection.'
    }
    
    if (error.message.includes('insufficient funds')) {
      return 'Insufficient funds for this operation'
    }
    
    if (error.message.includes('timeout')) {
      return 'Operation timed out. Please try again.'
    }
    
    return error.message || 'An unexpected error occurred'
  }
}

/**
 * 通用验证器
 */
export class Validator {
  /**
   * 验证 Base58 编码的私钥
   * @param {string} privateKey - 私钥
   * @returns {boolean} 是否有效
   */
  static isValidPrivateKey(privateKey) {
    if (!privateKey || typeof privateKey !== 'string') return false
    
    // 检查是否为有效的 Base58 字符
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/
    return base58Regex.test(privateKey)
  }

  /**
   * 验证 Base58 编码的公钥
   * @param {string} publicKey - 公钥
   * @returns {boolean} 是否有效
   */
  static async isValidPublicKey(publicKey) {
    if (!publicKey || typeof publicKey !== 'string') return false
    
    try {
      // 使用 Solana 官方 PublicKey 构造函数验证
      new PublicKey(publicKey);
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * 验证 RPC URL
   * @param {string} url - RPC URL
   * @returns {boolean} 是否有效
   */
  static isValidRpcUrl(url) {
    if (!url || typeof url !== 'string') return false
    
    try {
      const urlObj = new URL(url)
      return urlObj.protocol === 'https:' || urlObj.protocol === 'http:'
    } catch {
      return false
    }
  }

  /**
   * 验证配置对象
   * @param {Object} config - 配置对象
   * @returns {Promise<Object>} 验证结果
   */
  static validateConfig(config) {
    const errors = []
    
    if (!config) {
      errors.push('Configuration is required')
      return { valid: false, errors }
    }
    
    if (!this.isValidRpcUrl(config.rpcUrl)) {
      errors.push('Invalid RPC URL')
    }
    
    if (!( this.isValidPublicKey(config.tokenMint))) {
      errors.push('Invalid token mint address')
    }
    
    if (!( this.isValidPublicKey(config.feesWallet))) {
      errors.push('Invalid fees wallet address')
    }
    
    if (!( this.isValidPublicKey(config.recipientAccount))) {
      errors.push('Invalid recipient account address')
    }
    
    if (config.referrerWallet && !( this.isValidPublicKey(config.referrerWallet))) {
      errors.push('Invalid referrer wallet address')
    }
    console.log('errors', errors)
    return {
      valid: errors.length === 0,
      errors
    }
  }
}

/**
 * 格式化工具类
 */
export class FormatHelper {
  /**
   * 格式化数字为可读格式
   * @param {number|string} value - 数值
   * @param {number} decimals - 小数位数
   * @returns {string} 格式化后的字符串
   */
  static formatNumber(value, decimals = 2) {
    if (value === null || value === undefined) return '0'
    
    const num = typeof value === 'string' ? parseFloat(value) : value
    if (isNaN(num)) return '0'
    
    return num.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })
  }

  /**
   * 格式化地址显示
   * @param {string} address - 地址
   * @param {number} startLength - 开始显示的字符数
   * @param {number} endLength - 结尾显示的字符数
   * @returns {string} 格式化后的地址
   */
  static formatAddress(address, startLength = 8, endLength = 4) {
    if (!address) return ''
    
    if (address.length <= startLength + endLength) {
      return address
    }
    
    return `${address.slice(0, startLength)}...${address.slice(-endLength)}`
  }

  /**
   * 格式化时间
   * @param {Date|number} date - 时间
   * @returns {string} 格式化后的时间字符串
   */
  static formatTime(date) {
    if (!date) return ''
    
    const d = new Date(date)
    return d.toLocaleString()
  }

  /**
   * 格式化文件大小
   * @param {number} bytes - 字节数
   * @returns {string} 格式化后的大小
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间
 * @param {boolean} immediate - 是否立即执行
 * @returns {Function} 防抖后的函数
 */
export function debounce(func, wait, immediate = false) {
  let timeout
  
  return function executedFunction(...args) {
    const later = () => {
      timeout = null
      if (!immediate) func.apply(this, args)
    }
    
    const callNow = immediate && !timeout
    
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
    
    if (callNow) func.apply(this, args)
  }
}

/**
 * 节流函数
 * @param {Function} func - 要节流的函数
 * @param {number} limit - 限制时间
 * @returns {Function} 节流后的函数
 */
export function throttle(func, limit) {
  let inThrottle
  
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

/**
 * 深拷贝对象
 * @param {any} obj - 要拷贝的对象
 * @returns {any} 拷贝后的对象
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj)
  if (obj instanceof Array) return obj.map(item => deepClone(item))
  if (obj instanceof Object) {
    const clonedObj = {}
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key])
      }
    }
    return clonedObj
  }
}

/**
 * 复制文本到剪贴板
 * @param {string} text - 要复制的文本
 * @returns {Promise<boolean>} 是否成功复制
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    // Fallback for older browsers
    try {
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)
      return successful
    } catch (fallbackError) {
      console.error('Fallback copy failed:', fallbackError)
      return false
    }
  }
}

/**
 * 根据农场类型获取农场槽位数
 * @param {number} farmType - 农场类型 (1-10)
 * @returns {number} 农场槽位数
 */
export function getFarmSlots(farmType) {
  // 映射农场类型到槽位数: [2, 4, 7, 10, 13, 16, 19, 22, 25, 25]
  const farmSlots = [2, 4, 7, 10, 13, 16, 19, 22, 25, 25]
  
  // 确保farmType在有效范围内
  if (farmType < 1 || farmType > 10) {
    console.warn(`Invalid farm type: ${farmType}. Expected 1-10.`)
    return 2 // 默认返回最小槽位数
  }
  
  // farmType从1开始，数组索引从0开始
  return farmSlots[farmType - 1]
}