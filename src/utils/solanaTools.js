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
    // Skip discriminator (first 8 bytes) and go to cards section
    // Player structure: discriminator(8) + owner(32) + farm(10) + cards(128*6)
    const discriminatorLength = 8
    const ownerLength = 32
    const farmLength = 10
    const dataWithoutDiscriminator = accountData.slice(discriminatorLength)

    // Skip to cards section (offset 42: 32 bytes owner + 10 bytes farm)
    let currentOffset = ownerLength + farmLength

    // Decode 128 cards
    const cards = []
    for (let i = 0; i < 128; i++) {
      const card = this.decodeCard(dataWithoutDiscriminator, currentOffset)
      cards.push(card.value)
      currentOffset = card.nextOffset
    }

    return cards
  }
}

export class SolanaWalletTools {
  constructor(privateKey, config) {
    this.config = config
    this.connection = new Connection(config.rpcUrl, 'confirmed')

    // Create wallet from private key
    try {
      const secretKey = bs58.decode(privateKey)
      this.wallet = Keypair.fromSecretKey(secretKey)
    } catch (error) {
      throw new Error('Invalid private key')
    }

    // Initialize addresses
    this.programId = new PublicKey(config.programId)
    this.tokenMint = new PublicKey(config.tokenMint)
    this.referrerWallet = new PublicKey(config.referrerWallet)
    this.feesWallet = new PublicKey(config.feesWallet)
    this.recipientAccount = new PublicKey(config.recipientAccount)

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
      this.referrerTokenAccount = await getAssociatedTokenAddress(
        this.tokenMint,
        this.referrerWallet
      )
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

  getPublicKey() {
    return this.wallet.publicKey.toBase58()
  }

  // Get latest blockhash
  async getLatestBlockhash() {
    return await this.connection.getLatestBlockhash()
  }

  // Send transaction
  async sendTransaction(transaction) {
    const signature = await this.connection.sendTransaction(transaction, [this.wallet], {
      skipPreflight: false,
      preflightCommitment: 'processed',
    })
    return signature
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
  }

  // Create open booster commit instruction
  async createOpenBoosterCommitInstruction() {
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

  // Execute open booster commit
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
  async executeSettleOpenBooster() {
    await this.ensureInitialized()
    const computeBudgetInstructions = createComputeBudgetInstructions()
    const settleOpenBoosterInstruction = await this.createSettleOpenBoosterInstruction()
    computeBudgetInstructions.push(settleOpenBoosterInstruction)
    return await this.buildAndSendTransaction(computeBudgetInstructions)
  }

  // Execute claim reward
  async executeClaimReward() {
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

  // Get user cards
  async getUserCards() {
    try {
      const accountInfo = await this.connection.getAccountInfo(this.playerPDA)
      if (!accountInfo) {
        throw new Error('Player account not found')
      }

      const decoder = new AccountDecoder(this.connection)
      const cards = await decoder.decodePlayerData(accountInfo.data)
      return cards
    } catch (error) {
      console.error('Failed to get user cards:', error)
      // Return empty array if there's an error instead of throwing
      return []
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

  // Recycle card
  async recycleCard(cardIndex) {
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
  }
}