import { useMemo, useState } from "react";
import contracts from "../../config/contracts.json";
import { connectMetaMask, hasMetaMask } from "../lib/web3";
import { formatUnits, getKny, getMarketplace } from "../lib/contracts";
import OfferDetailsPage from "./OfferDetailsPage";

export default function MarketPage() {
    const [account, setAccount] = useState(null);
    const [chainId, setChainId] = useState(null);
    const [error, setError] = useState(null);

    const [offers, setOffers] = useState([]);
    const [selected, setSelected] = useState(null);

    const [knyDecimals, setKnyDecimals] = useState(null);
    const [knySymbol, setKnySymbol] = useState(null);
    const [busy, setBusy] = useState(false);

    const mm = hasMetaMask();
    const expectedChainId = contracts.chainId;
    const chainOk = chainId !== null && Number(chainId) === Number(expectedChainId);

    const marketplaceAddr = useMemo(() => contracts.marketplace, []);

    async function ensureWallet() {
        const { web3, account, chainId } = await connectMetaMask();
        setAccount(account);
        setChainId(chainId);
        return { web3, account, chainId };
    }

    async function loadActiveOffers() {
        try {
            setError(null);
            setBusy(true);
            setOffers([]);

            const { web3, chainId } = await ensureWallet();
            if (Number(chainId) !== Number(expectedChainId)) {
                throw new Error(`Wrong network (expected chainId ${expectedChainId})`);
            }

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
        <div style={{ padding: 16, fontFamily: "system-ui" }}>
            <h2>Market</h2>

            <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
                <div><b>Marketplace:</b> {marketplaceAddr}</div>
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
                onClick={loadActiveOffers}
                disabled={!mm || busy}
                style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, cursor: "pointer" }}
            >
                Load active offers
            </button>

            {error && <div style={{ marginTop: 12, color: "crimson" }}>{error}</div>}

            {(account || chainId !== null) && (
                <div style={{ marginTop: 16, fontSize: 12, opacity: 0.85 }}>
                    {account && <div>Account: {account}</div>}
                    {chainId !== null && <div>ChainId: {chainId}</div>}
                    {!chainOk && <div style={{ color: "crimson" }}>Wrong network.</div>}
                </div>
            )}

            <div style={{ marginTop: 16 }}>
                {offers.length === 0 ? (
                    <div style={{ fontSize: 12, opacity: 0.8 }}>No active offers loaded.</div>
                ) : (
                    offers.map((o) => {
                        const pricePretty =
                            knyDecimals !== null
                                ? `${formatUnits(o.price, knyDecimals)} ${knySymbol || "KNY"}`
                                : String(o.price);

                        return (
                            <div
                                key={`${o.nft}-${o.tokenId}`}
                                style={{ marginTop: 12, padding: 12, border: "1px solid #eee", borderRadius: 8 }}
                            >
                                <div><b>NFT:</b> {o.nft}</div>
                                <div><b>TokenId:</b> {o.tokenId}</div>
                                <div><b>Seller:</b> {o.seller}</div>
                                <div><b>Price:</b> {pricePretty}</div>
                                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                                    CreatedAt: {o.createdAt} ({new Date(Number(o.createdAt) * 1000).toLocaleString()})
                                </div>

                                <button
                                    onClick={() => setSelected(o)}
                                    disabled={busy}
                                    style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, cursor: "pointer" }}
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
