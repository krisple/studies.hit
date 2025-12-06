const BalancesState = require("./balancesState")
const Ledger = require("./ledger")

class Blockchain {
    constructor(config) {
        this.config = config
        this.blocks = []
        this.networkHash = config.initialNetworkHash || "42"
        this.balancesState = new BalancesState(config.wallets, config.initialBalance)
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
        const previousBlock = this.getLatestBlock()
        if (!block.isValid(this.networkHash, previousBlock)) {
            throw new Error("Attempted to add invalid block to blockchain")
        }
        this.blocks.push(block)
        this.networkHash = block.hash
    }

    GetTransactionProof(targetTransaction) {
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

    isValid(initialNetworkHash) {
        const seed0 = initialNetworkHash || this.config.initialNetworkHash || "42"
        let seed = seed0
        let previousHash = ""

        for (let i = 0; i < this.blocks.length; i++) {
            const block = this.blocks[i]
            if (!block.hasValidateTransaction()) {
                console.log(`Invalid transactions at block index ${i}`)
                return false
            }
            const recomputed = block.computeHash(seed)
            const expectedPrev = i === 0 ? "" : this.blocks[i - 1].hash
            if (block.previousHash !== expectedPrev) {
                console.log(`Invalid previousHash at block index ${i}`)
                return false
            }
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
