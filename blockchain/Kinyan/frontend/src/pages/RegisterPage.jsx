import { useContext, useState } from "react";
import Web3 from "web3";
import contracts from "../../config/contracts.json";
import { AppContext } from "../context/appContext";
import { getSongNFT } from "../lib/contracts";
import PageHeader from "../components/layout/PageHeader";

export default function RegisterPage() {
    const { web3, account, chainId, bumpRefresh } = useContext(AppContext);

    const expectedChainId = contracts.chainId;
    const chainOk = chainId !== null && Number(chainId) === Number(expectedChainId);

    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    const [songName, setSongName] = useState("demo-song-1");
    const [tokenURI, setTokenURI] = useState("ipfs://demo-song-1");
    const [hash, setHash] = useState(Web3.utils.keccak256("demo-song-1"));
    const [tokenId, setTokenId] = useState(null);
    const [registeredAt, setRegisteredAt] = useState(null);
    const [txHash, setTxHash] = useState(null);

    function computeHash(name) {
        const h = Web3.utils.keccak256(name);
        setHash(h);
        return h;
    }

    async function onRegister() {
        try {
            setError(null);
            setBusy(true);
            setTokenId(null);
            setRegisteredAt(null);
            setTxHash(null);

            if (!web3 || !account) throw new Error("Not connected");
            if (!chainOk) throw new Error(`Wrong network (expected chainId ${expectedChainId})`);

            const song = getSongNFT(web3);
            const h = computeHash(songName);

            const receipt = await song.methods.registerSong(h, tokenURI).send({ from: account });
            setTxHash(receipt.transactionHash);

            const topic0 = web3.utils.keccak256("SongRegistered(address,uint256,bytes32,uint256,string)");
            const log = receipt.logs.find((l) =>
                l.address.toLowerCase() === song.options.address.toLowerCase() &&
                l.topics?.[0]?.toLowerCase() === topic0.toLowerCase()
            );

            if (log) {
                const decoded = web3.eth.abi.decodeLog(
                    [
                        { indexed: true, name: "creator", type: "address" },
                        { indexed: true, name: "tokenId", type: "uint256" },
                        { indexed: true, name: "songHash", type: "bytes32" },
                        { indexed: false, name: "registeredAt", type: "uint256" },
                        { indexed: false, name: "tokenURI", type: "string" },
                    ],
                    log.data,
                    log.topics.slice(1)
                );

                setTokenId(decoded.tokenId);
                setRegisteredAt(decoded.registeredAt);
            }

            bumpRefresh();
        } catch (e) {
            setError(e?.message || String(e));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="container">
            <PageHeader title="Register" />

            <div className="card">
                <div className="stack">
                    <div>
                        <label className="label">Song name (used for hash)</label>
                        <input
                            value={songName}
                            onChange={(e) => { setSongName(e.target.value); computeHash(e.target.value); }}
                            className="input"
                        />
                    </div>

                    <div>
                        <label className="label">Token URI</label>
                        <input
                            value={tokenURI}
                            onChange={(e) => setTokenURI(e.target.value)}
                            className="input"
                        />
                    </div>

                    <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 12 }}>
                        <div className="muted-2" style={{ fontSize: 12 }}>Computed hash</div>
                        <div className="mono">{hash}</div>
                    </div>

                    <button onClick={onRegister} disabled={!chainOk || busy} className="btn btn-primary">
                        {busy ? "Registering..." : "registerSong"}
                    </button>
                </div>
            </div>

            {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}

            {(txHash || tokenId !== null) && (
                <div className="card" style={{ marginTop: 16 }}>
                    {txHash && <div><b>Tx:</b> <span className="mono">{txHash}</span></div>}
                    {tokenId !== null && <div><b>TokenId:</b> {tokenId}</div>}
                    {registeredAt !== null && (
                        <div style={{ marginTop: 10 }}>
                            <div><b>RegisteredAt (unix):</b> {registeredAt}</div>
                            <div className="muted-2" style={{ fontSize: 12 }}>
                                {new Date(Number(registeredAt) * 1000).toLocaleString()}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
