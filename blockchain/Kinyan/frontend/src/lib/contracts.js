import Web3 from "web3";
import contracts from "../../config/contracts.json";

const SONG_ABI = [
    { "inputs": [], "name": "marketplace", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
    {
        "inputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
        "name": "tokenIdBySongHash",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "address", "name": "operator", "type": "address" }], "name": "isApprovedForAll", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "operator", "type": "address" }, { "internalType": "bool", "name": "approved", "type": "bool" }], "name": "setApprovalForAll", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "getApproved", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "approve", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "ownerOf", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }], "name": "tokenURI", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "nextTokenId", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    {
        "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
        "name": "getOwnershipHistory",
        "outputs": [
            {
                "components": [
                    { "internalType": "address", "name": "owner", "type": "address" },
                    { "internalType": "uint256", "name": "timestamp", "type": "uint256" }
                ],
                "internalType": "struct IKinyanTradableNFT.OwnershipRecord[]",
                "name": "",
                "type": "tuple[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },

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

const MARKETPLACE_ABI = [
    {
        "inputs": [
            { "internalType": "address", "name": "nft", "type": "address" },
            { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
            { "internalType": "uint256", "name": "price", "type": "uint256" }
        ],
        "name": "createOffer",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "nft", "type": "address" },
            { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
        ],
        "name": "cancelOffer",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "nft", "type": "address" },
            { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
            { "internalType": "uint256", "name": "newPrice", "type": "uint256" }
        ],
        "name": "updateOfferPrice",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "", "type": "address" },
            { "internalType": "uint256", "name": "", "type": "uint256" }
        ],
        "name": "saleOffers",
        "outputs": [
            { "internalType": "address", "name": "seller", "type": "address" },
            { "internalType": "uint256", "name": "price", "type": "uint256" },
            { "internalType": "uint256", "name": "createdAt", "type": "uint256" }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getActiveOffers",
        "outputs": [
            {
                "components": [
                    { "internalType": "address", "name": "nft", "type": "address" },
                    { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
                    { "internalType": "address", "name": "seller", "type": "address" },
                    { "internalType": "uint256", "name": "price", "type": "uint256" },
                    { "internalType": "uint256", "name": "createdAt", "type": "uint256" }
                ],
                "internalType": "struct KinyanMarketplace.OfferView[]",
                "name": "",
                "type": "tuple[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "nft", "type": "address" },
            { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
        ],
        "name": "purchase",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "nft", "type": "address" },
            { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
        ],
        "name": "getTradeHistory",
        "outputs": [
            {
                "components": [
                    { "internalType": "address", "name": "seller", "type": "address" },
                    { "internalType": "address", "name": "buyer", "type": "address" },
                    { "internalType": "uint256", "name": "price", "type": "uint256" },
                    { "internalType": "address", "name": "creator", "type": "address" },
                    { "internalType": "uint256", "name": "royalty", "type": "uint256" },
                    { "internalType": "uint256", "name": "timestamp", "type": "uint256" }
                ],
                "internalType": "struct KinyanMarketplace.Trade[]",
                "name": "",
                "type": "tuple[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];


const KNY_ABI = [
    { "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "balanceOf", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "address", "name": "spender", "type": "address" }], "name": "allowance", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }], "name": "approve", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [], "name": "decimals", "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "symbol", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" }
];

export function getSongNFT(web3) {
    return new web3.eth.Contract(SONG_ABI, contracts.songNft);
}

export function getMarketplace(web3) {
    return new web3.eth.Contract(MARKETPLACE_ABI, contracts.marketplace);
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

export function parseUnits(value, decimals) {
    if (value === null || value === undefined) throw new Error("Missing amount");
    const s = String(value).trim();
    if (s.length === 0) throw new Error("Missing amount");
    if (s.startsWith("-")) throw new Error("Amount must be positive");

    const dec = Number(decimals);
    if (!Number.isInteger(dec) || dec < 0) throw new Error("Invalid decimals");

    const [wholeRaw, fracRaw = ""] = s.split(".");
    if (s.split(".").length > 2) throw new Error("Invalid number format");

    const whole = wholeRaw === "" ? "0" : wholeRaw;
    if (!/^\d+$/.test(whole)) throw new Error("Invalid number format");
    if (fracRaw && !/^\d+$/.test(fracRaw)) throw new Error("Invalid number format");

    const frac = fracRaw.slice(0, dec).padEnd(dec, "0");
    if (fracRaw.length > dec) {
        throw new Error(`Too many decimal places (max ${dec})`);
    }

    const base = 10n ** BigInt(dec);
    const wholePart = BigInt(whole) * base;
    const fracPart = frac.length ? BigInt(frac) : 0n;

    return (wholePart + fracPart).toString();
}
