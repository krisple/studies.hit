const SHA256 = require("crypto-js/sha256")
const { ec: EC } = require("elliptic")

const ec = new EC("secp256k1")

class Wallet {
    constructor(name) {
        this.name = name
        const privateHex = SHA256(String(name)).toString()
        this.keyPair = ec.keyFromPrivate(privateHex)
        this.publicKey = this.keyPair.getPublic("hex")
    }
}

module.exports = Wallet
