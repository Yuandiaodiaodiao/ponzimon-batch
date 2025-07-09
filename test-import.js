// 测试私钥导入功能
import { Keypair } from '@solana/web3.js'
import bs58 from 'bs58'

// 生成一个测试私钥
const testKeypair = Keypair.generate()
const testPrivateKey = bs58.encode(testKeypair.secretKey)
const testPublicKey = testKeypair.publicKey.toBase58()

console.log('=== 测试私钥导入功能 ===')
console.log('测试私钥:', testPrivateKey)
console.log('对应公钥:', testPublicKey)
console.log('')
console.log('使用步骤:')
console.log('1. 启动开发服务器 (npm run dev)')
console.log('2. 打开浏览器访问 http://localhost:5174/')
console.log('3. 点击 "Import" 按钮')
console.log('4. 在对话框中输入上面的测试私钥')
console.log('5. 点击 "导入钱包" 按钮')
console.log('6. 检查是否成功导入并显示对应的公钥')