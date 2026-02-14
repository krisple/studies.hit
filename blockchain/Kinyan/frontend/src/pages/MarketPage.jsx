import { useContext, useEffect, useMemo, useRef, useState } from "react";
import contracts from "../../config/contracts.json";
import { fetchMetadata, extractDisplayNameFromUri } from "../lib/metadata";
import { formatUnits, getKny, getMarketplace, getSongNFT } from "../lib/contracts";
import { AppContext } from "../context/appContext";
import StickyHeader from "../components/layout/StickyHeader";
import TokenHistoryPage from "./TokenHistoryPage";
import SongBasics from "../components/SongBasics";

export default function MarketPage() {
    const { web3, account, chainId, refreshNonce, bumpRefresh } = useContext(AppContext);

    const [error, setError] = useState(null);
    const [offers, setOffers] = useState([]);
    const [historyTarget, setHistoryTarget] = useState(null);
    const [knyDecimals, setKnyDecimals] = useState(null);
    const [knySymbol, setKnySymbol] = useState(null);
    const [busy, setBusy] = useState(false);
    const [actionByKey, setActionByKey] = useState({});

    const [metaByKey, setMetaByKey] = useState({}); // key -> { tokenURI, meta, loading, error }

    const expectedChainId = contracts.chainId;
    const chainOk = chainId !== null && Number(chainId) === Number(expectedChainId);

    const marketplaceAddr = useMemo(() => contracts.marketplace, []);
    const songNftAddrLower = useMemo(() => String(contracts.songNft).toLowerCase(), []);
    const lastBlockRef = useRef(null);

    function offerKey(o) {
        return `${String(o.nft).toLowerCase()}:${String(o.tokenId)}`;
    }

    function isSongOffer(o) {
        return String(o.nft).toLowerCase() === songNftAddrLower;
    }

    function withTimeout(promise, ms, label) {
        let id = null;
        const timeout = new Promise((_, reject) => {
            id = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
        });
        return Promise.race([promise, timeout]).finally(() => clearTimeout(id));
    }

    async function loadOfferMetadata(o, { force = false } = {}) {
        const key = offerKey(o);

        if (!web3 || !account) return;
        if (!chainOk) return;
        if (!isSongOffer(o)) {
            setMetaByKey((prev) => ({
                ...prev,
                [key]: {
                    ...(prev[key] || {}),
                    loading: false,
                    error: "Unsupported NFT contract for metadata (not SongNFT)",
                },
            }));
            return;
        }

        const current = metaByKey[key];
        if (!force) {
            if (current?.loading) return;
            if (current?.meta) return;
        }

        setMetaByKey((prev) => ({
            ...prev,
            [key]: { ...(prev[key] || {}), loading: true, error: null },
        }));

        try {
            const song = getSongNFT(web3);
            const tokenURI = await withTimeout(
                song.methods.tokenURI(o.tokenId).call(),
                8000,
                "tokenURI()"
            );

            setMetaByKey((prev) => ({
                ...prev,
                [key]: { ...(prev[key] || {}), tokenURI, loading: true, error: null },
            }));

            const md = await fetchMetadata(tokenURI);

            setMetaByKey((prev) => ({
                ...prev,
                [key]: {
                    ...(prev[key] || {}),
                    tokenURI,
                    meta: md.ok ? md.data : null,
                    error: md.ok ? null : md.error,
                    loading: false,
                },
            }));
        } catch (e) {
            setMetaByKey((prev) => ({
                ...prev,
                [key]: {
                    ...(prev[key] || {}),
                    error: e?.message || String(e),
                    loading: false,
                },
            }));
        }
    }

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
        setHistoryTarget(null);
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

    useEffect(() => {
        if (!web3 || !account) return;
        if (!chainOk) return;
        if (!offers || offers.length === 0) return;

        let cancelled = false;

        async function run() {
            for (const o of offers) {
                if (cancelled) return;
                const key = offerKey(o);

                if (metaByKey[key]?.loading || metaByKey[key]?.meta) continue;
                if (!isSongOffer(o)) continue;

                // Load tokenURI + metadata with timeout/error handling.
                await loadOfferMetadata(o, { force: false });
            }
        }

        run();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offers, web3, account, chainId, chainOk, refreshNonce]);

    async function onPurchase(o) {
        const key = offerKey(o);
        try {
            setError(null);
            setActionByKey((prev) => ({ ...prev, [key]: "Preparing..." }));
            if (!web3 || !account) return;
            if (!chainOk) return;

            const kny = getKny(web3);
            const mp = getMarketplace(web3);

            const allowance = await kny.methods.allowance(account, marketplaceAddr).call();
            if (BigInt(allowance) < BigInt(o.price)) {
                setActionByKey((prev) => ({ ...prev, [key]: "Approving KNY..." }));
                await kny.methods.approve(marketplaceAddr, o.price).send({ from: account });
            }

            setActionByKey((prev) => ({ ...prev, [key]: "Purchasing..." }));
            await mp.methods.purchase(o.nft, o.tokenId).send({ from: account });

            setActionByKey((prev) => ({ ...prev, [key]: null }));
            bumpRefresh();
            await loadActiveOffers();
        } catch (e) {
            setActionByKey((prev) => ({ ...prev, [key]: null }));
            setError(e?.message || String(e));
        }
    }

    if (historyTarget) {
        return (
            <TokenHistoryPage
                nft={historyTarget.nft}
                tokenId={historyTarget.tokenId}
                onBack={() => setHistoryTarget(null)}
            />
        );
    }

    return (
        <div className="container">
            <StickyHeader title="Market"/>

            {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}

            {!chainOk && (
                <div className="card" style={{ marginTop: 12 }}>
                    <div className="error">Wrong network. Switch MetaMask to chainId {expectedChainId}.</div>
                </div>
            )}

            <div style={{ marginTop: 16 }}>
                {offers.length === 0 ? (
                    <div style={{ fontSize: 12 }} className="muted-2">
                        {busy ? "Loading offers..." : "No active offers."}
                    </div>
                ) : (
                    offers.map((o) => {
                        const key = offerKey(o);
                        const mdState = metaByKey[key];
                        const md = mdState?.meta;
                        const tokenUri = mdState?.tokenURI;
                        const displayName =
                            md?.name || extractDisplayNameFromUri(tokenUri) || `Token #${o.tokenId}`;

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
                                <SongBasics
                                    tokenId={o.tokenId}
                                    tokenURI={tokenUri || (isSongOffer(o) ? "(loading tokenURI...)" : "(not SongNFT)")}
                                    meta={md}
                                    titleFallback={displayName}
                                />

                                {mdState?.loading && tokenUri ? (
                                    <div style={{ marginTop: 10, fontSize: 12 }} className="muted-2">
                                        Loading metadata...
                                    </div>
                                ) : null}
                                {mdState?.error ? (
                                    <div style={{ marginTop: 10, fontSize: 12 }} className="error">
                                        Metadata load failed: {mdState.error}
                                    </div>
                                ) : null}

                                <div style={{ marginTop: 10 }}>
                                    <span className="pill">
                                        <span className="muted-2">Price</span>
                                        <span style={{ fontWeight: 800 }}>{pricePretty}</span>
                                    </span>
                                </div>

                                <div className="row" style={{ marginTop: 12 }}>
                                    <button
                                        onClick={() => onPurchase(o)}
                                        disabled={busy || !chainOk}
                                        className="btn btn-primary"
                                    >
                                        Purchase
                                    </button>
                                    <button
                                        onClick={() => setHistoryTarget({ nft: o.nft, tokenId: o.tokenId })}
                                        disabled={busy}
                                        className="btn"
                                    >
                                        History
                                    </button>
                                    {(mdState?.error || (isSongOffer(o) && !tokenUri)) ? (
                                        <button
                                            onClick={() => loadOfferMetadata(o, { force: true })}
                                            disabled={busy}
                                            className="btn"
                                        >
                                            Retry
                                        </button>
                                    ) : null}
                                </div>

                                {actionByKey[key] ? (
                                    <div style={{ marginTop: 10, fontSize: 12 }} className="muted-2">
                                        {actionByKey[key]}
                                    </div>
                                ) : null}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
