class MinerScheduler {
    constructor(minerIds) {
        this.minerIds = []
        this.minerIds = minerIds || []
    }

    getMinerIdForBlock(blockIndex) {
        if (!this.minerIds.length) {
            throw new Error("No miners configured in MinerScheduler")
        }
        const index = (blockIndex - 1) % this.minerIds.length
        return this.minerIds[index]
    }
}

module.exports = MinerScheduler
