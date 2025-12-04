// main4.js
const Blockchain = require("./blockchain")
const Transaction = require("./transaction")
const EC = require("elliptic").ec

const ec = new EC("secp256k1")

const walletKey = ec.keyFromPrivate(
    "153dc82883a481f161f2a40073d996bb12ca180f5f8ffc6262e44fb7164ca770"
)
const walletAddress = walletKey.getPublic("hex")

const courseChain = new Blockchain()

const tx1 = new Transaction(walletAddress, "address2", 100)
tx1.signTransaction(walletKey)
courseChain.addTransaction(tx1)
courseChain.minePendingTransactions(walletAddress)

const tx2 = new Transaction(walletAddress, "address3", 20)
tx2.signTransaction(walletKey)
courseChain.addTransaction(tx2)
courseChain.minePendingTransactions(walletAddress)

console.log(`\nBalance of the demo wallet is: ${courseChain.getBalanceOfAddress(walletAddress)}\n`)

console.log("Is chain valid?", courseChain.isChainValid())
