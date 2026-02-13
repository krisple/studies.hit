import { useState } from "react";
import Web3 from "web3";
import { connectMetaMask } from "../lib/web3";
import { getSongNFT } from "../lib/contracts";

export default function RegisterPage() {
    const [account, setAccount] = useState(null);
    const [chainId, setChainId] = useState(null);
    const [error, setError] = useState(null);

    const [songName, setSongName] = useState("demo-song-1");
    const [registeredAt, setRegisteredAt] = useState(null);
    const [tokenURI, setTokenURI] = useState("ipfs://demo-song-1");
    const [hash, setHash] = useState("");
    const [tokenId, setTokenId] = useState(null);
    const [txHash, setTxHash] = useState(null);

    async function ensureWallet() {
        const { web3, account, chainId } = await connectMetaMask();
        setAccount(account);
        setChainId(chainId);
        return { web3, account, chainId };
    }

    function computeHash(name) {
        const h = Web3.utils.keccak256(name);
        setHash(h);
        return h;
    }

    async function onRegister() {
        try {
            setRegisteredAt(null);
            setError(null);
            setTokenId(null);
            setTxHash(null);

            const { web3, account } = await ensureWallet();
            const song = getSongNFT(web3);

            const h = computeHash(songName);

            const receipt = await song.methods.registerSong(h, tokenURI).send({ from: account });
            setTxHash(receipt.transactionHash);

            // Decode SongRegistered from raw logs (matches your contract)
            const eventAbi = {
                anonymous: false,
                inputs: [
                    { indexed: true,  name: "creator",      type: "address" },
                    { indexed: true,  name: "tokenId",      type: "uint256" },
                    { indexed: true,  name: "songHash",     type: "bytes32" },
                    { indexed: false, name: "registeredAt", type: "uint256" },
                    { indexed: false, name: "tokenURI",     type: "string" },
                ],
                name: "SongRegistered",
                type: "event",
            };

            // Signature topic0 must match exact types + order
            const topic0 = web3.utils.keccak256(
                "SongRegistered(address,uint256,bytes32,uint256,string)"
            );

            const log = receipt.logs.find(l =>
                l.address.toLowerCase() === song.options.address.toLowerCase() &&
                l.topics &&
                l.topics.length > 0 &&
                l.topics[0].toLowerCase() === topic0.toLowerCase()
            );

            if (!log) {
                throw new Error("SongRegistered event not found in receipt logs.");
            }

            const decoded = web3.eth.abi.decodeLog(
                eventAbi.inputs,
                log.data,
                log.topics.slice(1)
            );

            setTokenId(decoded.tokenId);
            setRegisteredAt(decoded.registeredAt);
        } catch (e) {
            setError(e?.message || String(e));
        }
    }

    return (
        <div style={{ padding: 16, fontFamily: "system-ui" }}>
            <h2>Register</h2>

            <div style={{ marginTop: 12 }}>
                <label style={{ display: "block", fontSize: 12, opacity: 0.8 }}>Song name (used for hash)</label>
                <input
                    value={songName}
                    onChange={(e) => { setSongName(e.target.value); computeHash(e.target.value); }}
                    style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
                />
            </div>

            <div style={{ marginTop: 12 }}>
                <label style={{ display: "block", fontSize: 12, opacity: 0.8 }}>Token URI</label>
                <input
                    value={tokenURI}
                    onChange={(e) => setTokenURI(e.target.value)}
                    style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
                />
            </div>

            <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Computed hash</div>
                <code style={{ fontSize: 12 }}>{hash || Web3.utils.keccak256(songName)}</code>
            </div>

            <button
                onClick={onRegister}
                style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, cursor: "pointer" }}
            >
                registerSong
            </button>

            {error && <div style={{ marginTop: 12, color: "crimson" }}>{error}</div>}

            {(txHash || tokenId !== null) && (
                <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
                    {txHash && <div><b>Tx:</b> {txHash}</div>}
                    {tokenId !== null && <div><b>TokenId:</b> {tokenId}</div>}
                </div>
            )}

            {registeredAt !== null && (
            <div>
                <b>RegisteredAt (unix):</b> {registeredAt}
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                {new Date(Number(registeredAt) * 1000).toLocaleString()}
                </div>
            </div>
            )}

            {(account || chainId) && (
                <div style={{ marginTop: 16, fontSize: 12, opacity: 0.8 }}>
                    <div>Account: {account}</div>
                    <div>ChainId: {chainId}</div>
                </div>
            )}
        </div>
    );
}
