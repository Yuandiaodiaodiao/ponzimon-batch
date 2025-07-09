/**
 * 网络配置类型定义
 */
export interface NetworkConfig {
  rpcUrl: string
  programId: string
  tokenMint: string
  feesWallet: string
  recipientAccount: string
  referrerWallet?: string
}

/**
 * 网络预设类型
 */
export interface NetworkPresets {
  [key: string]: NetworkConfig
}

/**
 * 卡片信息类型
 */
export interface CardInfo {
  id: number
  rarity: number
  hashpower: number
  berry_consumption: number
  isStaked?: boolean
}

/**
 * 农场信息类型
 */
export interface FarmInfo {
  farm_type: number
  total_cards: number
  berry_capacity: string
}

/**
 * 账户信息类型
 */
export interface AccountInfo {
  initialized: boolean
  owner: string
  farm: FarmInfo
  cards: CardInfo[]
  cardCount: number
  stakedCardsBitset: string
  berries: string
  totalHashpower: string
  referrer?: string
}

/**
 * 钱包状态类型
 */
export interface WalletState {
  id: number
  privateKey: string
  publicKey: string
  tools: any // SolanaWalletTools 的实例
  status: string
  loading: boolean
  cards: CardInfo[]
  cardsExpanded: boolean
  accountInitialized: boolean
  accountInfo: AccountInfo | null
  firstQueryDone: boolean
  showFullPublicKey?: boolean // 是否显示完整公钥
  tokenBalance?: string // 代币余额
}

/**
 * 操作选项类型
 */
export interface OperationOptions {
  retryCount?: number
  retryDelay?: number
  onError?: (error: Error, attempt: number) => void
  onRetry?: (attempt: number, maxAttempts: number) => void
}

/**
 * 验证结果类型
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * 操作状态类型
 */
export type OperationStatus = 'pending' | 'loading' | 'success' | 'error' | 'completed'

/**
 * 网络类型
 */
export type NetworkType = 'devnet' | 'mainnet'

/**
 * 错误类型
 */
export type ErrorType = 'NetworkError' | 'WalletError' | 'TransactionError' | 'AccountError' | 'ValidationError'

/**
 * 钱包操作类型
 */
export type WalletOperation = 'query' | 'init' | 'stake' | 'recycle' | 'openBooster' | 'claimReward'

/**
 * 批量操作结果类型
 */
export interface BatchOperationResult {
  success: number
  failed: number
  results: Array<{
    walletIndex: number
    success: boolean
    error?: string
  }>
}

/**
 * 存储键类型
 */
export interface StorageKeys {
  SOLANA_CONFIG: string
  SOLANA_NETWORK: string
  SOLANA_WALLETS: string
}

/**
 * 钱包操作函数类型
 */
export interface WalletOperations {
  initializeWallet: (index: number) => Promise<void>
  queryCards: (index: number) => Promise<void>
  initGameAccount: (index: number) => Promise<void>
  openBooster: (index: number) => Promise<void>
  claimReward: (index: number) => Promise<void>
  recycleCard: (walletIndex: number, cardIndex: number) => Promise<void>
  stakeCard: (walletIndex: number, cardIndex: number) => Promise<void>
  batchInitGameAccounts: () => Promise<void>
}

/**
 * 钱包存储函数类型
 */
export interface WalletStorage {
  wallets: import('vue').Ref<WalletState[]>
  loadWallets: (config: NetworkConfig) => WalletState[]
  saveWallets: () => void
  addWallet: () => number
  removeWallet: (index: number) => void
  clearAllWallets: () => void
  toggleCardsExpanded: (index: number) => void
}

/**
 * 网络配置函数类型
 */
export interface NetworkConfigComposable {
  currentNetwork: import('vue').Ref<string>
  config: NetworkConfig
  presets: NetworkPresets
  loadConfig: () => void
  saveConfig: () => void
  applyPreset: (network: string) => void
}

/**
 * 交易指令类型
 */
export interface TransactionInstruction {
  keys: Array<{
    pubkey: string
    isSigner: boolean
    isWritable: boolean
  }>
  programId: string
  data: Buffer
}

/**
 * 计算预算选项类型
 */
export interface ComputeBudgetOptions {
  computeUnitLimit?: number
  computeUnitPrice?: number
}