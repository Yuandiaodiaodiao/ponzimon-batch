import {
  Keypair,
  SystemProgram,
  Transaction,
  PublicKey,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_SLOT_HASHES_PUBKEY,
  Connection
} from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createTransferCheckedInstruction
} from '@solana/spl-token'
import bs58 from 'bs58'
import { Buffer } from 'node:buffer';


// Create compute budget instructions helper
const createComputeBudgetInstructions = () => {
  const instructions = []

  // 1. Set compute unit limit to 1,000,000
  const computeUnitLimit = 1000000
  const computeUnitLimitInstruction = new TransactionInstruction({
    keys: [],
    programId: new PublicKey('ComputeBudget111111111111111111111111111111'),
    data: Buffer.concat([
      Buffer.from([0x02]), // SetComputeUnitLimit instruction
      Buffer.from(new Uint8Array(new Uint32Array([computeUnitLimit]).buffer))
    ])
  })
  instructions.push(computeUnitLimitInstruction)

  // 2. Set compute unit price to 0.2 lamports (200 micro-lamports)
  const computeUnitPrice = 200
  const computeUnitPriceInstruction = new TransactionInstruction({
    keys: [],
    programId: new PublicKey('ComputeBudget111111111111111111111111111111'),
    data: Buffer.concat([
      Buffer.from([0x03]), // SetComputeUnitPrice instruction
      Buffer.from(new Uint8Array(new BigUint64Array([BigInt(computeUnitPrice)]).buffer))
    ])
  })
  instructions.push(computeUnitPriceInstruction)

  return instructions
}

// Account decoder for user data
class AccountDecoder {
  constructor(connection) {
    this.connection = connection
  }

  // Calculate account discriminator
  async accountDiscriminator(accountName) {
    const preimage = `account:${accountName}`
    const encoder = new TextEncoder()
    const data = encoder.encode(preimage)
    const hash = await crypto.subtle.digest('SHA-256', data)
    return new Uint8Array(hash).slice(0, 8)
  }

  // Decode pubkey (32 bytes)
  decodePubkey(buffer, offset) {
    const pubkeyBytes = buffer.slice(offset, offset + 32)
    return {
      value: new PublicKey(pubkeyBytes).toBase58(),
      nextOffset: offset + 32
    }
  }

  // Decode u8
  decodeU8(buffer, offset) {
    return {
      value: buffer[offset],
      nextOffset: offset + 1
    }
  }

  // Decode u16 (2 bytes, little endian)
  decodeU16(buffer, offset) {
    const value = buffer[offset] | (buffer[offset + 1] << 8)
    return {
      value: value,
      nextOffset: offset + 2
    }
  }

  // Decode u64 (8 bytes, little endian)
  decodeU64(buffer, offset) {
    let value = 0n
    for (let i = 0; i < 8; i++) {
      value = value | (BigInt(buffer[offset + i]) << BigInt(8 * i))
    }
    return {
      value: value.toString(),
      nextOffset: offset + 8
    }
  }

  // Decode u128 (16 bytes, little endian)
  decodeU128(buffer, offset) {
    let low = 0n
    let high = 0n

    // Read low 8 bytes
    for (let i = 0; i < 8; i++) {
      low = low | (BigInt(buffer[offset + i]) << BigInt(8 * i))
    }

    // Read high 8 bytes
    for (let i = 0; i < 8; i++) {
      high = high | (BigInt(buffer[offset + 8 + i]) << BigInt(8 * i))
    }

    const value = (high << 64n) | low
    return {
      value: value.toString(),
      nextOffset: offset + 16
    }
  }

  // Decode option type
  decodeOption(buffer, offset, innerDecoder) {
    const hasValue = buffer[offset]
    if (hasValue === 0) {
      return {
        value: null,
        nextOffset: offset + 1
      }
    } else {
      const result = innerDecoder.call(this, buffer, offset + 1)
      return {
        value: result.value,
        nextOffset: result.nextOffset
      }
    }
  }

  // Decode Farm structure
  decodeFarm(buffer, offset) {
    const farm = {}
    let currentOffset = offset

    // farm_type (u8 - 1 byte)
    const farmType = this.decodeU8(buffer, currentOffset)
    farm.farm_type = farmType.value
    currentOffset = farmType.nextOffset

    // total_cards (u8 - 1 byte)
    const totalCards = this.decodeU8(buffer, currentOffset)
    farm.total_cards = totalCards.value
    currentOffset = totalCards.nextOffset

    // berry_capacity (u64 - 8 bytes)
    const berryCapacity = this.decodeU64(buffer, currentOffset)
    farm.berry_capacity = berryCapacity.value
    currentOffset = berryCapacity.nextOffset

    return {
      value: farm,
      nextOffset: currentOffset
    }
  }

  // Decode Card structure
  decodeCard(buffer, offset) {
    const card = {}
    let currentOffset = offset

    // id (u16 - 2 bytes)
    const id = this.decodeU16(buffer, currentOffset)
    card.id = id.value
    currentOffset = id.nextOffset

    // rarity (u8 - 1 byte)
    const rarity = this.decodeU8(buffer, currentOffset)
    card.rarity = rarity.value
    currentOffset = rarity.nextOffset

    // hashpower (u16 - 2 bytes)
    const hashpower = this.decodeU16(buffer, currentOffset)
    card.hashpower = hashpower.value
    currentOffset = hashpower.nextOffset

    // berry_consumption (u8 - 1 byte)
    const berryConsumption = this.decodeU8(buffer, currentOffset)
    card.berry_consumption = berryConsumption.value
    currentOffset = berryConsumption.nextOffset

    return {
      value: card,
      nextOffset: currentOffset
    }
  }

  // Decode complete player data
  async decodePlayerData(accountData) {
    const player = {}
    const discriminatorLength = 8
    const dataWithoutDiscriminator = accountData.slice(discriminatorLength)
    let currentOffset = 0

    // 1. owner (pubkey - 32 bytes)
    const owner = this.decodePubkey(dataWithoutDiscriminator, currentOffset)
    player.owner = owner.value
    currentOffset = owner.nextOffset

    // 2. farm (Farm structure - 10 bytes)
    const farm = this.decodeFarm(dataWithoutDiscriminator, currentOffset)
    player.farm = farm.value
    currentOffset = farm.nextOffset

    // 3. cards (128 cards)
    const cards = []
    for (let i = 0; i < 128; i++) {
      const card = this.decodeCard(dataWithoutDiscriminator, currentOffset)
      cards.push(card.value)
      currentOffset = card.nextOffset
    }
    player.cards = cards

    // 4. card_count (u8 - 1 byte)
    const cardCount = this.decodeU8(dataWithoutDiscriminator, currentOffset)
    player.card_count = cardCount.value
    currentOffset = cardCount.nextOffset

    // 5. staked_cards_bitset (u128 - 16 bytes)
    const stakedCardsBitset = this.decodeU128(dataWithoutDiscriminator, currentOffset)
    player.staked_cards_bitset = stakedCardsBitset.value
    currentOffset = stakedCardsBitset.nextOffset

    // 6. berries (u64 - 8 bytes)
    const berries = this.decodeU64(dataWithoutDiscriminator, currentOffset)
    player.berries = berries.value
    currentOffset = berries.nextOffset

    // 7. total_hashpower (u64 - 8 bytes)
    const totalHashpower = this.decodeU64(dataWithoutDiscriminator, currentOffset)
    player.total_hashpower = totalHashpower.value
    currentOffset = totalHashpower.nextOffset

    // 8. referrer (option pubkey)
    const referrer = this.decodeOption(dataWithoutDiscriminator, currentOffset, this.decodePubkey)
    player.referrer = referrer.value
    currentOffset = referrer.nextOffset

    // Return all decoded data
    return player
  }
}

export class SolanaWalletTools {
  constructor(privateKey, config) {
    console.log('Initializing SolanaWalletTools with config:', config)
    
    if (!config || !config.rpcUrl) {
      throw new Error('Missing RPC URL in config')
    }
    
    this.config = config
    this.connection = new Connection(config.rpcUrl, 'confirmed')
    console.log('Connection created to:', config.rpcUrl)

    // Create wallet from private key
    try {
      const secretKey = bs58.decode(privateKey)
      this.wallet = Keypair.fromSecretKey(secretKey)
      console.log('Wallet created successfully, public key:', this.wallet.publicKey.toBase58())
    } catch (error) {
      console.error('Failed to create wallet from private key:', error)
      throw new Error('Invalid private key')
    }

    // Operation lock to prevent concurrent operations
    this.operationLock = false
    this.lockQueue = []

    // Initialize addresses
    try {
      this.programId = new PublicKey(config.programId)
      this.tokenMint = new PublicKey(config.tokenMint)
      this.feesWallet = new PublicKey(config.feesWallet)
      this.recipientAccount = new PublicKey(config.recipientAccount)
      
      console.log('All addresses initialized successfully')
    } catch (error) {
      console.error('Failed to initialize addresses:', error)
      throw new Error('Invalid address configuration')
    }

    // Default referrer wallet (will be updated when account info is fetched)
    this.referrerWallet = new PublicKey(config.referrerWallet || config.feesWallet)

    // Calculate PDAs
    const [globalState] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_state"), this.tokenMint.toBuffer()],
      this.programId
    )
    this.globalState = globalState

    const [playerPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("player"),
        this.wallet.publicKey.toBuffer(),
        this.tokenMint.toBuffer()
      ],
      this.programId
    )
    this.playerPDA = playerPDA

    const [rewardsVault] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("rewards_vault"),
        this.tokenMint.toBuffer()
      ],
      this.programId
    )
    this.rewardsVault = rewardsVault

    // Initialize token accounts asynchronously
    this.initialized = false
    this.initializeTokenAccounts()
  }

  async initializeTokenAccounts() {
    try {
      this.playerTokenAccount = await getAssociatedTokenAddress(
        this.tokenMint,
        this.wallet.publicKey
      )
      this.recipientTokenAccount = await getAssociatedTokenAddress(
        this.tokenMint,
        this.recipientAccount
      )
      this.feesTokenAccount = await getAssociatedTokenAddress(
        this.tokenMint,
        this.feesWallet
      )

      // Initialize referrer token account (may be updated later)
      try {
        this.referrerTokenAccount = await getAssociatedTokenAddress(
          this.tokenMint,
          this.referrerWallet
        )
      } catch (error) {
        console.warn('Failed to initialize referrer token account, will retry after fetching account info:', error)
        // Use fees wallet as fallback
        this.referrerTokenAccount = this.feesTokenAccount
      }

      this.initialized = true
    } catch (error) {
      console.error('Failed to initialize token accounts:', error)
    }
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initializeTokenAccounts()
    }
  }

  // Lock mechanism to prevent concurrent operations
  async acquireLock() {
    return new Promise((resolve) => {
      if (!this.operationLock) {
        this.operationLock = true
        resolve()
      } else {
        this.lockQueue.push(resolve)
      }
    })
  }

  releaseLock() {
    this.operationLock = false
    if (this.lockQueue.length > 0) {
      const nextResolve = this.lockQueue.shift()
      this.operationLock = true
      nextResolve()
    }
  }

  // Wrapper for locked operations
  async withLock(operation) {
    await this.acquireLock()
    try {
      return await operation()
    } finally {
      this.releaseLock()
    }
  }

  getPublicKey() {
    return this.wallet.publicKey.toBase58()
  }

  // Get latest blockhash
  async getLatestBlockhash() {
    return await this.connection.getLatestBlockhash()
  }

  // Send transaction
  async sendTransaction(transaction) {
    try {
      console.log('Sending transaction...')
      
      // First try to simulate the transaction
      const simulationResult = await this.connection.simulateTransaction(transaction)
      console.log('Transaction simulation result:', simulationResult)
      
      if (simulationResult.value.err) {
        console.error('Transaction simulation failed:', simulationResult.value.err)
        throw new Error(`Transaction simulation failed: ${JSON.stringify(simulationResult.value.err)}`)
      }
      
      // If simulation passed, send the transaction
      const signature = await this.connection.sendTransaction(transaction, [this.wallet], {
        skipPreflight: false,
        preflightCommitment: 'processed',
        maxRetries: 3
      })
      
      console.log('Transaction sent successfully:', signature)
      return signature
    } catch (error) {
      console.error('Failed to send transaction:', error)
      
      // Parse and format error messages
      let errorMessage = error.message
      
      if (error.message.includes('0xbc4')) {
        errorMessage = 'Insufficient resources or wrong timing for this operation'
      } else if (error.message.includes('0x1')) {
        errorMessage = 'Insufficient funds for this operation'
      } else if (error.message.includes('custom program error')) {
        const match = error.message.match(/custom program error: (0x[0-9a-f]+)/i)
        if (match) {
          const errorCode = parseInt(match[1], 16)
          errorMessage = `Program error ${errorCode}: ${this.getErrorDescription(errorCode)}`
        }
      }
      
      throw new Error(errorMessage)
    }
  }
  
  // Get error description for common error codes
  getErrorDescription(errorCode) {
    const errorDescriptions = {
      0xbc4: 'Game-specific error: Check if you have enough berries, account is properly initialized, and timing is correct',
      0x1: 'Insufficient funds',
      0x2: 'Invalid account',
      0x3: 'Invalid instruction',
      0x4: 'Account not found',
      0x5: 'Account already exists',
      0x6: 'Invalid signature',
      0x7: 'Invalid program',
      0x8: 'Invalid transaction',
      0x9: 'Invalid fee',
      0xa: 'Invalid nonce',
      0xb: 'Invalid account owner',
      0xc: 'Invalid program account',
      0xd: 'Invalid system program',
      0xe: 'Invalid token program',
      0xf: 'Invalid mint',
      0x10: 'Invalid token account',
      0x11: 'Invalid token amount',
      0x12: 'Invalid token owner',
      0x13: 'Invalid token delegate',
      0x14: 'Invalid token supply',
      0x15: 'Invalid token decimals',
      // Game-specific errors
      0xbc4: 'Game error: May need to wait for cooldown, have insufficient berries, or wrong game state',
      0x1771: 'Invalid game state',
      0x1772: 'Insufficient berries',
      0x1773: 'Account not initialized',
      0x1774: 'Invalid card',
      0x1775: 'Card already staked',
      0x1776: 'Card not owned',
      0x1777: 'Invalid farm type',
      0x1778: 'Farm capacity exceeded',
      0x1779: 'Invalid operation timing'
    }
    
    return errorDescriptions[errorCode] || `Unknown error code: ${errorCode}. This might be a game-specific error - check account state and requirements.`
  }

  // Wait for confirmation
  async waitForConfirmation(signature, maxRetries = 30) {
    await new Promise(resolve => setTimeout(resolve, 1000))

    for (let i = 0; i < maxRetries; i++) {
      try {
        const status = await this.connection.getSignatureStatus(signature)
        if (status.value && status.value.confirmationStatus === 'finalized') {
          return true
        }
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        console.error('Error checking transaction status:', error)
      }
    }

    return false
  }

  // Build and send transaction
  async buildAndSendTransaction(instructions) {
    const { blockhash } = await this.getLatestBlockhash()

    const transaction = new Transaction()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = this.wallet.publicKey

    // Add all instructions
    for (const instruction of instructions) {
      transaction.add(new TransactionInstruction({
        keys: instruction.keys,
        programId: instruction.programId,
        data: instruction.data,
      }))
    }

    // Sign transaction
    transaction.sign(this.wallet)

    // Send transaction
    const signature = await this.sendTransaction(transaction)
    console.log('Transaction sent:', signature)

    // Wait for confirmation
    const confirmed = await this.waitForConfirmation(signature)
    if (confirmed) {
      console.log('Transaction confirmed!')
      return signature
    } else {
      console.log('Transaction confirmation timeout')
      return null
    }
  }

  // Create purchase initial farm instruction
  async createPurchaseInitialFarmInstruction() {
    const accounts = [
      {
        pubkey: this.wallet.publicKey,
        isSigner: true,
        isWritable: true
      },
      {
        pubkey: this.playerPDA,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: this.globalState,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: this.feesWallet,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: this.referrerWallet,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: this.tokenMint,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: this.playerTokenAccount,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false
      },
      {
        pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false
      },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false
      },
      {
        pubkey: SYSVAR_RENT_PUBKEY,
        isSigner: false,
        isWritable: false
      }
    ]

    const instructionData = Buffer.from(bs58.decode('g1kRhvHV4V2'))

    return {
      programId: this.programId,
      data: instructionData,
      keys: accounts
    }
  }

  // Create stake card instruction
  async createStakeCardInstruction(cardIndex) {
    const accounts = [
      {
        pubkey: this.wallet.publicKey,
        isSigner: true,
        isWritable: true
      },
      {
        pubkey: this.playerPDA,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: this.globalState,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: this.rewardsVault,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: this.tokenMint,
        isSigner: false,
        isWritable: false
      },
      {
        pubkey: this.playerTokenAccount,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false
      }
    ]

    const instructionIdentifier = Buffer.from('616fabbab3c644ac', 'hex')
    const cardIndexByte = Buffer.from([cardIndex])
    const instructionData = Buffer.concat([instructionIdentifier, cardIndexByte])

    return {
      programId: this.programId,
      data: instructionData,
      keys: accounts
    }
  }

  // Initialize game account transaction
  async initGameAccountTransaction() {
    return await this.withLock(async () => {
      await this.ensureInitialized()

      // Step 1: Purchase initial farm
      const computeBudgetInstructions1 = createComputeBudgetInstructions()
      computeBudgetInstructions1.push(await this.createPurchaseInitialFarmInstruction())
      await this.buildAndSendTransaction(computeBudgetInstructions1)

      // Step 2: Stake card 0
      const computeBudgetInstructions2 = createComputeBudgetInstructions()
      computeBudgetInstructions2.push(await this.createStakeCardInstruction(0))
      await this.buildAndSendTransaction(computeBudgetInstructions2)

      // Step 3: Stake card 1
      const computeBudgetInstructions3 = createComputeBudgetInstructions()
      computeBudgetInstructions3.push(await this.createStakeCardInstruction(1))
      await this.buildAndSendTransaction(computeBudgetInstructions3)
    })
  }

  // Create open booster commit instruction
  async createOpenBoosterCommitInstruction() {
    await this.ensureInitialized()
    
    console.log('Creating open booster commit instruction with accounts:', {
      wallet: this.wallet.publicKey.toBase58(),
      playerPDA: this.playerPDA.toBase58(),
      globalState: this.globalState.toBase58(),
      rewardsVault: this.rewardsVault.toBase58(),
      playerTokenAccount: this.playerTokenAccount.toBase58(),
      feesTokenAccount: this.feesTokenAccount.toBase58(),
      referrerTokenAccount: this.referrerTokenAccount.toBase58(),
      tokenMint: this.tokenMint.toBase58()
    })
    
    const accounts = [
      {
        pubkey: this.wallet.publicKey,
        isSigner: true,
        isWritable: true
      },
      {
        pubkey: this.playerPDA,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: this.globalState,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: this.rewardsVault,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: this.playerTokenAccount,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: this.feesTokenAccount,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: this.referrerTokenAccount,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: this.tokenMint,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false
      }
    ]

    const instructionData = Buffer.from('07fc87dff2ecf25d', 'hex')

    return {
      programId: this.programId,
      data: instructionData,
      keys: accounts
    }
  }
  // Check if account can open booster
  async canOpenBooster() {
    try {
      const accountInfo = await this.getUserAccountInfo()
      
      if (!accountInfo) {
        throw new Error('Account not initialized. Please initialize your account first.')
      }
      
      // Check token balance (not berries!)
      const tokenBalance = await this.getTokenBalance()
      const minimumTokens = BigInt(100000) // 0.1 token needed (considering 6 decimals)
      
      console.log('Checking token balance for booster:', {
        tokenBalance: tokenBalance.toString(),
        minimumTokens: minimumTokens.toString(),
        hasEnoughTokens: tokenBalance >= minimumTokens,
        tokenMint: this.tokenMint.toBase58()
      })
      
      if (tokenBalance < minimumTokens) {
        const tokenAmount = Number(tokenBalance) / 1000000 // Convert to readable format
        const minAmount = Number(minimumTokens) / 1000000
        throw new Error(`Insufficient token balance. Need at least ${minAmount} tokens, but have ${tokenAmount}`)
      }
      
      // Check if account has space for new cards
      const currentCards = accountInfo.cards.length
      const maxCards = 128 // Maximum cards per account
      
      if (currentCards >= maxCards) {
        throw new Error(`Account is full. Maximum ${maxCards} cards allowed.`)
      }
      
      // Check if account has a farm (required for opening boosters)
      if (!accountInfo.farm) {
        throw new Error('No farm found. Please initialize your farm first.')
      }
      
      console.log('Booster check passed:', {
        tokenBalance: tokenBalance.toString(),
        tokenBalanceReadable: (Number(tokenBalance) / 1000000).toFixed(6),
        currentCards,
        maxCards,
        farmType: accountInfo.farm.farm_type,
        berries: accountInfo.berries
      })
      
      return true
    } catch (error) {
      console.error('Booster check failed:', error)
      throw error
    }
  }
  
  async openBooster() {
    return await this.withLock(async () => {
      // Check if opening booster is allowed
      await this.canOpenBooster()
      
      console.log('Starting booster opening process...')
      
      // Step 1: Execute open booster commit
      console.log('Step 1: Executing open booster commit...')
      await this.executeOpenBoosterCommit()
      
      // Wait a bit between steps
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Step 2: Execute settle open booster
      console.log('Step 2: Executing settle open booster...')
      await this.executeSettleOpenBooster()
      
      console.log('Booster opened successfully!')
    })
  }
  // Execute open booster commit
  // private
  async executeOpenBoosterCommit() {
    await this.ensureInitialized()
    const computeBudgetInstructions = createComputeBudgetInstructions()
    const openBoosterCommitInstruction = await this.createOpenBoosterCommitInstruction()
    computeBudgetInstructions.push(openBoosterCommitInstruction)
    return await this.buildAndSendTransaction(computeBudgetInstructions)
  }

  // Create settle open booster instruction
  async createSettleOpenBoosterInstruction() {
    const accounts = [
      {
        pubkey: this.wallet.publicKey,
        isSigner: true,
        isWritable: true
      },
      {
        pubkey: this.playerPDA,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: this.globalState,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: this.rewardsVault,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: this.tokenMint,
        isSigner: false,
        isWritable: false
      },
      {
        pubkey: SYSVAR_SLOT_HASHES_PUBKEY,
        isSigner: false,
        isWritable: false
      }
    ]

    const instructionData = Buffer.from('e490c7385edf09e2', 'hex')

    return {
      programId: this.programId,
      data: instructionData,
      keys: accounts
    }
  }

  // Execute settle open booster
  // private
  async executeSettleOpenBooster() {
    await this.ensureInitialized()
    const computeBudgetInstructions = createComputeBudgetInstructions()
    const settleOpenBoosterInstruction = await this.createSettleOpenBoosterInstruction()
    computeBudgetInstructions.push(settleOpenBoosterInstruction)
    return await this.buildAndSendTransaction(computeBudgetInstructions)
  }

  // Execute claim reward
  async executeClaimReward() {
    return await this.withLock(async () => {
      await this.ensureInitialized()
      const instructions = createComputeBudgetInstructions()

      // Claim reward instruction
      const claimRewardInstruction = new TransactionInstruction({
        keys: [
          { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: this.playerPDA, isSigner: false, isWritable: true },
          { pubkey: this.globalState, isSigner: false, isWritable: true },
          { pubkey: this.rewardsVault, isSigner: false, isWritable: true },
          { pubkey: this.playerTokenAccount, isSigner: false, isWritable: true },
          { pubkey: this.tokenMint, isSigner: false, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
        ],
        programId: this.programId,
        data: Buffer.from('0490844774179750', 'hex')
      })
      instructions.push(claimRewardInstruction)

      await this.buildAndSendTransaction(instructions)

      // Check token balance
      const tokenBalance = await this.getTokenBalance()
      if (tokenBalance <= 0) {
        return false
      }

      // Transfer all tokens to recipient
      const secondStepInstructions = createComputeBudgetInstructions()
      const recipientAccountExists = await this.checkAccountExists(this.recipientTokenAccount)

      if (!recipientAccountExists) {
        console.log('Warning: Recipient token account does not exist, skipping transfer')
        return false
      }

      const transferCheckedInstruction = createTransferCheckedInstruction(
        this.playerTokenAccount,
        this.tokenMint,
        this.recipientTokenAccount,
        this.wallet.publicKey,
        tokenBalance,
        await this.getTokenDecimals(),
        [],
        TOKEN_PROGRAM_ID
      )
      secondStepInstructions.push(transferCheckedInstruction)

      return await this.buildAndSendTransaction(secondStepInstructions)
    })
  }

  // Get token balance
  async getTokenBalance() {
    try {
      const accountInfo = await this.connection.getTokenAccountBalance(this.playerTokenAccount)
      return BigInt(accountInfo.value.amount)
    } catch (error) {
      console.error('Failed to get token balance:', error)
      return BigInt(0)
    }
  }

  // Get token decimals
  async getTokenDecimals() {
    return 6
  }

  // Check if account exists
  async checkAccountExists(publicKey) {
    try {
      const accountInfo = await this.connection.getAccountInfo(publicKey)
      return accountInfo !== null
    } catch (error) {
      console.error('Failed to check account existence:', error)
      return false
    }
  }

  // Get user account info including cards and all player data
  async getUserAccountInfo() {
    console.log('Getting user account info for:', this.wallet.publicKey.toBase58())
    
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('RPC request timeout')), 15000)
      })
      
      const accountInfoPromise = this.connection.getAccountInfo(this.playerPDA)
      
      const accountInfo = await Promise.race([accountInfoPromise, timeoutPromise])
      
      console.log('Account info response:', accountInfo ? 'Account found' : 'Account not found')
      
      if (!accountInfo) {
        console.log('Account not initialized')
        return null
      }

      console.log('Decoding account data...')
      const decoder = new AccountDecoder(this.connection)
      const playerData = await decoder.decodePlayerData(accountInfo.data)
      console.log('Player data decoded:', playerData)

      // Update referrer wallet if we have one from the account data
      if (playerData.referrer) {
        console.log('Updating referrer wallet to:', playerData.referrer)
        this.referrerWallet = new PublicKey(playerData.referrer)
        // Reinitialize referrer token account with the new referrer
        try {
          this.referrerTokenAccount = await getAssociatedTokenAddress(
            this.tokenMint,
            this.referrerWallet
          )
        } catch (error) {
          console.warn('Failed to update referrer token account:', error)
        }
      }

      // Add staking status to cards based on bitset
      const stakedCardsBitset = BigInt(playerData.staked_cards_bitset)
      const cardsWithStakeStatus = playerData.cards.map((card, index) => {
        if (card.id === 0) return card // Skip empty cards

        // Check if this card position is staked using bitwise operation
        const isStaked = (stakedCardsBitset & (1n << BigInt(index))) !== 0n

        return {
          ...card,
          isStaked: isStaked
        }
      }).filter(card => card.id !== 0) // Filter out empty cards

      console.log('Cards with stake status:', cardsWithStakeStatus.length)

      // Return full player data with cards including stake status
      return {
        initialized: true,
        owner: playerData.owner,
        farm: playerData.farm,
        cards: cardsWithStakeStatus,
        cardCount: playerData.card_count,
        stakedCardsBitset: playerData.staked_cards_bitset,
        berries: playerData.berries,
        totalHashpower: playerData.total_hashpower,
        referrer: playerData.referrer
      }
    } catch (error) {
      console.error('Failed to get user account info:', error)
      
      // More specific error handling
      if (error.message.includes('timeout')) {
        throw new Error('Network timeout - please check your connection')
      } else if (error.message.includes('Invalid')) {
        throw new Error('Invalid account configuration')
      } else {
        throw new Error(`Failed to fetch account: ${error.message}`)
      }
    }
  }

  // Create recycle cards commit instruction
  async createRecycleCardsCommitInstruction(cardIndices) {
    const accounts = [
      {
        pubkey: this.wallet.publicKey,
        isSigner: true,
        isWritable: true
      },
      {
        pubkey: this.playerPDA,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: this.globalState,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: this.rewardsVault,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: this.tokenMint,
        isSigner: false,
        isWritable: false
      }
    ]

    // Build instruction data
    const part1 = Buffer.from('c7d160c7cd3942ef', 'hex')
    const arrayLength = cardIndices.length
    const part2 = Buffer.from([arrayLength])
    const padding = Buffer.alloc(3, 0)
    const part3 = Buffer.alloc(cardIndices.length)

    cardIndices.forEach((cardIndex, i) => {
      part3.writeUInt8(cardIndex, i)
    })

    const instructionData = Buffer.concat([part1, part2, padding, part3])

    return {
      programId: this.programId,
      data: instructionData,
      keys: accounts
    }
  }

  // Create recycle cards settle instruction
  async createRecycleCardsSettleInstruction() {
    const accounts = [
      {
        pubkey: this.wallet.publicKey,
        isSigner: true,
        isWritable: true
      },
      {
        pubkey: this.playerPDA,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: this.globalState,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: this.rewardsVault,
        isSigner: false,
        isWritable: true
      },
      {
        pubkey: this.tokenMint,
        isSigner: false,
        isWritable: false
      },
      {
        pubkey: SYSVAR_SLOT_HASHES_PUBKEY,
        isSigner: false,
        isWritable: false
      }
    ]

    const instructionData = Buffer.from('2bbb21f9b8e17f8f', 'hex')

    return {
      programId: this.programId,
      data: instructionData,
      keys: accounts
    }
  }

  // Stake card
  async stakeCard(cardIndex) {
    return await this.withLock(async () => {
      await this.ensureInitialized()
      const computeBudgetInstructions = createComputeBudgetInstructions()
      const stakeCardInstruction = await this.createStakeCardInstruction(cardIndex)
      computeBudgetInstructions.push(stakeCardInstruction)
      return await this.buildAndSendTransaction(computeBudgetInstructions)
    })
  }

  // Transfer all tokens to recipient account
  async transferAllTokensToRecipient() {
    return await this.withLock(async () => {
      try {
        await this.ensureInitialized()
        
        console.log('Starting token transfer to recipient...')
        
        // Check current token balance
        const tokenBalance = await this.getTokenBalance()
        console.log('Current token balance:', tokenBalance.toString())
        
        if (tokenBalance <= 0) {
          console.log('No tokens to transfer')
          return false
        }
        
        // Check if recipient account exists
        const recipientExists = await this.checkAccountExists(this.recipientTokenAccount)
        if (!recipientExists) {
          console.log('Warning: Recipient token account does not exist')
          throw new Error('Recipient token account does not exist')
        }
        
        // Create transfer instruction
        const transferInstructions = createComputeBudgetInstructions()
        
        const transferCheckedInstruction = createTransferCheckedInstruction(
          this.playerTokenAccount,     // from
          this.tokenMint,              // mint
          this.recipientTokenAccount,  // to
          this.wallet.publicKey,       // owner
          tokenBalance,                // amount
          await this.getTokenDecimals(), // decimals
          [],                          // signers
          TOKEN_PROGRAM_ID
        )
        
        transferInstructions.push(transferCheckedInstruction)
        
        console.log('Executing token transfer transaction...')
        const result = await this.buildAndSendTransaction(transferInstructions)
        
        if (result) {
          console.log('Token transfer successful:', result)
          return true
        } else {
          console.log('Token transfer failed')
          return false
        }
        
      } catch (error) {
        console.error('Token transfer error:', error)
        throw error
      }
    })
  }

  // Recycle card
  async recycleCard(cardIndex) {
    return await this.withLock(async () => {
      await this.ensureInitialized()

      // Step 1: Recycle cards commit
      const computeBudgetInstructions1 = createComputeBudgetInstructions()
      const recycleCommitInstruction = await this.createRecycleCardsCommitInstruction([cardIndex])
      computeBudgetInstructions1.push(recycleCommitInstruction)
      await this.buildAndSendTransaction(computeBudgetInstructions1)

      // Wait
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Step 2: Recycle cards settle
      const computeBudgetInstructions2 = createComputeBudgetInstructions()
      const recycleSettleInstruction = await this.createRecycleCardsSettleInstruction()
      computeBudgetInstructions2.push(recycleSettleInstruction)
      return await this.buildAndSendTransaction(computeBudgetInstructions2)
    })
  }
}