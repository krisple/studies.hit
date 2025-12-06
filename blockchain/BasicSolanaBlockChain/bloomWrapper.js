const { BloomFilter } = require("bloom-filters")

class BloomWrapper {
    constructor(transactions, errorRate = 0.01) {
        const transactionHashes = (transactions || []).map((transaction) => transaction.calculateHash())
        this.filter = BloomFilter.from(transactionHashes, errorRate)
    }

    mightContain(transaction) {
        if (!transaction || typeof transaction.calculateHash !== "function") {
            return false
        }
        return this.filter.has(transaction.calculateHash())
    }

    mightContainHash(hashHex) {
        if (!hashHex) return false
        return this.filter.has(hashHex)
    }
}

module.exports = BloomWrapper
