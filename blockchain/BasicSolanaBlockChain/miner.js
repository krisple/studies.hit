const Block = require("./block")
const TransactionProcessor = require("./transactionProcessor")

class Miner {
    constructor(wallet, feesConfig) {
        this.wallet = wallet
        this.id = wallet.publicKey
        this.processor = new TransactionProcessor(feesConfig)
    }

    buildBlock(rawTransactions, startIndex, maxUserTransactionsPerBlock, balancesState, ledger, networkSeedHash, previousBlockHash) {
        const { transactions, skippedCount, nextIndex } =
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

        return { block, skippedCount, nextIndex }
    }
}

module.exports = Miner
