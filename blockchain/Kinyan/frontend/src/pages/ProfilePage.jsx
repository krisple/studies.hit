import { useContext, useEffect, useMemo, useRef, useState } from "react";
import contracts from "../../config/contracts.json";
import { AppContext } from "../context/appContext";
import { fetchMetadata, extractDisplayNameFromUri } from "../lib/metadata";
import { formatUnits, getMarketplace, getSongNFT, parseUnits } from "../lib/contracts";
import StickyHeader from "../components/layout/StickyHeader";
import TokenHistoryPage from "./TokenHistoryPage";
import useWalletBalances from "../lib/useWalletBalances";
import SongBasics from "../components/SongBasics";

export default function ProfilePage() {
    const { web3, account, chainId, disconnect, refreshNonce, bumpRefresh } = useContext(AppContext);
    const { decimals: knyDecimals, symbol: knySymbol } = useWalletBalances();

    const expectedChainId = contracts.chainId;
    const chainOk = chainId !== null && Number(chainId) === Number(expectedChainId);

    const marketplaceAddr = useMemo(() => contracts.marketplace, []);
    const nftAddr = useMemo(() => contracts.songNft, []);

    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const [myAssets, setMyAssets] = useState([]);
    const [pricesByTokenId, setPricesByTokenId] = useState({});
    const [actionByTokenId, setActionByTokenId] = useState({});
    const [historyTarget, setHistoryTarget] = useState(null);

    const [metaByTokenId, setMetaByTokenId] = useState({}); // tokenId -> { tokenURI, meta, loading, error }

    const lastBlockRef = useRef(null);

    async function loadTokenIdsByEvents(ownerAddress) {
        const ownerTopic = web3.eth.abi.encodeParameter("address", ownerAddress);

        const ownershipTopic0 = web3.utils.keccak256("OwnershipRecorded(uint256,address,uint256)");
        const registeredTopic0 = web3.utils.keccak256("SongRegistered(address,uint256,bytes32,uint256,string)");

        const [ownershipLogs, registeredLogs] = await Promise.all([
            web3.eth.getPastLogs({
                address: contracts.songNft,
                fromBlock: 0,
                toBlock: "latest",
                topics: [ownershipTopic0, null, ownerTopic],
            }),
            web3.eth.getPastLogs({
                address: contracts.songNft,
                fromBlock: 0,
                toBlock: "latest",
                topics: [registeredTopic0, ownerTopic],
            }),
        ]);

        const tokenIds = new Set();

        for (const l of ownershipLogs || []) {
            const tokenIdTopic = l.topics?.[1];
            if (!tokenIdTopic) continue;
            tokenIds.add(BigInt(tokenIdTopic).toString());
        }

        for (const l of registeredLogs || []) {
            const tokenIdTopic = l.topics?.[2];
            if (!tokenIdTopic) continue;
            tokenIds.add(BigInt(tokenIdTopic).toString());
        }

        return Array.from(tokenIds).sort((a, b) => Number(a) - Number(b));
    }

    async function loadAssetMetadata(tokenId, { force = false } = {}) {
        const id = String(tokenId);
        if (!web3 || !account) return;
        if (!chainOk) return;

        const current = metaByTokenId[id];
        if (!force) {
            if (current?.loading) return;
            if (current?.meta) return;
        }

        setMetaByTokenId((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), loading: true, error: null } }));

        try {
            const knownUri = myAssets.find((a) => String(a.tokenId) === id)?.tokenURI;
            const tokenURI =
                knownUri && knownUri !== "(unavailable)"
                    ? knownUri
                    : await getSongNFT(web3).methods.tokenURI(id).call();

            // Show tokenURI even if metadata fails.
            setMetaByTokenId((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), tokenURI, loading: true, error: null } }));

            const md = await fetchMetadata(tokenURI);
            setMetaByTokenId((prev) => ({
                ...prev,
                [id]: { ...(prev[id] || {}), tokenURI, meta: md.ok ? md.data : null, error: md.ok ? null : md.error, loading: false },
            }));
        } catch (e) {
            setMetaByTokenId((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), error: e?.message || String(e), loading: false } }));
        }
    }

    async function loadOwnedTokenIds(ownerAddress) {
        // Prefer event-based discovery (fewer RPC calls). If logs fail, fall back to scanning minted ids.
        try {
            const byLogs = await loadTokenIdsByEvents(ownerAddress);
            if (byLogs.length > 0) return byLogs;
        } catch {
            // fall back below
        }

        const song = getSongNFT(web3);
        const nextIdRaw = await song.methods.nextTokenId().call();
        const nextId = Number(nextIdRaw);
        if (!Number.isFinite(nextId) || nextId <= 1) return [];

        const maxScan = Math.min(nextId - 1, 250);
        const ids = [];
        for (let id = 1; id <= maxScan; id += 1) ids.push(String(id));
        return ids;
    }

    async function refreshProfile() {
        try {
            setError(null);
            if (!web3 || !account) return;
            if (!chainOk) return;

            setRefreshing(true);

            const [songCode, knyCode, mpCode] = await Promise.all([
                web3.eth.getCode(contracts.songNft),
                web3.eth.getCode(contracts.kny),
                web3.eth.getCode(contracts.marketplace),
            ]);
            if (songCode === "0x") throw new Error("No contract code at SongNFT address (stale contracts.json?)");
            if (knyCode === "0x") throw new Error("No contract code at KNY address (stale contracts.json?)");
            if (mpCode === "0x") throw new Error("No contract code at Marketplace address (stale contracts.json?)");

            const song = getSongNFT(web3);
            const mp = getMarketplace(web3);

            const candidateIds = await loadOwnedTokenIds(account);
            if (candidateIds.length === 0) {
                setMyAssets([]);
                return;
            }

            const owners = await Promise.all(
                candidateIds.map(async (id) => {
                    try {
                        return await song.methods.ownerOf(id).call();
                    } catch {
                        return null;
                    }
                })
            );

            const ownedIds = candidateIds.filter((id, i) => {
                const owner = owners[i];
                return owner && owner.toLowerCase() === account.toLowerCase();
            });

            if (ownedIds.length === 0) {
                setMyAssets([]);
                return;
            }

            const ownedAssets = await Promise.all(
                ownedIds.map(async (id) => {
                    const [tokenURI, offer] = await Promise.all([
                        song.methods.tokenURI(id).call().catch(() => "(unavailable)"),
                        mp.methods.saleOffers(nftAddr, id).call().catch(() => null),
                    ]);

                    const offerSeller = offer?.seller ?? offer?.[0];
                    const offerPrice = offer?.price ?? offer?.[1];
                    const offerCreatedAt = offer?.createdAt ?? offer?.[2];

                    return {
                        tokenId: id,
                        tokenURI,
                        offer: {
                            seller: offerSeller ?? "0x0000000000000000000000000000000000000000",
                            price: offerPrice ?? "0",
                            createdAt: offerCreatedAt ?? "0",
                        },
                    };
                })
            );

            setMyAssets(ownedAssets);

            setPricesByTokenId((prev) => {
                const next = { ...prev };
                for (const a of ownedAssets) {
                    if (next[a.tokenId] !== undefined) continue;
                    const hasOffer =
                        (a.offer?.seller || "").toLowerCase() !== "0x0000000000000000000000000000000000000000";
                    if (hasOffer && knyDecimals !== null) {
                        next[a.tokenId] = formatUnits(a.offer.price, knyDecimals);
                    } else {
                        next[a.tokenId] = "10";
                    }
                }
                return next;
            });
        } catch (e) {
            setError(e?.message || String(e));
        } finally {
            setRefreshing(false);
        }
    }

    useEffect(() => {
        setActionByTokenId({});
        setMetaByTokenId({});
        setHistoryTarget(null);
        setError(null);
    }, [refreshNonce]);

    useEffect(() => {
        if (!web3 || !account) return;
        if (!chainOk) return;
        refreshProfile();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [web3, account, chainId, refreshNonce]);

    useEffect(() => {
        if (!web3 || !account) return;
        if (!chainOk) return;
        if (!myAssets || myAssets.length === 0) return;

        let cancelled = false;

        async function run() {
            for (const a of myAssets) {
                if (cancelled) return;
                const tokenId = String(a.tokenId);
                if (metaByTokenId[tokenId]?.loading || metaByTokenId[tokenId]?.meta) continue;

                await loadAssetMetadata(tokenId, { force: false });
            }
        }

        run();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [myAssets, web3, account, chainId, refreshNonce]);

    useEffect(() => {
        if (!web3 || !account) return;
        if (!chainOk) return;

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

                const topic0SongRegistered = web3.utils.keccak256("SongRegistered(address,uint256,bytes32,uint256,string)");
                const topic0OwnershipRecorded = web3.utils.keccak256("OwnershipRecorded(uint256,address,uint256)");

                const topic0OfferCreated = web3.utils.keccak256("OfferCreated(address,uint256,address,uint256,uint256)");
                const topic0OfferCanceled = web3.utils.keccak256("OfferCanceled(address,uint256,address,uint256)");
                const topic0OfferPriceUpdated = web3.utils.keccak256("OfferPriceUpdated(address,uint256,address,uint256,uint256)");
                const topic0Purchased = web3.utils.keccak256("Purchased(address,uint256,address,address,uint256,address,uint256,uint256)");

                const [songLogs, mpLogs] = await Promise.all([
                    web3.eth.getPastLogs({
                        address: contracts.songNft,
                        fromBlock,
                        toBlock,
                        topics: [[topic0SongRegistered, topic0OwnershipRecorded]],
                    }),
                    web3.eth.getPastLogs({
                        address: contracts.marketplace,
                        fromBlock,
                        toBlock,
                        topics: [[topic0OfferCreated, topic0OfferCanceled, topic0OfferPriceUpdated, topic0Purchased]],
                    }),
                ]);

                if ((songLogs && songLogs.length > 0) || (mpLogs && mpLogs.length > 0)) {
                    await refreshProfile();
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
    }, [web3, account, chainId, refreshNonce]);

    async function ensureNftApproval(tokenId) {
        const song = getSongNFT(web3);
        const [approvedAll, approvedAddr] = await Promise.all([
            song.methods.isApprovedForAll(account, marketplaceAddr).call(),
            song.methods.getApproved(tokenId).call().catch(() => "0x0000000000000000000000000000000000000000"),
        ]);

        const approvedOk =
            Boolean(approvedAll) ||
            String(approvedAddr || "").toLowerCase() === marketplaceAddr.toLowerCase();

        if (!approvedOk) {
            await song.methods.approve(marketplaceAddr, tokenId).send({ from: account });
        }
    }

    async function onCreateOffer(tokenId) {
        const id = String(tokenId);
        try {
            setError(null);
            setActionByTokenId((prev) => ({ ...prev, [id]: "Preparing..." }));

            if (!web3 || !account) throw new Error("Not connected");
            if (!chainOk) throw new Error(`Wrong network (expected chainId ${expectedChainId})`);

            // Ensure NFT approval (single-token approve) before createOffer.
            setActionByTokenId((prev) => ({ ...prev, [id]: "Approving NFT (if needed)..." }));
            const mp = getMarketplace(web3);
            await ensureNftApproval(tokenId);

            const decimals = knyDecimals ?? 18;
            const uiPrice = pricesByTokenId[id] ?? "10";
            const price = parseUnits(uiPrice, decimals);
            if (BigInt(price) <= 0n) throw new Error("Price must be positive");

            setActionByTokenId((prev) => ({ ...prev, [id]: "Creating offer..." }));
            await mp.methods.createOffer(nftAddr, tokenId, price).send({ from: account });
            bumpRefresh();
            await refreshProfile();
        } catch (e) {
            setError(e?.message || String(e));
        } finally {
            setActionByTokenId((prev) => ({ ...prev, [id]: null }));
        }
    }

    async function onCancelOffer(tokenId) {
        const id = String(tokenId);
        try {
            setError(null);
            setActionByTokenId((prev) => ({ ...prev, [id]: "Canceling offer..." }));
            if (!web3 || !account) throw new Error("Not connected");
            if (!chainOk) throw new Error(`Wrong network (expected chainId ${expectedChainId})`);

            const mp = getMarketplace(web3);
            await mp.methods.cancelOffer(nftAddr, tokenId).send({ from: account });
            bumpRefresh();
            await refreshProfile();
        } catch (e) {
            setError(e?.message || String(e));
        } finally {
            setActionByTokenId((prev) => ({ ...prev, [id]: null }));
        }
    }

    async function onUpdateOfferPrice(tokenId) {
        const id = String(tokenId);
        try {
            setError(null);
            setActionByTokenId((prev) => ({ ...prev, [id]: "Updating price..." }));
            if (!web3 || !account) throw new Error("Not connected");
            if (!chainOk) throw new Error(`Wrong network (expected chainId ${expectedChainId})`);

            const decimals = knyDecimals ?? 18;
            const uiPrice = pricesByTokenId[id] ?? "10";
            const price = parseUnits(uiPrice, decimals);
            if (BigInt(price) <= 0n) throw new Error("Price must be positive");

            const mp = getMarketplace(web3);
            await mp.methods.updateOfferPrice(nftAddr, tokenId, price).send({ from: account });
            bumpRefresh();
            await refreshProfile();
        } catch (e) {
            setError(e?.message || String(e));
        } finally {
            setActionByTokenId((prev) => ({ ...prev, [id]: null }));
        }
    }

    function getTrait(meta, keys) {
        if (!meta?.traits) return null;
        const lowerToKey = new Map(Array.from(meta.traits.keys()).map((k) => [String(k).toLowerCase(), k]));
        for (const k of keys) {
            const real = lowerToKey.get(String(k).toLowerCase());
            if (!real) continue;
            const v = meta.traits.get(real);
            if (v === undefined || v === null || v === "") continue;
            return String(v);
        }
        return null;
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
            <StickyHeader
                title="Profile"
                right={<button onClick={disconnect} className="btn btn-ghost">Disconnect</button>}
            />

            <div className="card" style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12 }} className="muted-2">
                    <div><b>Account:</b> <span className="mono">{account}</span></div>
                    <div style={{ marginTop: 4 }}><b>ChainId:</b> {chainId}</div>
                    {!chainOk && (
                        <div style={{ marginTop: 8 }} className="error">
                            Wrong network. Switch MetaMask to chainId {expectedChainId}.
                        </div>
                    )}
                </div>
            </div>

            {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}

            <div className="card" style={{ marginTop: 16 }}>
                <div className="row">
                    <h3 style={{ margin: 0, fontSize: 18 }}>My Assets</h3>
                    {refreshing && <span className="pill">Syncing…</span>}
                </div>

                <div style={{ marginTop: 12 }}>
                    {myAssets.length === 0 ? (
                        <div style={{ fontSize: 12 }} className="muted-2">
                            {refreshing ? "Loading assets..." : "No assets yet."}
                        </div>
                    ) : (
                        myAssets.map((a) => {
                            const offerSeller = (a.offer?.seller || "").toLowerCase();
                            const hasOffer = offerSeller !== "" && offerSeller !== "0x0000000000000000000000000000000000000000";
                            const offerPricePretty =
                                hasOffer && knyDecimals !== null ? formatUnits(a.offer.price, knyDecimals) : null;

                            const tokenId = String(a.tokenId);
                            const mdState = metaByTokenId[tokenId];
                            const md = mdState?.meta;
                            const tokenUri = mdState?.tokenURI ?? a.tokenURI;

                            const displayName =
                                md?.name || extractDisplayNameFromUri(tokenUri) || `Token #${a.tokenId}`;

                            const genre = getTrait(md, ["genre", "Genre"]);

                            const action = actionByTokenId[tokenId];

                            return (
                                <div
                                    key={a.tokenId}
                                    className="card"
                                    style={{
                                        marginTop: 12,
                                        borderColor: hasOffer ? "rgba(124, 92, 255, 0.55)" : "var(--border)",
                                        boxShadow: hasOffer ? "0 14px 38px rgba(124, 92, 255, 0.12)" : "var(--shadow)",
                                    }}
                                >
                                    <SongBasics
                                        tokenId={a.tokenId}
                                        tokenURI={tokenUri}
                                        meta={md}
                                        titleFallback={displayName}
                                    />

                                    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                                        {genre ? (
                                            <span className="pill">
                                                <span className="muted-2">Genre</span> {genre}
                                            </span>
                                        ) : null}
                                        {hasOffer ? (
                                            <span
                                                className="pill"
                                                style={{
                                                    color: "white",
                                                    background: "linear-gradient(180deg, var(--primary), var(--primary-2))",
                                                    borderColor: "rgba(124, 92, 255, 0.6)",
                                                }}
                                            >
                                                For sale:{" "}
                                                {offerPricePretty !== null
                                                    ? `${offerPricePretty} ${knySymbol || "KNY"}`
                                                    : `${a.offer.price} ${knySymbol || "KNY"}`}
                                            </span>
                                        ) : null}
                                    </div>

                                    {mdState?.loading && tokenUri ? (
                                        <div style={{ marginTop: 8, fontSize: 12 }} className="muted-2">
                                            Loading metadata...
                                        </div>
                                    ) : null}
                                    {mdState?.error ? (
                                        <div style={{ marginTop: 8, fontSize: 12 }} className="error">
                                            Metadata load failed: {mdState.error}
                                        </div>
                                    ) : null}

                                    <div style={{ marginTop: 12 }}>
                                        <label className="label">Price ({knySymbol || "KNY"})</label>
                                        <input
                                            value={pricesByTokenId[tokenId] ?? "10"}
                                            onChange={(e) =>
                                                setPricesByTokenId((prev) => ({ ...prev, [tokenId]: e.target.value }))
                                            }
                                            placeholder="e.g. 10"
                                            className="input"
                                        />
                                    </div>

                                    <div className="row" style={{ marginTop: 12 }}>
                                        {!hasOffer ? (
                                            <button
                                                onClick={() => onCreateOffer(a.tokenId)}
                                                disabled={!chainOk || Boolean(action)}
                                                className="btn btn-primary"
                                            >
                                                List for sale
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => onUpdateOfferPrice(a.tokenId)}
                                                    disabled={!chainOk || Boolean(action)}
                                                    className="btn btn-primary"
                                                >
                                                    Update price
                                                </button>
                                                <button
                                                    onClick={() => onCancelOffer(a.tokenId)}
                                                    disabled={!chainOk || Boolean(action)}
                                                    className="btn"
                                                >
                                                    Remove offer
                                                </button>
                                            </>
                                        )}

                                        <button
                                            onClick={() => setHistoryTarget({ nft: nftAddr, tokenId: a.tokenId })}
                                            disabled={Boolean(action)}
                                            className="btn"
                                        >
                                            History
                                        </button>
                                        {mdState?.error ? (
                                            <button
                                                onClick={() => loadAssetMetadata(a.tokenId, { force: true })}
                                                disabled={Boolean(action)}
                                                className="btn"
                                            >
                                                Retry
                                            </button>
                                        ) : null}
                                    </div>

                                    {action ? (
                                        <div style={{ marginTop: 10, fontSize: 12 }} className="muted-2">
                                            {action}
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
