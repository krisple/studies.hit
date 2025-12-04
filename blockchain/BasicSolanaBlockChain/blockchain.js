const Block = require("./block")
const Transaction = require("./transaction")

class Blockchain {
    constructor() {
        this.chain = [this.createGenesisBlock()]
        this.difficulty = 5
        this.pendingTransactions = []
        this.miningReward = 100
    }

    createGenesisBlock() {
        return new Block("01/09/2009", "Genesis Block", 0)
    }

    getLatestBlock() {
        return this.chain[this.chain.length - 1]
    }

    minePendingTransactions(miningRewardAddress) {
        const rewardTransaction = new Transaction(null, miningRewardAddress, this.miningReward)
        this.pendingTransactions.push(rewardTransaction)

        const block = new Block(
            Date.now(),
            this.pendingTransactions,
            this.getLatestBlock().hash
        )

        block.mineBlock(this.difficulty)
        console.log("Block mined successfully")

        this.chain.push(block)
        this.pendingTransactions = []
    }

    addTransaction(transaction) {
        if (!transaction.fromAddress || !transaction.toAddress) {
            throw new Error("Transaction must include both from and to addresses")
        }
        if (!transaction.isValid()) {
            throw new Error("Cannot add invalid transaction to the chain")
        }
        this.pendingTransactions.push(transaction)
    }

    getBalanceOfAddress(address) {
        let balance = 0

        for (const block of this.chain) {
            for (const transaction of block.transactions) {
                if (transaction.fromAddress === address) {
                    balance -= transaction.amount
                }
                if (transaction.toAddress === address) {
                    balance += transaction.amount
                }
            }
        }

        return balance
    }

    isChainValid() {
        for (let i = 1; i < this.chain.length; i++) {

            const currentBlock = this.chain[i]
            const previousBlock = this.chain[i - 1]

            if (!currentBlock.hasValidateTransaction()) {
                return false
            }

            if (currentBlock.hash !== currentBlock.calculateHash()) {
                return false
            }

            if (currentBlock.previousHash !== previousBlock.hash) {
                return false
            }
        }
        return true
    }
}

module.exports = Blockchain