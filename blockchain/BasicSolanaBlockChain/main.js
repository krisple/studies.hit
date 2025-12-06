const fs = require("fs")
const path = require("path")

const Miner = require("./miner")
const MinerScheduler = require("./minerScheduler")
const Blockchain = require("./blockchain")
const Transaction = require("./transaction")
const Wallet = require("./wallet")

function loadRawTransactions() {
    const filePath = path.join(__dirname, "Solanatransactions.json")
    const raw = fs.readFileSync(filePath, "utf8")
    const data = JSON.parse(raw)

    console.log(`Loaded ${data.length} raw transactions from JSON`)
    return data
}

function buildSignedTransactions(rawTransactions, walletMap, baseFee, tipFee) {
    return rawTransactions.map((raw, index) => {
        const fromWallet = raw.from ? walletMap[raw.from] : null
        const toWallet = raw.to ? walletMap[raw.to] : null
        const fromAddress = fromWallet ? fromWallet.publicKey : null
        const toAddress = toWallet ? toWallet.publicKey : null

        const transaction = new Transaction(
            fromAddress,
            toAddress,
            raw.amount,
            index,
            baseFee,
            tipFee
        )

        if (fromWallet) {
            try {
                transaction.signTransaction(fromWallet.keyPair)
            } catch (err) {
                console.log(`Failed to sign transaction from ${raw.from}: ${err.message}`)
            }
        }

        return transaction
    })
}

function mineAllTransactions(blockchain, miners, scheduler, transactions, maxUserTransactionsPerBlock) {
    let transactionIndex = 0
    let blockIndex = 1

    while (transactionIndex < transactions.length) {
        const minerId = scheduler.getMinerIdForBlock(blockIndex)
        const miner = miners[minerId]
        if (!miner) {
            throw new Error(`No miner instance for id ${minerId}`)
        }

        console.log(`\n=== Building block #${blockIndex}, miner: ${minerId} ===`)

        const { block, skippedCount, nextIndex } = miner.mineBlock(
            transactions,
            transactionIndex,
            maxUserTransactionsPerBlock
        )

        console.log(
            `Block #${blockIndex} built with ${block.transactions.length} transactions ` +
            `(including coinbase). Skipped: ${skippedCount}`
        )

        transactionIndex = nextIndex
        blockIndex += 1
    }
}

function main() {
    const walletIds = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
    const wallets = walletIds.map((id) => new Wallet(id))
    const walletMap = Object.fromEntries(wallets.map((w) => [w.name, w]))
    const minerIds = ["A", "B", "C", "D", "E"]

    const config = {
        initialBalance: 100,
        wallets: wallets.map((w) => w.publicKey),
        minerIds: minerIds.map((id) => walletMap[id].publicKey),
        transactionsPerBlockNoCoinbase: 49,
        baseFee: 2,
        tipFee: 3,
        coinbaseReward: 60,
        initialNetworkHash: "42"
    }

    const blockchain = new Blockchain(config)

    const miners = {}
    for (const name of minerIds) {
        const wallet = walletMap[name]
        const minerId = wallet.publicKey
        miners[minerId] = new Miner(
            wallet,
            config.coinbaseReward,
            blockchain
        )
    }

    const scheduler = new MinerScheduler(config.minerIds)

    const rawTransactions = loadRawTransactions()
    const transactions = buildSignedTransactions(
        rawTransactions,
        walletMap,
        config.baseFee,
        config.tipFee
    )

    mineAllTransactions(blockchain, miners, scheduler, transactions, config.transactionsPerBlockNoCoinbase)

    blockchain.printSummary()

    demoProofSearch(blockchain)

    console.log("\n===== BLOCKCHAIN VALIDATION =====")
    const isValid = blockchain.isValid(config.initialNetworkHash)
    console.log("Is chain valid?", isValid)
}

function pickRandomTransaction(blockchain) {
    const all = []
    for (const block of blockchain.blocks) {
        for (const transaction of block.transactions) {
            if (transaction.fromAddress === null) continue // skip coinbase
            all.push(transaction)
        }
    }
    if (!all.length) return null
    const idx = Math.floor(Math.random() * all.length)
    return all[idx]
}

function demoProofSearch(blockchain) {
    const targetTransaction = pickRandomTransaction(blockchain)
    if (!targetTransaction) {
        console.log("No transactions available for proof demo")
        return
    }

    console.log("\n===== TRANSACTION PROOF DEMO =====")
    console.log(
        `Looking for transaction: ${targetTransaction.fromAddress} -> ${targetTransaction.toAddress} amount ${targetTransaction.amount}`
    )

    const proofObj = blockchain.GetTransactionProof(targetTransaction)
    if (!proofObj) {
        console.log("Proof not found via bloom + merkle search")
        return
    }

    const { blockIndex, merkleRoot, transactionHash, proof } = proofObj
    const valid = blockchain.blocks[blockIndex - 1].verifyProofForHash(
        transactionHash,
        proof,
        merkleRoot
    )

    console.log(
        `Found in block #${blockIndex}, merkleRoot=${merkleRoot}, proof valid?`,
        valid
    )
}

main()
