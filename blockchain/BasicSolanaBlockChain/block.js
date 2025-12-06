const SHA256 = require("crypto-js/sha256")
const MerkleWrapper = require("./merkleWrapper")
const BloomWrapper = require("./bloomWrapper")

class Block {
    constructor(timestamp, transactions, previousHash = "", minerId = null) {
        this.previousHash = ""
        this.timestamp = 0
        this.transactions = []
        this.minerId = null
        this.hash = ""
        this.merkle = null
        this.merkleRoot = ""
        this.bloom = null

        this.previousHash = previousHash
        this.timestamp = timestamp
        this.transactions = transactions
        this.minerId = minerId
        this.hash = ""

        this._buildMerkle()
        this._buildBloom()
    }

    computeHash(seed) {
        let hashValue = seed
        for (const transaction of this.transactions) {
            const transactionHash = transaction.calculateHash()
            hashValue = SHA256(hashValue + transactionHash).toString()
        }
        return hashValue
    }

    _buildMerkle() {
        this.merkle = new MerkleWrapper(this.transactions)
        this.merkleRoot = this.merkle.getRoot()
    }

    _buildBloom() {
        this.bloom = new BloomWrapper(this.transactions)
    }

    getMerkleProof(transaction) {
        return this.merkle.getProof(transaction)
    }

    verifyProofForHash(hashHex, proof, rootHex = this.merkleRoot) {
        if (!this.merkle || !rootHex) return false
        const leaf = Buffer.from(hashHex, "hex")
        const root = Buffer.from(rootHex, "hex")
        return this.merkle.tree.verify(proof, leaf, root)
    }

    findTransactionByHash(transactionHashHex) {
        const index = this.transactions.findIndex(
            (transaction) => transaction.calculateHash() === transactionHashHex
        )
        if (index === -1) return null
        return { transaction: this.transactions[index], index }
    }
}

module.exports = Block
