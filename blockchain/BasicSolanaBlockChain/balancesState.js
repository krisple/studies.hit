class BalancesState {
    constructor(walletIds, initialBalance) {
        this.balances = {}
        for (const id of walletIds) {
            this.balances[id] = initialBalance
        }
    }

    ensureWallet(address) {
        if (!address) return
        if (this.balances[address] === undefined) {
            this.balances[address] = 0
        }
    }

    getBalance(address) {
        this.ensureWallet(address)
        return this.balances[address]
    }

    canDebit(address, amount) {
        this.ensureWallet(address)
        return this.balances[address] >= amount
    }

    debit(address, amount) {
        this.ensureWallet(address)
        if (this.balances[address] < amount) {
            return false
        }
        this.balances[address] -= amount
        return true
    }

    credit(address, amount) {
        this.ensureWallet(address)
        this.balances[address] += amount
    }

    getAllBalances() {
        return { ...this.balances }
    }
}

module.exports = BalancesState