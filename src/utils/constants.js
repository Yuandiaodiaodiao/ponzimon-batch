// 网络预设配置
export const NETWORK_PRESETS = {
  devnet: {
    rpcUrl: 'https://cool-indulgent-mountain.solana-devnet.quiknode.pro/2ed54ae3de7c4ae7428da73509cdd97da4fa7f71/',
    programId: 'pv5gAmRb1GZ92k7iuLe5JdNmj5R8Ch61N4beuf2yEdK',
    tokenMint: 'mmMeBvEs7dmLXPJZmVQGrV3rTujsAJQHrbJVHQApgJz',
    feesWallet: '8kvqgxQG77pv6RvEou8f2kHSWi3rtx8F7MksXUqNLGmn',
    recipientAccount: '2of2F1wiv1hhea3Ar7WPs7eUMoMQqroTjbFn3PCemvCK',
    referrerWallet: '2of2F1wiv1hhea3Ar7WPs7eUMoMQqroTjbFn3PCemvCK' // 默认使用feesWallet
  },
  mainnet: {
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    programId: 'pmnSxWFQUz7nCncGznUYhaJdJFFUvcx97GZFhbiCYWi',
    tokenMint: 'mmMeBvEs7dmLXPJZmVQGrV3rTujsAJQHrbJVHQApgJz',
    feesWallet: '8kvqgxQG77pv6RvEou8f2kHSWi3rtx8F7MksXUqNLGmn',
    recipientAccount: '2of2F1wiv1hhea3Ar7WPs7eUMoMQqroTjbFn3PCemvCK',
    referrerWallet: '2of2F1wiv1hhea3Ar7WPs7eUMoMQqroTjbFn3PCemvCK' // 默认使用feesWallet
  }
}

// 本地存储键名
export const STORAGE_KEYS = {
  SOLANA_CONFIG: 'solana-config',
  SOLANA_NETWORK: 'solana-network',
  SOLANA_WALLETS: 'solana-wallets'
}

// 操作状态
export const OPERATION_STATUS = {
  PENDING: 'pending',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
  COMPLETED: 'completed'
}

// 钱包状态
export const WALLET_STATUS = {
  NOT_INITIALIZED: 'Not initialized',
  INITIALIZED: 'Initialized',
  LOADING: 'Loading...',
  QUERYING: 'Querying account info...',
  ACCOUNT_NOT_INITIALIZED: 'Account not initialized',
  INITIALIZING_GAME_ACCOUNT: 'Initializing game account...',
  GAME_ACCOUNT_INITIALIZED: 'Game account initialized',
  OPENING_BOOSTER: 'Opening booster...',
  BOOSTER_OPENED: 'Booster opened successfully',
  CLAIMING_REWARD: 'Claiming reward...',
  REWARD_CLAIMED: 'Reward claimed successfully',
  RECYCLING_CARD: 'Recycling card...',
  CARD_RECYCLED: 'Card recycled successfully',
  STAKING_CARD: 'Staking card...',
  CARD_STAKED: 'Card staked successfully',
  UNSTAKING_CARD: 'Unstaking card...',
  CARD_UNSTAKED: 'Card unstaked successfully'
}

// 错误类型
export const ERROR_TYPES = {
  NETWORK_ERROR: 'NetworkError',
  WALLET_ERROR: 'WalletError',
  TRANSACTION_ERROR: 'TransactionError',
  ACCOUNT_ERROR: 'AccountError',
  VALIDATION_ERROR: 'ValidationError'
}

// 默认配置
export const DEFAULT_CONFIG = {
  RETRY_COUNT: 3,
  RETRY_DELAY: 1000,
  BATCH_DELAY: 1000,
  CONFIRMATION_TIMEOUT: 30000,
  COMPUTE_UNIT_LIMIT: 1000000,
  COMPUTE_UNIT_PRICE: 200
}

// 指令标识符
export const INSTRUCTION_IDENTIFIERS = {
  PURCHASE_INITIAL_FARM: 'g1kRhvHV4V2',
  STAKE_CARD: '616fabbab3c644ac',
  UNSTAKE_CARD: 'e4b29fb77701c5de',
  OPEN_BOOSTER_COMMIT: '07fc87dff2ecf25d',
  SETTLE_OPEN_BOOSTER: 'e490c7385edf09e2',
  CLAIM_REWARD: '0490844774179750',
  RECYCLE_CARDS_COMMIT: 'c7d160c7cd3942ef',
  RECYCLE_CARDS_SETTLE: '2bbb21f9b8e17f8f'
}

// 文件大小限制
export const FILE_SIZE_LIMITS = {
  MAX_WALLETS: 100,
  MAX_CARDS_PER_WALLET: 128
}

// 验证规则
export const VALIDATION_RULES = {
  PRIVATE_KEY_LENGTH: 88, // Base58 编码的私钥长度
  PUBLIC_KEY_LENGTH: 44   // Base58 编码的公钥长度
}