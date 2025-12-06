const BalancesState = require("./balancesState")
const Ledger = require("./ledger")

class Blockchain {
    constructor(config) {
        this.config = null
        this.blocks = []
        this.networkHash = ""
        this.balancesState = null
        this.ledger = null

        this.config = config

        this.blocks = []
        this.networkHash = config.initialNetworkHash || "42"

        this.balancesState = new BalancesState(
            config.wallets,
            config.initialBalance
        )

        const initialTotalCoins = config.initialBalance * config.wallets.length
        this.ledger = new Ledger(initialTotalCoins)
    }

    getLatestBlock() {
        if (this.blocks.length === 0) return null
        return this.blocks[this.blocks.length - 1]
    }

    getNetworkHash() {
        return this.networkHash
    }

    addBlock(block) {
        this.blocks.push(block)
        this.networkHash = block.hash
    }

    findTransactionProof(targetTransaction) {
        if (!targetTransaction || typeof targetTransaction.calculateHash !== "function") {
            return null
        }
        const targetHash = targetTransaction.calculateHash()

        for (let i = 0; i < this.blocks.length; i++) {
            const block = this.blocks[i]
            if (!block.bloom || !block.merkle) continue
            if (!block.bloom.mightContain(targetTransaction)) continue

            const match = block.findTransactionByHash(targetHash)
            if (!match) continue

            const proof = block.getMerkleProof(match.transaction)
            const valid = block.verifyProofForHash(targetHash, proof, block.merkleRoot)
            if (!valid) continue

            return {
                blockIndex: i + 1, // 1-based for readability
                blockHash: block.hash,
                merkleRoot: block.merkleRoot,
                transactionHash: targetHash,
                proof
            }
        }

        return null
    }

    buildFromRawTransactions(rawTransactions, minersMap, scheduler) {
        const maxUserTransactionsPerBlock = this.config.transactionsPerBlockNoCoinbase
        let transactionIndex = 0
        let blockIndex = 1

        while (transactionIndex < rawTransactions.length) {
            const minerId = scheduler.getMinerIdForBlock(blockIndex)
            const miner = minersMap[minerId]
            if (!miner) {
                throw new Error(`No miner instance for id ${minerId}`)
            }

            console.log(`\n=== Building block #${blockIndex}, miner: ${minerId} ===`)

            const networkSeedHash = this.getNetworkHash()
            const latestBlock = this.getLatestBlock()
            const previousHash = latestBlock ? latestBlock.hash : ""

            const { block, skippedCount, nextIndex } =
                miner.buildBlock(
                    rawTransactions,
                    transactionIndex,
                    maxUserTransactionsPerBlock,
                    this.balancesState,
                    this.ledger,
                    networkSeedHash,
                    previousHash
                )

            console.log(
                `Block #${blockIndex} built with ${block.transactions.length} transactions ` +
                `(including coinbase). Skipped: ${skippedCount}`
            )

            this.addBlock(block)
            transactionIndex = nextIndex
            blockIndex += 1
        }
    }

    isValid(initialNetworkHash) {
        const seed0 = initialNetworkHash || this.config.initialNetworkHash || "42"
        let seed = seed0
        let previousHash = ""

        for (let i = 0; i < this.blocks.length; i++) {
            const block = this.blocks[i]

            if (i === 0) {
                if (block.previousHash !== previousHash) {
                    console.log(`Invalid previousHash at genesis block`)
                    return false
                }
            } else {
                if (block.previousHash !== previousHash) {
                    console.log(`Invalid previousHash at block index ${i}`)
                    return false
                }
            }

            const recomputed = block.computeHash(seed)
            if (recomputed !== block.hash) {
                console.log(`Invalid hash at block index ${i}`)
                return false
            }

            seed = block.hash
            previousHash = block.hash
        }

        return true
    }

    printSummary() {
        const balances = this.balancesState.getAllBalances()
        this.ledger.printSummary(balances)
    }
}

module.exports = Blockchain
