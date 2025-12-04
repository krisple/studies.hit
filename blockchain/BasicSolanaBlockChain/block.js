const SHA256 = require("crypto-js/sha256")

class Block {
    constructor(timeStamp, transactions, previousHash = "") {
        this.previousHash = previousHash
        this.timeStamp = timeStamp
        this.transactions = transactions
        this.hash = this.calculateHash()
        this.nonce = 0
    }

    calculateHash() {
        return SHA256(
            this.previousHash +
            this.timeStamp +
            JSON.stringify(this.transactions) +
            this.nonce
        ).toString()
    }

    mineBlock(difficulty) {
        const target = Array(difficulty + 1).join("0")

        while (this.hash.substring(0, difficulty) !== target) {
            this.nonce++
            this.hash = this.calculateHash()
        }
        console.log("Block mined: " + this.hash)
    }

    hasValidateTransaction() {
        for (const transaction of this.transactions) {
            if (!transaction.isValid()) {
                return false
            }
        }
        return true
    }
}

module.exports = Block
