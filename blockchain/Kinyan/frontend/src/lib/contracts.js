import Web3 from "web3";
import contracts from "../../config/contracts.json";

const SONG_ABI = [
    { "inputs": [], "name": "marketplace", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },

    { "inputs": [
        { "internalType": "bytes32", "name": "songHash", "type": "bytes32" },
        { "internalType": "string", "name": "tokenURI", "type": "string" }
      ],
      "name": "registerSong",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },

    { "anonymous": false,
      "inputs": [
        { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" },
        { "indexed": true, "internalType": "bytes32", "name": "songHash", "type": "bytes32" },
        { "indexed": true, "internalType": "address", "name": "creator", "type": "address" },
        { "indexed": false, "internalType": "string", "name": "tokenURI", "type": "string" }
      ],
      "name": "SongRegistered",
      "type": "event"
    }
];


const KNY_ABI = [
    { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "balanceOf", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "decimals", "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "symbol", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" }
];

export function getSongNFT(web3) {
    return new web3.eth.Contract(SONG_ABI, contracts.songNft);
}

export function getKny(web3) {
    return new web3.eth.Contract(KNY_ABI, contracts.kny);
}

export function formatUnits(value, decimals) {
    const v = BigInt(value);
    const d = BigInt(decimals);
    const base = 10n ** d;

    const whole = v / base;
    const frac = v % base;

    const fracStr = frac.toString().padStart(Number(decimals), "0").slice(0, 4);
    return `${whole.toString()}.${fracStr}`;
}
