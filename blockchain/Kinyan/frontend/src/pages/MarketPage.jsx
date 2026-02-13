import { useContext, useEffect, useMemo, useRef, useState } from "react";
import contracts from "../../config/contracts.json";
import { formatUnits, getKny, getMarketplace } from "../lib/contracts";
import OfferDetailsPage from "./OfferDetailsPage";
import { AppContext } from "../context/appContext";
import PageHeader from "../components/layout/PageHeader";

export default function MarketPage() {
    const { web3, account, chainId, refreshNonce } = useContext(AppContext);

    const [error, setError] = useState(null);
    const [offers, setOffers] = useState([]);
    const [selected, setSelected] = useState(null);
    const [knyDecimals, setKnyDecimals] = useState(null);
    const [knySymbol, setKnySymbol] = useState(null);
    const [busy, setBusy] = useState(false);

    const expectedChainId = contracts.chainId;
    const chainOk = chainId !== null && Number(chainId) === Number(expectedChainId);

    const marketplaceAddr = useMemo(() => contracts.marketplace, []);
    const lastBlockRef = useRef(null);

    async function loadActiveOffers() {
        try {
            setError(null);
            if (!web3 || !account) return;
            if (Number(chainId) !== Number(expectedChainId)) return;

            setBusy(true);

            const mp = getMarketplace(web3);
            const kny = getKny(web3);

            const [list, decimals, symbol] = await Promise.all([
                mp.methods.getActiveOffers().call(),
                kny.methods.decimals().call(),
                kny.methods.symbol().call(),
            ]);

            setKnyDecimals(Number(decimals));
            setKnySymbol(symbol);
            setOffers(Array.isArray(list) ? list : []);
        } catch (e) {
            setError(e?.message || String(e));
        } finally {
            setBusy(false);
        }
    }

    useEffect(() => {
        setSelected(null);
    }, [refreshNonce]);

    useEffect(() => {
        if (!web3 || !account) return;
        loadActiveOffers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [web3, account, chainId, refreshNonce]);

    useEffect(() => {
        if (!web3 || !account) return;
        if (Number(chainId) !== Number(expectedChainId)) return;

        let cancelled = false;

        async function initBlock() {
            try {
                const latest = await web3.eth.getBlockNumber();
                lastBlockRef.current = latest;
            } catch {
                lastBlockRef.current = null;
            }
        }

        async function tick() {
            try {
                if (cancelled) return;

                const latest = await web3.eth.getBlockNumber();
                const last = lastBlockRef.current;

                if (last === null || last === undefined) {
                    lastBlockRef.current = latest;
                    return;
                }

                if (latest <= last) return;

                const fromBlock = last + 1;
                const toBlock = latest;

                const topic0OfferCreated = web3.utils.keccak256("OfferCreated(address,uint256,address,uint256,uint256)");
                const topic0OfferCanceled = web3.utils.keccak256("OfferCanceled(address,uint256,address,uint256)");
                const topic0OfferPriceUpdated = web3.utils.keccak256("OfferPriceUpdated(address,uint256,address,uint256,uint256)");
                const topic0Purchased = web3.utils.keccak256("Purchased(address,uint256,address,address,uint256,address,uint256,uint256)");

                const logs = await web3.eth.getPastLogs({
                    address: marketplaceAddr,
                    fromBlock,
                    toBlock,
                    topics: [[topic0OfferCreated, topic0OfferCanceled, topic0OfferPriceUpdated, topic0Purchased]],
                });

                if (logs && logs.length > 0) {
                    await loadActiveOffers();
                }

                lastBlockRef.current = latest;
            } catch {
                // ignore transient RPC issues; next tick will retry
            }
        }

        initBlock();
        const id = setInterval(tick, 2000);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [web3, account, chainId, refreshNonce, marketplaceAddr]);

    if (selected) {
        return (
            <OfferDetailsPage
                offer={selected}
                knyDecimals={knyDecimals}
                knySymbol={knySymbol}
                onBack={() => setSelected(null)}
                onAfterPurchase={loadActiveOffers}
            />
        );
    }

    return (
        <div className="container">
            <PageHeader title="Market" />

            <div className="card">
                <div><b>Marketplace:</b> <span className="mono">{marketplaceAddr}</span></div>
                <div style={{ marginTop: 8, fontSize: 12 }} className="muted-2">
                    Expected ChainId: {expectedChainId}
                </div>
            </div>

            {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}

            {(account || chainId !== null) && (
                <div style={{ marginTop: 16, fontSize: 12 }} className="muted-2">
                    {account && <div>Account: <span className="mono">{account}</span></div>}
                    {chainId !== null && <div>ChainId: {chainId}</div>}
                    {!chainOk && <div className="error">Wrong network.</div>}
                </div>
            )}

            <div style={{ marginTop: 16 }}>
                {offers.length === 0 ? (
                    <div style={{ fontSize: 12 }} className="muted-2">
                        {busy ? "Loading offers..." : "No active offers."}
                    </div>
                ) : (
                    offers.map((o) => {
                        const pricePretty =
                            knyDecimals !== null
                                ? `${formatUnits(o.price, knyDecimals)} ${knySymbol || "KNY"}`
                                : String(o.price);

                        return (
                            <div
                                key={`${o.nft}-${o.tokenId}`}
                                className="card"
                                style={{ marginTop: 12 }}
                            >
                                <div><b>NFT:</b> <span className="mono">{o.nft}</span></div>
                                <div><b>TokenId:</b> {o.tokenId}</div>
                                <div><b>Seller:</b> <span className="mono">{o.seller}</span></div>
                                <div><b>Price:</b> {pricePretty}</div>
                                <div style={{ marginTop: 8, fontSize: 12 }} className="muted-2">
                                    CreatedAt: {o.createdAt} ({new Date(Number(o.createdAt) * 1000).toLocaleString()})
                                </div>

                                <button
                                    onClick={() => setSelected(o)}
                                    disabled={busy}
                                    className="btn"
                                    style={{ marginTop: 10 }}
                                >
                                    Details / Purchase
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
