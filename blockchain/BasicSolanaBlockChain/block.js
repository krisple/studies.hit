const SHA256 = require("crypto-js/sha256")

class Block {
    constructor(timestamp, transactions, previousHash = "", minerId = null) {
        this.previousHash = previousHash
        this.timestamp = timestamp
        this.transactions = transactions
        this.minerId = minerId
        this.hash = ""
    }

    computeHash(seed) {
        let hashValue = seed
        for (const transaction of this.transactions) {
            const transactionHash = transaction.calculateHash()
            hashValue = SHA256(hashValue + transactionHash).toString()
        }
        return hashValue
    }
}

module.exports = Block
