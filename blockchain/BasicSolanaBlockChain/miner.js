const Block = require("./block")
const Transaction = require("./transaction")
const TransactionProcessor = require("./transactionProcessor")

class Miner {
    constructor(wallet, coinbaseReward, blockchain) {
        this.wallet = wallet
        this.id = wallet.publicKey
        this.processor = new TransactionProcessor({ coinbaseReward })
        this.coinbaseReward = coinbaseReward
        this.blockchain = blockchain
    }

    mineBlock(transactionsBatch) {
        if (!this.blockchain) {
            throw new Error("Miner requires blockchain instance to build blocks")
        }

        const networkSeedHash = this.blockchain.getNetworkHash()
        const latestBlock = this.blockchain.getLatestBlock()
        const previousHash = latestBlock ? latestBlock.hash : ""

        const { block, totalTips } =
            this.buildBlock(
                transactionsBatch,
                this.blockchain.balancesState,
                this.blockchain.ledger,
                networkSeedHash,
                previousHash
            )

        this.blockchain.addBlock(block)
        return { block, totalTips }
    }

    buildBlock(rawTransactions, balancesState, ledger, networkSeedHash, previousBlockHash) {
        const { transactions, totalTips } =
            this.processor.processTransactions(
                rawTransactions,
                this.id,
                balancesState,
                ledger
            )

        const block = new Block(
            transactions,
            previousBlockHash,
            this.id
        )

        block.hash = block.computeHash(networkSeedHash)

        return { block, totalTips }
    }
}

module.exports = Miner
