const SHA256 = require("crypto-js/sha256")

class Transaction {
    constructor(fromAddress, toAddress, amount) {
        this.fromAddress = fromAddress
        this.toAddress = toAddress
        this.amount = amount
    }

    calculateHash() {
        return SHA256(
            String(this.fromAddress) +
            String(this.toAddress) +
            String(this.amount)
        ).toString()
    }
}

module.exports = Transaction