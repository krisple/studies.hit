import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import contracts from "../../config/contracts.json";
import Web3 from "web3";
import { AppContext } from "../context/appContext";
import { formatUnits, getKny, getMarketplace, getSongNFT } from "../lib/contracts";
import PageHeader from "../components/layout/PageHeader";

export default function OfferDetailsPage({ offer, knyDecimals, knySymbol, onBack, onAfterPurchase }) {
    const { web3, account, chainId, refreshNonce, bumpRefresh } = useContext(AppContext);

    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const [tokenURI, setTokenURI] = useState(null);
    const [trades, setTrades] = useState([]);
    const [allowance, setAllowance] = useState(null);
    const [balance, setBalance] = useState(null);
    const [ethBalance, setEthBalance] = useState(null);
    const [knyMeta, setKnyMeta] = useState({ decimals: knyDecimals, symbol: knySymbol });
    const [actionLabel, setActionLabel] = useState(null);

    const expectedChainId = contracts.chainId;
    const chainOk = chainId !== null && Number(chainId) === Number(expectedChainId);

    const marketplaceAddr = useMemo(() => contracts.marketplace, []);
    const songAddr = useMemo(() => contracts.songNft, []);

    const lastBlockRef = useRef(null);

    const decimals = knyMeta.decimals ?? knyDecimals ?? 18;
    const symbol = knyMeta.symbol ?? knySymbol ?? "KNY";

    const pricePretty = offer?.price ? `${formatUnits(offer.price, decimals)} ${symbol}` : "";
    const allowOk = allowance !== null && offer?.price ? BigInt(allowance) >= BigInt(offer.price) : false;
    const balOk = balance !== null && offer?.price ? BigInt(balance) >= BigInt(offer.price) : false;
    const ethOk = ethBalance !== null ? BigInt(ethBalance) > 0n : false;

    const loadDetails = useCallback(async () => {
        try {
            setError(null);
            if (!web3 || !account) return;
            if (!chainOk) return;

            setBusy(true);
            setTokenURI(null);
            setTrades([]);
            setAllowance(null);
            setBalance(null);
            setEthBalance(null);

            const [knyCode, mpCode] = await Promise.all([
                web3.eth.getCode(contracts.kny),
                web3.eth.getCode(contracts.marketplace),
            ]);
            if (knyCode === "0x") throw new Error("No contract code at KNY address (stale contracts.json?)");
            if (mpCode === "0x") throw new Error("No contract code at Marketplace address (stale contracts.json?)");

            const mp = getMarketplace(web3);
            const kny = getKny(web3);

            const calls = [
                mp.methods.getTradeHistory(offer.nft, offer.tokenId).call(),
                kny.methods.allowance(account, marketplaceAddr).call(),
                kny.methods.balanceOf(account).call(),
                web3.eth.getBalance(account),
            ];

            if (knyMeta.decimals === null || knyMeta.decimals === undefined || !knyMeta.symbol) {
                calls.push(kny.methods.decimals().call());
                calls.push(kny.methods.symbol().call());
            }

            if (String(offer.nft).toLowerCase() === String(songAddr).toLowerCase()) {
                const song = getSongNFT(web3);
                calls.push(song.methods.tokenURI(offer.tokenId).call());
            }

            const res = await Promise.all(calls);
            const tradeHistory = res[0];
            const allow = res[1];
            const bal = res[2];
            const ethWei = res[3];

            let idx = 4;
            if (knyMeta.decimals === null || knyMeta.decimals === undefined || !knyMeta.symbol) {
                const dec = res[idx++];
                const sym = res[idx++];
                setKnyMeta({ decimals: Number(dec), symbol: sym });
            }

            const maybeTokenUri = res[idx];

            setTrades(Array.isArray(tradeHistory) ? tradeHistory : []);
            setAllowance(allow);
            setBalance(bal);
            setEthBalance(ethWei);
            if (typeof maybeTokenUri === "string") setTokenURI(maybeTokenUri);
        } catch (e) {
            setError(e?.message || String(e));
        } finally {
            setBusy(false);
        }
    }, [account, chainOk, knyMeta.decimals, knyMeta.symbol, marketplaceAddr, offer, songAddr, web3]);

    useEffect(() => {
        loadDetails();
    }, [loadDetails, refreshNonce]);

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

                const topic0OfferCreated = web3.utils.keccak256("OfferCreated(address,uint256,address,uint256,uint256)");
                const topic0OfferCanceled = web3.utils.keccak256("OfferCanceled(address,uint256,address,uint256)");
                const topic0OfferPriceUpdated = web3.utils.keccak256("OfferPriceUpdated(address,uint256,address,uint256,uint256)");
                const topic0Purchased = web3.utils.keccak256("Purchased(address,uint256,address,address,uint256,address,uint256,uint256)");

                const logs = await web3.eth.getPastLogs({
                    address: contracts.marketplace,
                    fromBlock,
                    toBlock,
                    topics: [[topic0OfferCreated, topic0OfferCanceled, topic0OfferPriceUpdated, topic0Purchased]],
                });

                if (logs && logs.length > 0) {
                    await loadDetails();
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
    }, [account, chainOk, loadDetails, web3]);

    async function onPurchase() {
        try {
            setError(null);
            setBusy(true);
            setActionLabel("Preparing...");

            if (!web3 || !account) throw new Error("Not connected");
            if (!chainOk) throw new Error(`Wrong network (expected chainId ${expectedChainId})`);

            const ethWei = await web3.eth.getBalance(account);
            if (BigInt(ethWei) === 0n) throw new Error("This account has 0 ETH for gas. Fund it (ETH) and try again.");

            if (!offer?.price) throw new Error("Missing offer price");

            if (!allowOk) {
                setActionLabel("Approving KNY...");
                const kny = getKny(web3);
                await kny.methods.approve(marketplaceAddr, offer.price).send({ from: account });
            }
            if (!balOk) throw new Error("Insufficient KNY balance for this purchase.");

            const mp = getMarketplace(web3);
            setActionLabel("Purchasing...");
            await mp.methods.purchase(offer.nft, offer.tokenId).send({ from: account });

            bumpRefresh();
            await loadDetails();
            if (onAfterPurchase) await onAfterPurchase();
        } catch (e) {
            setError(e?.message || String(e));
        } finally {
            setBusy(false);
            setActionLabel(null);
        }
    }

    return (
        <div className="container">
            <PageHeader
                title="Offer Details"
                right={<button onClick={onBack} className="btn btn-ghost">Back</button>}
            />

            <div className="card" style={{ marginTop: 12 }}>
                <div><b>NFT:</b> <span className="mono">{offer.nft}</span></div>
                <div><b>TokenId:</b> {offer.tokenId}</div>
                <div><b>Seller:</b> <span className="mono">{offer.seller}</span></div>
                <div><b>Price:</b> {pricePretty}</div>
                <div style={{ marginTop: 8, fontSize: 12 }} className="muted-2">
                    CreatedAt: {offer.createdAt} ({new Date(Number(offer.createdAt) * 1000).toLocaleString()})
                </div>
                {tokenURI && (
                    <div style={{ marginTop: 8, fontSize: 12 }} className="muted-2">
                        tokenURI: <span className="mono">{tokenURI}</span>
                    </div>
                )}
            </div>

            {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}

            {(account || chainId !== null) && (
                <div style={{ marginTop: 12, fontSize: 12 }} className="muted-2">
                    {account && <div>Account: <span className="mono">{account}</span></div>}
                    {chainId !== null && <div>ChainId: {chainId}</div>}
                    {!chainOk && <div className="error">Wrong network.</div>}
                </div>
            )}

            <div className="card" style={{ marginTop: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Purchase</h3>

                <div style={{ marginTop: 10, fontSize: 12 }} className="muted-2">
                    Allowance: {allowance !== null ? `${formatUnits(allowance, decimals)} ${symbol}` : "-"}
                    <br />
                    Balance: {balance !== null ? `${formatUnits(balance, decimals)} ${symbol}` : "-"}
                    <br />
                    ETH (gas): {ethBalance !== null ? Web3.utils.fromWei(String(ethBalance), "ether") : "-"}
                </div>

                <div style={{ marginTop: 10 }}>
                    <button onClick={onPurchase} disabled={!chainOk || busy} className="btn btn-primary">
                        {busy ? "Working..." : "Purchase"}
                    </button>
                </div>

                <div style={{ marginTop: 10, fontSize: 12 }} className="muted-2">
                    Status: ETH {ethOk ? "OK" : "LOW"}, allowance {allowOk ? "OK" : "LOW"}, balance {balOk ? "OK" : "LOW"}.
                </div>

                {actionLabel && (
                    <div style={{ marginTop: 10, fontSize: 12 }} className="muted-2">
                        {actionLabel}
                    </div>
                )}
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
                                    <b>Price:</b> {formatUnits(t.price, decimals)} {symbol}{" "}
                                    <span className="muted-2">
                                        (royalty: {formatUnits(t.royalty, decimals)} {symbol})
                                    </span>
                                </div>
                                <div style={{ marginTop: 4, fontSize: 12 }} className="muted-2">
                                    Seller: <span className="mono">{t.seller}</span>
                                    <br />
                                    Buyer: <span className="mono">{t.buyer}</span>
                                    <br />
                                    Creator: <span className="mono">{t.creator}</span>
                                </div>
                                <div style={{ marginTop: 4, fontSize: 12 }} className="muted-2">
                                    {t.timestamp} ({new Date(Number(t.timestamp) * 1000).toLocaleString()})
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
