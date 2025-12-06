const { MerkleTree } = require("merkletreejs")
const SHA256 = require("crypto-js/sha256")

class MerkleWrapper {
    constructor(transactions) {
        const leaves = (transactions || []).map((transaction) =>
            Buffer.from(transaction.calculateHash(), "hex")
        )
        const hashFn = (data) => Buffer.from(SHA256(data).toString(), "hex")
        this.tree = new MerkleTree(leaves, hashFn, { sortPairs: true })
        const root = this.tree.getRoot()
        this.leaves = leaves
        this.root = root ? root.toString("hex") : ""
    }

    getRoot() {
        return this.root
    }

    getProof(transaction) {
        if (!transaction || typeof transaction.calculateHash !== "function") {
            return []
        }
        const leaf = Buffer.from(transaction.calculateHash(), "hex")
        return this.tree.getProof(leaf)
    }

    verify(transaction, proof, rootHex = this.root) {
        if (!transaction || typeof transaction.calculateHash !== "function") {
            return false
        }
        if (!rootHex) return false
        const leaf = Buffer.from(transaction.calculateHash(), "hex")
        const root = Buffer.from(rootHex, "hex")
        return this.tree.verify(proof, leaf, root)
    }
}

module.exports = MerkleWrapper
