const SHA256 = require("crypto-js/sha256")
const EC = require("elliptic").ec
const ec = new EC("secp256k1")

class Transaction {
    constructor(fromAddress, toAddress, amount) {
        this.fromAddress = fromAddress
        this.toAddress = toAddress
        this.amount = amount
        this.timeStamp = Date.now()
    }

    calculateHash() {
        return SHA256(
            this.fromAddress +
            this.toAddress +
            this.amount +
            this.timeStamp
        ).toString()
    }

    signTransaction(signingKey) {
        if (signingKey.getPublic("hex") !== this.fromAddress) {
            throw new Error("You can't sign transactions for other wallets")
        }

        const hashTx = this.calculateHash()
        const signature = signingKey.sign(hashTx, "base64")
        this.signature = signature.toDER("hex")
    }

    isValid() {
        if (this.fromAddress === null) {
            // coinbase transaction
            return true
        }

        if (!this.signature || this.signature.length === 0) {
            throw new Error("No signature present on this transaction")
        }

        const publicKey = ec.keyFromPublic(this.fromAddress, "hex")
        return publicKey.verify(this.calculateHash(), this.signature)
    }
}

module.exports = Transaction
