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

    debit(address, amount) {
        this.ensureWallet(address)
        this.balances[address] -= amount
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
