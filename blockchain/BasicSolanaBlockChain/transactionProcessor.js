const Transaction = require("./transaction")

class TransactionProcessor {
    constructor(coinbaseReward) {
        this.coinbaseReward = coinbaseReward
    }

    processBatchOfRawTransactions(rawTransactions, startIndex, maxUserTransactionsPerBlock, minerId, balancesState, ledger) {
        const processedTransactions = []
        let skippedCount = 0
        let acceptedCount = 0
        let index = startIndex
        let totalTips = 0

        while (index < rawTransactions.length && acceptedCount < maxUserTransactionsPerBlock) {
            const currentIndex = index
            const normalized = this._normalizeTransaction(rawTransactions[currentIndex], currentIndex)
            index += 1

            if (!normalized) {
                skippedCount += 1
                continue
            }

            const { fromAddress, toAddress, amount, baseFee, tipFee } = normalized
            const totalCost = amount + baseFee + tipFee

            if (!balancesState.canDebit(fromAddress, totalCost)) {
                console.log(
                    `Skipping transaction ${fromAddress} -> ${toAddress} amount ${amount}: ` +
                    `insufficient funds (balance=${balancesState.getBalance(fromAddress)}, required=${totalCost})`
                )
                skippedCount += 1
                continue
            }

            if (typeof normalized.isValid === "function" && !normalized.isValid()) {
                console.log(`Skipping transaction ${fromAddress} -> ${toAddress} amount ${amount}: invalid signature`)
                skippedCount += 1
                continue
            }

            this._applyTransaction(normalized, totalCost, baseFee, balancesState, ledger)
            totalTips += tipFee

            processedTransactions.push(normalized)
            acceptedCount += 1
        }

        const rewardAmount = this.coinbaseReward + totalTips

        if (rewardAmount > 0) {
            balancesState.credit(minerId, rewardAmount)
            if (this.coinbaseReward > 0) {
                ledger.recordMined(this.coinbaseReward)
            }

            const coinbaseNonce = `coinbase-${startIndex}-${minerId}`
            const coinbaseTransaction = new Transaction(null, minerId, rewardAmount, coinbaseNonce)
            coinbaseTransaction.baseFee = 0
            coinbaseTransaction.tipFee = 0
            processedTransactions.push(coinbaseTransaction)
        }

        return {
            transactions: processedTransactions,
            skippedCount,
            nextIndex: index
        }
    }

    _normalizeTransaction(raw, nonce) {
        if (raw instanceof Transaction) return raw
        if (!raw) return null
        const fromAddress = raw.fromAddress ?? raw.from ?? null
        const toAddress = raw.toAddress ?? raw.to ?? null
        const amount = raw.amount ?? 0
        const baseFee = raw.baseFee ?? 0
        const tipFee = raw.tipFee ?? 0
        return new Transaction(fromAddress, toAddress, amount, nonce, baseFee, tipFee)
    }

    _applyTransaction(transaction, totalCost, baseFee, balancesState, ledger) {
        balancesState.debit(transaction.fromAddress, totalCost)
        balancesState.credit(transaction.toAddress, transaction.amount)
        ledger.recordBurn(baseFee)
    }
}

module.exports = TransactionProcessor
