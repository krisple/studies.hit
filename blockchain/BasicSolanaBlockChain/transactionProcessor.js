const Transaction = require("./transaction")

class TransactionProcessor {
    constructor(coinbaseReward) {
        this.coinbaseReward = coinbaseReward
    }

    processTransactions(rawTransactions, balancesState, ledger) {
        const processedTransactions = []
        let totalTips = 0

        for (let i = 0; i < rawTransactions.length; i++) {
            const normalized = this._normalizeTransaction(rawTransactions[i], i)
            if (!normalized) continue

            const { fromAddress, toAddress, amount, baseFee, tipFee } = normalized
            const totalCost = amount + baseFee + tipFee

            this._applyTransaction(normalized, totalCost, baseFee, balancesState, ledger)

            processedTransactions.push(normalized)
            totalTips += tipFee
        }

        return {
            transactions: processedTransactions,
            totalTips
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
        if (transaction.fromAddress === null || transaction.fromAddress === undefined) {
            balancesState.credit(transaction.toAddress, transaction.amount)
            ledger.recordMined(transaction.amount)
            return
        }

        balancesState.debit(transaction.fromAddress, totalCost)
        balancesState.credit(transaction.toAddress, transaction.amount)
        ledger.recordBurn(baseFee)
    }
}

module.exports = TransactionProcessor
