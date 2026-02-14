import { useContext, useEffect, useMemo, useState } from "react";
import contracts from "../../config/contracts.json";
import { AppContext } from "../context/appContext";
import { fetchMetadata } from "../lib/metadata";
import { formatUnits, getKny, getMarketplace, getSongNFT } from "../lib/contracts";
import StickyHeader from "../components/layout/StickyHeader";
import SongBasics from "../components/SongBasics";

export default function TokenHistoryPage({ nft, tokenId, onBack }) {
    const { web3, account, chainId } = useContext(AppContext);

    const expectedChainId = contracts.chainId;
    const chainOk = chainId !== null && Number(chainId) === Number(expectedChainId);

    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const [tokenURI, setTokenURI] = useState(null);
    const [meta, setMeta] = useState(null);
    const [trades, setTrades] = useState([]);
    const [owners, setOwners] = useState([]);

    const [knyDecimals, setKnyDecimals] = useState(null);
    const [knySymbol, setKnySymbol] = useState(null);

    const isSongNft = useMemo(
        () => String(nft).toLowerCase() === String(contracts.songNft).toLowerCase(),
        [nft]
    );

    async function load() {
        try {
            setError(null);
            if (!web3 || !account) return;
            if (!chainOk) return;

            setBusy(true);

            const song = getSongNFT(web3);
            const mp = getMarketplace(web3);
            const kny = getKny(web3);

            const [tradeHistory, ownershipHistory, uri, decimals, symbol] = await Promise.all([
                mp.methods.getTradeHistory(nft, tokenId).call(),
                isSongNft ? song.methods.getOwnershipHistory(tokenId).call() : Promise.resolve([]),
                isSongNft ? song.methods.tokenURI(tokenId).call() : Promise.resolve(null),
                kny.methods.decimals().call().catch(() => null),
                kny.methods.symbol().call().catch(() => null),
            ]);

            if (uri) {
                setTokenURI(uri);
                const md = await fetchMetadata(uri);
                if (md.ok) setMeta(md.data);
            }

            setTrades(Array.isArray(tradeHistory) ? tradeHistory : []);
            setOwners(Array.isArray(ownershipHistory) ? ownershipHistory : []);
            setKnyDecimals(decimals !== null ? Number(decimals) : null);
            setKnySymbol(symbol || null);
        } catch (e) {
            setError(e?.message || String(e));
        } finally {
            setBusy(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [web3, account, chainId, nft, tokenId]);

    return (
        <div className="container">
            <StickyHeader
                title="History"
                right={<button onClick={onBack} className="btn btn-ghost">Back</button>}
            />

            {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}

            {busy && <div className="muted-2" style={{ fontSize: 12, marginTop: 12 }}>Loading...</div>}

            <div className="card" style={{ marginTop: 12 }}>
                <SongBasics tokenId={tokenId} tokenURI={tokenURI} meta={meta} />
                <div style={{ marginTop: 10, fontSize: 12 }} className="muted-2">
                    NFT: <span className="mono">{nft}</span>
                </div>
            </div>

            <div className="card" style={{ marginTop: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Trade History</h3>
                {trades.length === 0 ? (
                    <div style={{ marginTop: 10, fontSize: 12 }} className="muted-2">No trades yet.</div>
                ) : (
                    <div style={{ marginTop: 10 }}>
                        {trades.map((t, i) => (
                            <div
                                key={i}
                                style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 12, marginTop: 8 }}
                            >
                                <div style={{ fontSize: 12 }}>
                                    <b>Price:</b>{" "}
                                    {knyDecimals !== null ? formatUnits(t.price, knyDecimals) : String(t.price)}{" "}
                                    {knySymbol || "KNY"}{" "}
                                    <span className="muted-2">
                                        (royalty:{" "}
                                        {knyDecimals !== null ? formatUnits(t.royalty, knyDecimals) : String(t.royalty)}{" "}
                                        {knySymbol || "KNY"})
                                    </span>
                                </div>
                                <div style={{ marginTop: 4, fontSize: 12 }} className="muted-2">
                                    Seller: <span className="mono">{t.seller}</span>
                                    <br />
                                    Buyer: <span className="mono">{t.buyer}</span>
                                </div>
                                <div style={{ marginTop: 4, fontSize: 12 }} className="muted-2">
                                    {t.timestamp} ({new Date(Number(t.timestamp) * 1000).toLocaleString()})
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="card" style={{ marginTop: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Ownership History</h3>
                {owners.length === 0 ? (
                    <div style={{ marginTop: 10, fontSize: 12 }} className="muted-2">
                        {isSongNft ? "No ownership records yet." : "Ownership history available only for SongNFT."}
                    </div>
                ) : (
                    <div style={{ marginTop: 10 }}>
                        {owners.map((o, i) => (
                            <div
                                key={i}
                                style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 12, marginTop: 8 }}
                            >
                                <div style={{ fontSize: 12 }}>
                                    <b>Owner:</b> <span className="mono">{o.owner}</span>
                                </div>
                                <div style={{ marginTop: 4, fontSize: 12 }} className="muted-2">
                                    {o.timestamp} ({new Date(Number(o.timestamp) * 1000).toLocaleString()})
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
