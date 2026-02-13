import { useContext, useEffect, useMemo, useRef, useState } from "react";
import contracts from "../../config/contracts.json";
import Web3 from "web3";
import { AppContext } from "../context/appContext";
import { formatUnits, getKny, getMarketplace, getSongNFT, parseUnits } from "../lib/contracts";
import PageHeader from "../components/layout/PageHeader";

export default function ProfilePage() {
    const { web3, account, chainId, disconnect, refreshNonce, bumpRefresh } = useContext(AppContext);

    const expectedChainId = contracts.chainId;
    const chainOk = chainId !== null && Number(chainId) === Number(expectedChainId);

    const marketplaceAddr = useMemo(() => contracts.marketplace, []);
    const nftAddr = useMemo(() => contracts.songNft, []);

    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const [songMarketplace, setSongMarketplace] = useState(null);
    const [approvedForAll, setApprovedForAll] = useState(null);

    const [ethBalance, setEthBalance] = useState(null);
    const [knyBalance, setKnyBalance] = useState(null);
    const [knyDecimals, setKnyDecimals] = useState(null);
    const [knySymbol, setKnySymbol] = useState(null);

    const [myAssets, setMyAssets] = useState([]);
    const [pricesByTokenId, setPricesByTokenId] = useState({});
    const [busyTokenId, setBusyTokenId] = useState(null);

    const [approveTx, setApproveTx] = useState(null);
    const [offerTx, setOfferTx] = useState(null);
    const [actionLabel, setActionLabel] = useState(null);

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
            const kny = getKny(web3);
            const mp = getMarketplace(web3);

            const [mpAddr, allOk, ethWei, bal, decimals, symbol] = await Promise.all([
                song.methods.marketplace().call(),
                song.methods.isApprovedForAll(account, marketplaceAddr).call(),
                web3.eth.getBalance(account),
                kny.methods.balanceOf(account).call(),
                kny.methods.decimals().call(),
                kny.methods.symbol().call(),
            ]);

            setSongMarketplace(mpAddr);
            setApprovedForAll(Boolean(allOk));
            setEthBalance(Web3.utils.fromWei(String(ethWei), "ether"));
            setKnyBalance(bal);
            setKnyDecimals(Number(decimals));
            setKnySymbol(symbol);

            const tokenIds = await loadTokenIdsByEvents(account);
            if (tokenIds.length === 0) {
                setMyAssets([]);
                return;
            }

            const owners = await Promise.all(
                tokenIds.map(async (id) => {
                    try {
                        return await song.methods.ownerOf(id).call();
                    } catch {
                        return null;
                    }
                })
            );

            const ownedIds = tokenIds.filter((id, i) => {
                const owner = owners[i];
                return owner && owner.toLowerCase() === account.toLowerCase();
            });

            const ownedAssets = await Promise.all(
                ownedIds.map(async (id) => {
                    const [tokenURI, tokenApproved, offer] = await Promise.all([
                        song.methods.tokenURI(id).call().catch(() => "(unavailable)"),
                        song.methods.getApproved(id).call().catch(() => "0x0000000000000000000000000000000000000000"),
                        mp.methods.saleOffers(nftAddr, id).call().catch(() => null),
                    ]);

                    const offerSeller = offer?.seller ?? offer?.[0];
                    const offerPrice = offer?.price ?? offer?.[1];
                    const offerCreatedAt = offer?.createdAt ?? offer?.[2];

                    return {
                        tokenId: id,
                        tokenURI,
                        tokenApproved,
                        offer: {
                            seller: offerSeller ?? "0x0000000000000000000000000000000000000000",
                            price: offerPrice ?? "0",
                            createdAt: offerCreatedAt ?? "0",
                        },
                    };
                })
            );

            setMyAssets(ownedAssets);
        } catch (e) {
            setError(e?.message || String(e));
        } finally {
            setRefreshing(false);
        }
    }

    useEffect(() => {
        setApproveTx(null);
        setOfferTx(null);
        setBusyTokenId(null);
        setActionLabel(null);
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

    async function onCreateOffer(tokenId) {
        try {
            setError(null);
            setOfferTx(null);
            setApproveTx(null);
            setBusy(true);
            setBusyTokenId(tokenId);
            setActionLabel("Preparing...");

            if (!web3 || !account) throw new Error("Not connected");
            if (!chainOk) throw new Error(`Wrong network (expected chainId ${expectedChainId})`);

            // Ensure NFT approval (single-token approve) before createOffer.
            setActionLabel("Checking approval...");
            const song = getSongNFT(web3);
            const mp = getMarketplace(web3);

            const [approvedAll, approvedAddr] = await Promise.all([
                song.methods.isApprovedForAll(account, marketplaceAddr).call(),
                song.methods.getApproved(tokenId).call(),
            ]);

            const approvedOk =
                Boolean(approvedAll) ||
                String(approvedAddr || "").toLowerCase() === marketplaceAddr.toLowerCase();

            if (!approvedOk) {
                setActionLabel("Approving NFT...");
                const receiptApprove = await song.methods.approve(marketplaceAddr, tokenId).send({ from: account });
                setApproveTx(receiptApprove.transactionHash);
            }

            const decimals = knyDecimals ?? 18;
            const uiPrice = pricesByTokenId[tokenId] ?? "10";
            const price = parseUnits(uiPrice, decimals);
            if (BigInt(price) <= 0n) throw new Error("Price must be positive");

            setActionLabel("Creating offer...");
            const receipt = await mp.methods.createOffer(nftAddr, tokenId, price).send({ from: account });
            setOfferTx(receipt.transactionHash);
            bumpRefresh();
        } catch (e) {
            setError(e?.message || String(e));
        } finally {
            setBusy(false);
            setBusyTokenId(null);
            setActionLabel(null);
        }
    }

    return (
        <div className="container">
            <PageHeader
                title="Profile"
                right={<button onClick={disconnect} className="btn btn-ghost">Disconnect</button>}
            />

            <div className="card">
                <div className="row">
                    <div className="pill">
                        <span className="muted-2">ETH</span>
                        <span style={{ fontWeight: 700 }}>{ethBalance ?? "-"}</span>
                    </div>
                    <div className="pill">
                        <span className="muted-2">{knySymbol || "KNY"}</span>
                        <span style={{ fontWeight: 700 }}>
                            {knyBalance !== null && knyDecimals !== null ? formatUnits(knyBalance, knyDecimals) : "-"}
                        </span>
                    </div>
                    {refreshing && <div className="pill">Syncing…</div>}
                </div>

                <div style={{ marginTop: 10, fontSize: 12 }} className="muted-2">
                    <div>Account: <span className="mono">{account}</span></div>
                    <div>ChainId: {chainId}</div>
                    {!chainOk && <div className="error">Wrong network. Switch MetaMask to chainId {expectedChainId}.</div>}
                </div>

                <div style={{ marginTop: 10, fontSize: 12 }} className="muted-2">
                    <div>Marketplace: <span className="mono">{marketplaceAddr}</span></div>
                    <div>SongNFT: <span className="mono">{nftAddr}</span></div>
                    {songMarketplace && (
                        <div>SongNFT.marketplace(): <span className="mono">{songMarketplace}</span></div>
                    )}
                    {approvedForAll !== null && (
                        <div>isApprovedForAll: {approvedForAll ? "true" : "false"}</div>
                    )}
                </div>
            </div>

            {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}

            <div className="card" style={{ marginTop: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>My Assets</h3>

                {approveTx && (
                    <div style={{ marginTop: 10, fontSize: 12 }}>
                        <b>Approve tx:</b> <span className="mono">{approveTx}</span>
                    </div>
                )}

                {offerTx && (
                    <div style={{ marginTop: 10, fontSize: 12 }}>
                        <b>CreateOffer tx:</b> <span className="mono">{offerTx}</span>
                    </div>
                )}

                {actionLabel && (
                    <div style={{ marginTop: 10, fontSize: 12 }} className="muted-2">
                        {actionLabel}
                    </div>
                )}

                <div style={{ marginTop: 12 }}>
                    {myAssets.length === 0 ? (
                        <div style={{ fontSize: 12 }} className="muted-2">
                            {refreshing ? "Loading assets..." : "No assets yet."}
                        </div>
                    ) : (
                        myAssets.map((a) => {
                            const tokenApprovedOk =
                                (a.tokenApproved || "").toLowerCase() === marketplaceAddr.toLowerCase();
                            const approvedOk = Boolean(approvedForAll) || tokenApprovedOk;

                            const offerSeller = (a.offer?.seller || "").toLowerCase();
                            const hasOffer = offerSeller !== "" && offerSeller !== "0x0000000000000000000000000000000000000000";
                            const offerPricePretty =
                                hasOffer && knyDecimals !== null ? formatUnits(a.offer.price, knyDecimals) : null;

                            const rowBusy = busy && String(busyTokenId) === String(a.tokenId);

                            return (
                                <div key={a.tokenId} className="card" style={{ marginTop: 12 }}>
                                    <div className="row">
                                        <div>
                                            <div><b>TokenId:</b> {a.tokenId}</div>
                                            <div style={{ marginTop: 4, fontSize: 12 }} className="muted-2">
                                                tokenURI: <span className="mono">{a.tokenURI}</span>
                                            </div>
                                            <div style={{ marginTop: 4, fontSize: 12 }} className="muted-2">
                                                Approved: {approvedOk ? "yes" : "no"}{" "}
                                                <span className="muted-2">
                                                    ({approvedForAll ? "approvalForAll" : "tokenApproval"})
                                                </span>
                                            </div>
                                            {hasOffer && (
                                                <div style={{ marginTop: 6, fontSize: 12 }}>
                                                    <b>Active offer:</b>{" "}
                                                    {offerPricePretty !== null ? `${offerPricePretty} ${knySymbol || "KNY"}` : String(a.offer.price)}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ marginTop: 10 }}>
                                        <div style={{ marginTop: 10 }}>
                                            <label className="label">
                                                Price ({knyDecimals !== null ? `${knySymbol || "KNY"}, decimals=${knyDecimals}` : (knySymbol || "KNY")})
                                            </label>
                                            <input
                                                value={pricesByTokenId[a.tokenId] ?? "10"}
                                                onChange={(e) =>
                                                    setPricesByTokenId((prev) => ({ ...prev, [a.tokenId]: e.target.value }))
                                                }
                                                placeholder="e.g. 10"
                                                className="input"
                                            />
                                        </div>

                                        <button
                                            onClick={() => onCreateOffer(a.tokenId)}
                                            disabled={!chainOk || busy}
                                            className="btn btn-primary"
                                            style={{ marginTop: 10 }}
                                        >
                                            {rowBusy ? "Working..." : "List for sale"}
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
