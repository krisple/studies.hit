const fs = require("fs")
const path = require("path")

const Miner = require("./miner")
const MinerScheduler = require("./minerScheduler")
const Blockchain = require("./blockchain")

function loadRawTransactions() {
    const filePath = path.join(__dirname, "Solanatransactions.json")
    const raw = fs.readFileSync(filePath, "utf8")
    const data = JSON.parse(raw)

    console.log(`Loaded ${data.length} raw transactions from JSON`)
    return data
}

function main() {
    const config = {
        initialBalance: 100,
        wallets: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"],
        minerIds: ["A", "B", "C", "D", "E"],
        txPerBlockNoCoinbase: 49,
        baseFee: 2,
        tipFee: 3,
        coinbaseReward: 60,
        initialNetworkHash: "42"
    }

    const blockchain = new Blockchain(config)

    const miners = {}
    for (const id of config.minerIds) {
        miners[id] = new Miner(id, {
            baseFee: config.baseFee,
            tipFee: config.tipFee,
            coinbaseReward: config.coinbaseReward
        })
    }

    const scheduler = new MinerScheduler(config.minerIds)

    const rawTransactions = loadRawTransactions()

    blockchain.buildFromRawTransactions(rawTransactions, miners, scheduler)

    blockchain.printSummary()

    console.log("\n===== BLOCKCHAIN VALIDATION =====")
    const isValid = blockchain.isValid(config.initialNetworkHash)
    console.log("Is chain valid?", isValid)
}

main()