const Transaction = require("./transaction")

class TransactionProcessor {
    constructor(feesConfig) {
        const { baseFee = 0, tipFee = 0, coinbaseReward = 0 } = feesConfig || {}
        this.baseFee = baseFee
        this.tipFee = tipFee
        this.coinbaseReward = coinbaseReward
    }

    processBatchOfRawTransactions(rawTransactions, startIndex, maxUserTransactionsPerBlock, minerId, balancesState, ledger) {
        const processedTransactions = []
        let skippedCount = 0
        let acceptedCount = 0
        let index = startIndex

        while (index < rawTransactions.length && acceptedCount < maxUserTransactionsPerBlock) {
            const currentIndex = index
            const normalized = this._normalizeTransaction(rawTransactions[currentIndex], currentIndex)
            index += 1

            if (!normalized) {
                skippedCount += 1
                continue
            }

            const { fromAddress, toAddress, amount } = normalized
            const totalCost = amount + this.baseFee + this.tipFee

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

            this._applyTransaction(normalized, totalCost, minerId, balancesState, ledger)

            processedTransactions.push(normalized)
            acceptedCount += 1
        }

        if (this.coinbaseReward > 0) {
            balancesState.credit(minerId, this.coinbaseReward)
            ledger.recordMined(this.coinbaseReward)

            const coinbaseNonce = `coinbase-${startIndex}-${minerId}`
            const coinbaseTransaction = new Transaction(null, minerId, this.coinbaseReward, coinbaseNonce)
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
        return new Transaction(fromAddress, toAddress, amount, nonce)
    }

    _applyTransaction(transaction, totalCost, minerId, balancesState, ledger) {
        balancesState.debit(transaction.fromAddress, totalCost)
        balancesState.credit(transaction.toAddress, transaction.amount)
        balancesState.credit(minerId, this.tipFee)
        ledger.recordBurn(this.baseFee)
    }
}

module.exports = TransactionProcessor
