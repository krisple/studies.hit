const SHA256 = require("crypto-js/sha256")
const EC = require("elliptic").ec

const ec = new EC("secp256k1")

class Transaction {
    constructor(fromAddress, toAddress, amount, nonce = 0, baseFee = 0, tipFee = 0) {
        this.fromAddress = fromAddress
        this.toAddress = toAddress
        this.amount = amount
        this.nonce = nonce
        this.baseFee = baseFee
        this.tipFee = tipFee
        this.signature = null
    }

    calculateHash() {
        return SHA256(
            String(this.fromAddress) +
            String(this.toAddress) +
            String(this.amount) +
            String(this.nonce)
        ).toString()
    }

    signTransaction(signingKey) {
        if (!signingKey || typeof signingKey.getPublic !== "function") {
            throw new Error("Invalid signing key provided")
        }
        if (signingKey.getPublic("hex") !== this.fromAddress) {
            throw new Error("You can't sign transactions for other wallets")
        }

        const hash = this.calculateHash()
        const signature = signingKey.sign(hash, "base64")
        this.signature = signature.toDER("hex")
    }

    isValid() {
        if (this.fromAddress === null) return true // coinbase
        if (!this.signature || this.signature.length === 0) {
            return false
        }
        const publicKey = ec.keyFromPublic(this.fromAddress, "hex")
        return publicKey.verify(this.calculateHash(), this.signature)
    }
}

module.exports = Transaction
