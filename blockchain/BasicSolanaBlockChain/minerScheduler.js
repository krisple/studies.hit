const Transaction = require("./transaction")

class MinerScheduler {
    constructor(minerIds, coinbaseReward, initialTransactions = []) {
        this.minerIds = minerIds || []
        this.coinbaseReward = coinbaseReward || 0
        this.txQueue = [...initialTransactions]
    }

    buildSignedTransactions(rawTransactions, walletMap, baseFee, tipFee) {
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

    startMinersLoop(miners, rawTransactions, walletMap, baseFee, tipFee, maxUserTransactionsPerBlock) {
        let blockIndex = 1

        const signedTransactions = this.buildSignedTransactions(rawTransactions, walletMap, baseFee, tipFee)
        this.enqueueTransactions(signedTransactions)

        while (this.hasTransactions()) {
            const minerId = this.getMinerIdForBlock(blockIndex)
            const miner = miners[minerId]
            if (!miner) {
                throw new Error(`No miner instance for id ${minerId}`)
            }

            console.log(`\n=== Building block #${blockIndex}, miner: ${minerId} ===`)

            const batch = this.nextBatch(maxUserTransactionsPerBlock)
            if (!batch.length) break

            const { block, totalTips } = miner.mineBlock(batch)

            console.log(`Block #${blockIndex} built with ${block.transactions.length} transactions.`)

            const hasUserTx = block.transactions.some(
                (tx) => tx && tx.fromAddress !== null && tx.fromAddress !== undefined
            )
            if (hasUserTx) {
                const coinbaseTx = new Transaction(
                    null,
                    minerId,
                    this.coinbaseReward + totalTips,
                    `coinbase-${blockIndex}-${minerId}`,
                    0,
                    0
                )
                this.enqueue(coinbaseTx)
            }

            blockIndex += 1
        }
    }

    getMinerIdForBlock(blockIndex) {
        if (!this.minerIds.length) {
            throw new Error("No miners configured in MinerScheduler")
        }
        const index = (blockIndex - 1) % this.minerIds.length
        return this.minerIds[index]
    }

    enqueueTransactions(txs) {
        if (!Array.isArray(txs)) return
        this.txQueue.push(...txs)
    }

    enqueue(tx) {
        if (!tx) return
        this.txQueue.push(tx)
    }

    hasTransactions() {
        return this.txQueue.length > 0
    }

    nextBatch(maxUserTx) {
        const batch = []
        let userCount = 0

        while (this.txQueue.length && userCount < maxUserTx) {
            const tx = this.txQueue.shift()
            batch.push(tx)
            if (tx && tx.fromAddress !== null && tx.fromAddress !== undefined) {
                userCount += 1
            }
        }

        return batch
    }
}

module.exports = MinerScheduler
