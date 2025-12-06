class Ledger {
    constructor(initialTotalCoins) {
        this.totalBurned = 0
        this.totalMined = 0
        this.totalCoins = initialTotalCoins
    }

    recordBurn(amount) {
        this.totalBurned += amount
        this.totalCoins -= amount
    }

    recordMined(amount) {
        this.totalMined += amount
        this.totalCoins += amount
    }

    getSummary() {
        return {
            totalBurned: this.totalBurned,
            totalMined: this.totalMined,
            totalCoins: this.totalCoins
        }
    }

    printSummary(balancesMap) {
        console.log("\n===== FINAL BALANCES =====")
        const keys = Object.keys(balancesMap).sort()
        for (const key of keys) {
            console.log(`${key}: ${balancesMap[key]}`)
        }

        const stats = this.getSummary()

        console.log("\n===== NETWORK STATS =====")
        console.log(`Total burned coins: ${stats.totalBurned}`)
        console.log(`Total mined coins:  ${stats.totalMined}`)
        console.log(`Total coins in system: ${stats.totalCoins}`)
    }
}

module.exports = Ledger