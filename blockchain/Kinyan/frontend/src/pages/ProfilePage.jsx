import { useMemo, useState } from "react";
import contracts from "../../config/contracts.json";
import { connectMetaMask, hasMetaMask } from "../lib/web3";
import { formatUnits, getKny, getMarketplace, getSongNFT, parseUnits } from "../lib/contracts";

export default function ProfilePage() {
    const [account, setAccount] = useState(null);
    const [chainId, setChainId] = useState(null);
    const [error, setError] = useState(null);

    const [songMarketplace, setSongMarketplace] = useState(null);
    const [approvedForAll, setApprovedForAll] = useState(null);
    const [knyDecimals, setKnyDecimals] = useState(null);

    const [approveTx, setApproveTx] = useState(null);
    const [offerTx, setOfferTx] = useState(null);
    const [busy, setBusy] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const [myAssets, setMyAssets] = useState([]);
    const [assetSummary, setAssetSummary] = useState(null);
    const [pricesByTokenId, setPricesByTokenId] = useState({});
    const [busyTokenId, setBusyTokenId] = useState(null);

    const mm = hasMetaMask();
    const expectedChainId = contracts.chainId;
    const chainOk = chainId !== null && Number(chainId) === Number(expectedChainId);

    const marketplaceAddr = useMemo(() => contracts.marketplace, []);
    const nftAddr = useMemo(() => contracts.songNft, []);

    async function loadTokenIdsByEvents(web3, ownerAddress) {
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

    async function ensureWallet() {
        const { web3, account, chainId } = await connectMetaMask();
        setAccount(account);
        setChainId(chainId);
        return { web3, account, chainId };
    }

    async function refreshStatus() {
        try {
            setError(null);
            setRefreshing(true);
            setAssetSummary(null);

            const { web3, account, chainId } = await ensureWallet();
            if (Number(chainId) !== Number(expectedChainId)) {
                throw new Error(`Wrong network (expected chainId ${expectedChainId})`);
            }

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

            const baseCalls = await Promise.allSettled([
                song.methods.marketplace().call(),
                song.methods.isApprovedForAll(account, marketplaceAddr).call(),
                kny.methods.decimals().call(),
            ]);

            const mpAddr = baseCalls[0].status === "fulfilled" ? baseCalls[0].value : null;
            const allOk = baseCalls[1].status === "fulfilled" ? baseCalls[1].value : null;
            const decimalsRaw = baseCalls[2].status === "fulfilled" ? baseCalls[2].value : null;

            const decimals = decimalsRaw !== null ? Number(decimalsRaw) : 18;

            const tokenIds = await loadTokenIdsByEvents(web3, account);
            if (tokenIds.length === 0) {
                setSongMarketplace(mpAddr);
                setApprovedForAll(Boolean(allOk));
                setKnyDecimals(decimals);
                setMyAssets([]);
                setAssetSummary({ tokenIdsFound: 0, ownedNow: 0 });
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

            setSongMarketplace(mpAddr);
            setApprovedForAll(Boolean(allOk));
            setKnyDecimals(decimals);
            setMyAssets(ownedAssets);
            setAssetSummary({ tokenIdsFound: tokenIds.length, ownedNow: ownedAssets.length });
        } catch (e) {
            setError(e?.message || String(e));
            // Keep previous list on failure (avoid "everything disappears" UX).
        } finally {
            setRefreshing(false);
        }
    }

    async function onApproveAll() {
        try {
            setError(null);
            setApproveTx(null);
            setBusy(true);

            const { web3, account, chainId } = await ensureWallet();
            if (Number(chainId) !== Number(expectedChainId)) {
                throw new Error(`Wrong network (expected chainId ${expectedChainId})`);
            }

            const song = getSongNFT(web3);
            const receipt = await song.methods.setApprovalForAll(marketplaceAddr, true).send({ from: account });
            setApproveTx(receipt.transactionHash);

            await refreshStatus();
        } catch (e) {
            setError(e?.message || String(e));
        } finally {
            setBusy(false);
        }
    }

    async function onApproveToken(tokenId) {
        try {
            setError(null);
            setApproveTx(null);
            setBusy(true);
            setBusyTokenId(tokenId);

            const { web3, account, chainId } = await ensureWallet();
            if (Number(chainId) !== Number(expectedChainId)) {
                throw new Error(`Wrong network (expected chainId ${expectedChainId})`);
            }

            const song = getSongNFT(web3);
            const receipt = await song.methods.approve(marketplaceAddr, tokenId).send({ from: account });
            setApproveTx(receipt.transactionHash);

            await refreshStatus();
        } catch (e) {
            setError(e?.message || String(e));
        } finally {
            setBusy(false);
            setBusyTokenId(null);
        }
    }

    async function onCreateOffer(tokenId) {
        try {
            setError(null);
            setOfferTx(null);
            setBusy(true);
            setBusyTokenId(tokenId);

            const { web3, account, chainId } = await ensureWallet();
            if (Number(chainId) !== Number(expectedChainId)) {
                throw new Error(`Wrong network (expected chainId ${expectedChainId})`);
            }

            const decimals = knyDecimals ?? 18;
            const uiPrice = pricesByTokenId[tokenId] ?? "10";
            const price = parseUnits(uiPrice, decimals);
            if (BigInt(price) <= 0n) throw new Error("Price must be positive");

            const mp = getMarketplace(web3);
            const receipt = await mp.methods.createOffer(nftAddr, tokenId, price).send({ from: account });
            setOfferTx(receipt.transactionHash);

            await refreshStatus();
        } catch (e) {
            setError(e?.message || String(e));
        } finally {
            setBusy(false);
            setBusyTokenId(null);
        }
    }

    return (
        <div style={{ padding: 16, fontFamily: "system-ui" }}>
            <h2>Profile</h2>

            <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
                <div><b>Marketplace:</b> {marketplaceAddr}</div>
                <div><b>SongNFT:</b> {nftAddr}</div>
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                    Expected ChainId: {expectedChainId}
                </div>
            </div>

            {!mm && (
                <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 8, color: "crimson" }}>
                    MetaMask not detected.
                </div>
            )}

            <button
                onClick={refreshStatus}
                disabled={!mm || busy || refreshing}
                style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, cursor: "pointer" }}
            >
                {refreshing ? "Refreshing..." : "Refresh my assets"}
            </button>

            {error && <div style={{ marginTop: 12, color: "crimson" }}>{error}</div>}

            {(account || chainId !== null) && (
                <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
                    {account && <div><b>Account:</b> {account}</div>}
                    {chainId !== null && <div><b>ChainId:</b> {chainId}</div>}
                    {!chainOk && (
                        <div style={{ marginTop: 10, color: "crimson" }}>
                            Wrong network. Switch MetaMask to chainId {expectedChainId}.
                        </div>
                    )}

                    {songMarketplace && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee" }}>
                            <div><b>SongNFT.marketplace():</b> {songMarketplace}</div>
                            {songMarketplace.toLowerCase() !== marketplaceAddr.toLowerCase() && (
                                <div style={{ marginTop: 8, color: "crimson" }}>
                                    Mismatch: SongNFT points to a different marketplace address.
                                </div>
                            )}
                        </div>
                    )}

                    {approvedForAll !== null && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee" }}>
                            <div><b>isApprovedForAll(Marketplace):</b> {approvedForAll ? "true" : "false"}</div>
                        </div>
                    )}
                </div>
            )}

            <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Sell (My Assets)</h3>

                <button
                    onClick={onApproveAll}
                    disabled={!mm || busy || !chainOk}
                    style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, cursor: "pointer" }}
                >
                    setApprovalForAll(Marketplace, true)
                </button>

                {approveTx && (
                    <div style={{ marginTop: 10, fontSize: 12 }}>
                        <b>Approve tx:</b> {approveTx}
                    </div>
                )}

                {offerTx && (
                    <div style={{ marginTop: 10, fontSize: 12 }}>
                        <b>CreateOffer tx:</b> {offerTx}
                    </div>
                )}

                {assetSummary && (
                    <div style={{ marginTop: 12, fontSize: 12, opacity: 0.85 }}>
                        Found tokenIds: {assetSummary.tokenIdsFound}, owned now: {assetSummary.ownedNow}
                    </div>
                )}

                <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
                    Marketplace requires either <code>getApproved(tokenId)</code> == marketplace or{" "}
                    <code>isApprovedForAll(owner, marketplace)</code> == true.
                </div>

                <div style={{ marginTop: 12 }}>
                    {myAssets.length === 0 ? (
                        <div style={{ fontSize: 12, opacity: 0.8 }}>
                            No assets loaded yet (or you don&apos;t own any in the scanned range).
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
                                <div
                                    key={a.tokenId}
                                    style={{ marginTop: 12, padding: 12, border: "1px solid #eee", borderRadius: 8 }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                                        <div>
                                            <div><b>TokenId:</b> {a.tokenId}</div>
                                            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}>
                                                tokenURI: <code>{a.tokenURI}</code>
                                            </div>
                                            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}>
                                                Approved: {approvedOk ? "yes" : "no"}{" "}
                                                <span style={{ opacity: 0.7 }}>
                                                    ({approvedForAll ? "approvalForAll" : "tokenApproval"})
                                                </span>
                                            </div>
                                            {hasOffer && (
                                                <div style={{ marginTop: 6, fontSize: 12 }}>
                                                    <b>Active offer:</b>{" "}
                                                    {offerPricePretty !== null ? `${offerPricePretty} KNY` : String(a.offer.price)}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ marginTop: 10 }}>
                                        <button
                                            onClick={() => onApproveToken(a.tokenId)}
                                            disabled={!mm || !chainOk || busy}
                                            style={{ padding: "8px 12px", borderRadius: 8, cursor: "pointer" }}
                                        >
                                            approve(Marketplace, tokenId)
                                        </button>

                                        <div style={{ marginTop: 10 }}>
                                            <label style={{ display: "block", fontSize: 12, opacity: 0.8 }}>
                                                Price ({knyDecimals !== null ? `KNY, decimals=${knyDecimals}` : "KNY"})
                                            </label>
                                            <input
                                                value={pricesByTokenId[a.tokenId] ?? "10"}
                                                onChange={(e) =>
                                                    setPricesByTokenId((prev) => ({ ...prev, [a.tokenId]: e.target.value }))
                                                }
                                                placeholder="e.g. 10"
                                                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
                                            />
                                        </div>

                                        <button
                                            onClick={() => onCreateOffer(a.tokenId)}
                                            disabled={!mm || !chainOk || busy}
                                            style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, cursor: "pointer" }}
                                        >
                                            {rowBusy ? "Working..." : "createOffer"}
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
                    Note: this UI discovers your tokenIds via on-chain events (OwnershipRecorded / SongRegistered).
                </div>
            </div>
        </div>
    );
}
