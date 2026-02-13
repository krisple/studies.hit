import { useCallback, useEffect, useMemo, useState } from "react";
import contracts from "../../config/contracts.json";
import { connectMetaMask, hasMetaMask } from "../lib/web3";
import { formatUnits, getKny, getMarketplace, getSongNFT } from "../lib/contracts";

export default function OfferDetailsPage({ offer, knyDecimals, knySymbol, onBack, onAfterPurchase }) {
    const [account, setAccount] = useState(null);
    const [chainId, setChainId] = useState(null);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    const [tokenURI, setTokenURI] = useState(null);
    const [trades, setTrades] = useState([]);
    const [allowance, setAllowance] = useState(null);
    const [balance, setBalance] = useState(null);
    const [knyMeta, setKnyMeta] = useState({ decimals: knyDecimals, symbol: knySymbol });

    const mm = hasMetaMask();
    const expectedChainId = contracts.chainId;
    const chainOk = chainId !== null && Number(chainId) === Number(expectedChainId);

    const marketplaceAddr = useMemo(() => contracts.marketplace, []);
    const songAddr = useMemo(() => contracts.songNft, []);

    async function ensureWallet() {
        const { web3, account, chainId } = await connectMetaMask();
        setAccount(account);
        setChainId(chainId);
        return { web3, account, chainId };
    }

    const loadDetails = useCallback(async () => {
        try {
            setError(null);
            setBusy(true);
            setTokenURI(null);
            setTrades([]);
            setAllowance(null);
            setBalance(null);

            const { web3, account, chainId } = await ensureWallet();
            if (Number(chainId) !== Number(expectedChainId)) return;

            const mp = getMarketplace(web3);
            const kny = getKny(web3);

            const calls = [
                mp.methods.getTradeHistory(offer.nft, offer.tokenId).call(),
                kny.methods.allowance(account, marketplaceAddr).call(),
                kny.methods.balanceOf(account).call(),
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

            let idx = 3;
            if (knyMeta.decimals === null || knyMeta.decimals === undefined || !knyMeta.symbol) {
                const dec = res[idx++];
                const sym = res[idx++];
                setKnyMeta({ decimals: Number(dec), symbol: sym });
            }

            const maybeTokenUri = res[idx];

            setTrades(Array.isArray(tradeHistory) ? tradeHistory : []);
            setAllowance(allow);
            setBalance(bal);
            if (typeof maybeTokenUri === "string") setTokenURI(maybeTokenUri);
        } catch (e) {
            setError(e?.message || String(e));
        } finally {
            setBusy(false);
        }
    }, [offer, expectedChainId, marketplaceAddr, songAddr, knyMeta.decimals, knyMeta.symbol]);

    useEffect(() => {
        if (!offer) return;
        loadDetails();
    }, [offer, loadDetails]);

    const decimals = knyMeta.decimals ?? knyDecimals ?? 18;
    const symbol = knyMeta.symbol ?? knySymbol ?? "KNY";

    const pricePretty = offer?.price ? `${formatUnits(offer.price, decimals)} ${symbol}` : "";
    const allowOk = allowance !== null && offer?.price ? BigInt(allowance) >= BigInt(offer.price) : false;
    const balOk = balance !== null && offer?.price ? BigInt(balance) >= BigInt(offer.price) : false;

    async function onApproveKny() {
        try {
            setError(null);
            setBusy(true);

            const { web3, account, chainId } = await ensureWallet();
            if (Number(chainId) !== Number(expectedChainId)) {
                throw new Error(`Wrong network (expected chainId ${expectedChainId})`);
            }

            const kny = getKny(web3);
            await kny.methods.approve(marketplaceAddr, offer.price).send({ from: account });

            await loadDetails();
        } catch (e) {
            setError(e?.message || String(e));
        } finally {
            setBusy(false);
        }
    }

    async function onPurchase() {
        try {
            setError(null);
            setBusy(true);

            const { web3, chainId } = await ensureWallet();
            if (Number(chainId) !== Number(expectedChainId)) {
                throw new Error(`Wrong network (expected chainId ${expectedChainId})`);
            }

            if (!allowOk) throw new Error("KNY allowance too low. Click Approve KNY first.");
            if (!balOk) throw new Error("Insufficient KNY balance for this purchase.");

            const mp = getMarketplace(web3);
            await mp.methods.purchase(offer.nft, offer.tokenId).send({ from: account });

            await loadDetails();
            if (onAfterPurchase) await onAfterPurchase();
        } catch (e) {
            setError(e?.message || String(e));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div style={{ padding: 16, fontFamily: "system-ui" }}>
            <button
                onClick={onBack}
                style={{ padding: "8px 12px", borderRadius: 8, cursor: "pointer" }}
            >
                Back
            </button>

            <h2 style={{ marginTop: 12 }}>Offer Details</h2>

            <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
                <div><b>NFT:</b> {offer.nft}</div>
                <div><b>TokenId:</b> {offer.tokenId}</div>
                <div><b>Seller:</b> {offer.seller}</div>
                <div><b>Price:</b> {pricePretty}</div>
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                    CreatedAt: {offer.createdAt} ({new Date(Number(offer.createdAt) * 1000).toLocaleString()})
                </div>
                {tokenURI && (
                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
                        tokenURI: <code>{tokenURI}</code>
                    </div>
                )}
            </div>

            {!mm && (
                <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 8, color: "crimson" }}>
                    MetaMask not detected.
                </div>
            )}

            {error && <div style={{ marginTop: 12, color: "crimson" }}>{error}</div>}

            {(account || chainId !== null) && (
                <div style={{ marginTop: 12, fontSize: 12, opacity: 0.85 }}>
                    {account && <div>Account: {account}</div>}
                    {chainId !== null && <div>ChainId: {chainId}</div>}
                    {!chainOk && <div style={{ color: "crimson" }}>Wrong network.</div>}
                </div>
            )}

            <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Purchase</h3>

                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
                    Allowance: {allowance !== null ? `${formatUnits(allowance, decimals)} ${symbol}` : "-"}
                    <br />
                    Balance: {balance !== null ? `${formatUnits(balance, decimals)} ${symbol}` : "-"}
                </div>

                <button
                    onClick={onApproveKny}
                    disabled={!mm || !chainOk || busy}
                    style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, cursor: "pointer" }}
                >
                    Approve KNY (exact price)
                </button>

                <button
                    onClick={onPurchase}
                    disabled={!mm || !chainOk || busy}
                    style={{ marginTop: 10, marginLeft: 8, padding: "8px 12px", borderRadius: 8, cursor: "pointer" }}
                >
                    Purchase
                </button>

                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
                    Status: allowance {allowOk ? "OK" : "LOW"}, balance {balOk ? "OK" : "LOW"}.
                </div>
            </div>

            <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Trade History</h3>
                {trades.length === 0 ? (
                    <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>No trades yet.</div>
                ) : (
                    <div style={{ marginTop: 10 }}>
                        {trades.map((t, i) => (
                            <div
                                key={i}
                                style={{ padding: 10, border: "1px solid #eee", borderRadius: 8, marginTop: 8 }}
                            >
                                <div style={{ fontSize: 12 }}>
                                    <b>Price:</b> {formatUnits(t.price, decimals)} {symbol}{" "}
                                    <span style={{ opacity: 0.75 }}>
                                        (royalty: {formatUnits(t.royalty, decimals)} {symbol})
                                    </span>
                                </div>
                                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.85 }}>
                                    Seller: {t.seller}
                                    <br />
                                    Buyer: {t.buyer}
                                    <br />
                                    Creator: {t.creator}
                                </div>
                                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.8 }}>
                                    {t.timestamp} ({new Date(Number(t.timestamp) * 1000).toLocaleString()})
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <button
                onClick={loadDetails}
                disabled={!mm || busy}
                style={{ marginTop: 16, padding: "8px 12px", borderRadius: 8, cursor: "pointer" }}
            >
                Refresh
            </button>
        </div>
    );
}
