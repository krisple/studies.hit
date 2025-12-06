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
            const rawIndex = index
            const rawTransaction = rawTransactions[rawIndex]
            index += 1

            const from = rawTransaction.from
            const to = rawTransaction.to
            const amount = rawTransaction.amount

            const totalCost = amount + this.baseFee + this.tipFee

            if (!balancesState.canDebit(from, totalCost)) {
                console.log(
                    `Skipping transaction ${from} -> ${to} amount ${amount}: ` +
                    `insufficient funds (balance=${balancesState.getBalance(from)}, required=${totalCost})`
                )
                skippedCount += 1
                continue
            }

            balancesState.debit(from, totalCost)
            balancesState.credit(to, amount)
            balancesState.credit(minerId, this.tipFee)

            ledger.recordBurn(this.baseFee)

            const transaction = new Transaction(from, to, amount, rawIndex)
            processedTransactions.push(transaction)
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
}

module.exports = TransactionProcessor
