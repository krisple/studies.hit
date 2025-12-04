const EC = require('elliptic').ec

const ec = new EC('secp256k1')

const key = ec.genKeyPair()

const publicKey = key.getPublic('hex')
const privateKey = key.getPrivate('hex')

console.log()
console.log("Your public key is your wallet address (shareable):\n", publicKey)
console.log()
console.log("Your private key (KEEP IT SECRET, used to sign transactions):\n", privateKey)
