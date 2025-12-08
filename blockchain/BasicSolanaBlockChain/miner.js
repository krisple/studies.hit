const Block = require("./block")
const TransactionProcessor = require("./transactionProcessor")

class Miner {
    constructor(wallet, coinbaseReward, blockchain) {
        this.wallet = wallet
        this.id = wallet.publicKey
        this.processor = new TransactionProcessor(coinbaseReward)
        this.blockchain = blockchain
    }

    mineBlock(rawTransactions, startIndex, maxUserTransactionsPerBlock) {
        if (!this.blockchain) {
            throw new Error("Miner requires blockchain instance to build blocks")
        }

        const networkSeedHash = this.blockchain.getNetworkHash()
        const latestBlock = this.blockchain.getLatestBlock()
        const previousHash = latestBlock ? latestBlock.hash : ""

        const { block, nextIndex } =
            this.buildBlock(
                rawTransactions,
                startIndex,
                maxUserTransactionsPerBlock,
                this.blockchain.balancesState,
                this.blockchain.ledger,
                networkSeedHash,
                previousHash
            )

        this.blockchain.addBlock(block)
        return { block, nextIndex }
    }

    buildBlock(rawTransactions, startIndex, maxUserTransactionsPerBlock, balancesState, ledger, networkSeedHash, previousBlockHash) {
        const { transactions, nextIndex } =
            this.processor.processBatchOfRawTransactions(
                rawTransactions,
                startIndex,
                maxUserTransactionsPerBlock,
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

        return { block, nextIndex }
    }
}

module.exports = Miner
