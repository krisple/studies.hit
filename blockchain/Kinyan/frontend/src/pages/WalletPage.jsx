import { useState } from "react";
import { connectMetaMask, hasMetaMask } from "../lib/web3";
import contracts from "../../config/contracts.json";
import { getSongNFT, getKny, formatUnits } from "../lib/contracts";

export default function WalletPage() {
    const [account, setAccount] = useState(null);
    const [chainId, setChainId] = useState(null);
    const [error, setError] = useState(null);

    const [songMarketplace, setSongMarketplace] = useState(null);
    const [ethBalance, setEthBalance] = useState(null);
    const [knyBalance, setKnyBalance] = useState(null);
    const [knySymbol, setKnySymbol] = useState(null);
    const [knyDecimals, setKnyDecimals] = useState(null);

    const [web3, setWeb3] = useState(null);

    async function onConnect() {
        try {
            setError(null);
            const { web3, account, chainId } = await connectMetaMask();
            setWeb3(web3);
            setAccount(account);
            setChainId(chainId);
        } catch (e) {
            setError(e?.message || String(e));
        }
    }

    async function loadContractData() {
        try {
            if (!web3 || !account) return;

            const songCode = await web3.eth.getCode(contracts.songNft);
            const knyCode = await web3.eth.getCode(contracts.kny);

            if (songCode === "0x") throw new Error("No contract code at SongNFT address (stale contracts.json?)");
            if (knyCode === "0x") throw new Error("No contract code at KNY address (stale contracts.json?)");


            setError(null);

            const song = getSongNFT(web3);
            const kny = getKny(web3);

            const [mp, ethWei, bal, decimals, symbol] = await Promise.all([
                song.methods.marketplace().call(),
                web3.eth.getBalance(account),
                kny.methods.balanceOf(account).call(),
                kny.methods.decimals().call(),
                kny.methods.symbol().call(),
            ]);

            setSongMarketplace(mp);
            setEthBalance(web3.utils.fromWei(ethWei, "ether"));
            setKnyBalance(bal);
            setKnyDecimals(Number(decimals));
            setKnySymbol(symbol);
        } catch (e) {
            setError(e?.message || String(e));
        }
    }

    const mm = hasMetaMask();
    const expected = contracts.chainId;
    const chainOk = chainId !== null && Number(chainId) === Number(expected);

    const knyPretty =
        knyBalance !== null && knyDecimals !== null ? formatUnits(knyBalance, knyDecimals) : null;

    return (
        <div style={{ padding: 16, fontFamily: "system-ui" }}>
            <h2>Wallet</h2>

            <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
                <div><b>Expected ChainId:</b> {expected}</div>
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                    config source: <code>config/contracts.json</code>
                </div>
            </div>

            {!mm && (
                <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 8, color: "crimson" }}>
                    MetaMask not detected.
                </div>
            )}

            <button
                onClick={onConnect}
                disabled={!mm}
                style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, cursor: "pointer" }}
            >
                Connect MetaMask
            </button>

            {error && <div style={{ marginTop: 12, color: "crimson" }}>{error}</div>}

            {account && (
                <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
                    <div><b>Account:</b> {account}</div>
                    <div><b>ChainId:</b> {chainId}</div>

                    {!chainOk && (
                        <div style={{ marginTop: 10, color: "crimson" }}>
                            Wrong network. Switch MetaMask to chainId {expected}.
                        </div>
                    )}

                    <div style={{ marginTop: 12 }}>
                        <div><b>KNY:</b> {contracts.kny}</div>
                        <div><b>Marketplace:</b> {contracts.marketplace}</div>
                        <div><b>SongNFT:</b> {contracts.songNft}</div>
                    </div>

                    <button
                        onClick={loadContractData}
                        disabled={!chainOk}
                        style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, cursor: "pointer" }}
                    >
                        Load contract data
                    </button>

                    {songMarketplace && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee" }}>
                            <div><b>SongNFT.marketplace():</b> {songMarketplace}</div>
                            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                                Expected: {contracts.marketplace}
                            </div>
                            {songMarketplace.toLowerCase() !== contracts.marketplace.toLowerCase() && (
                                <div style={{ marginTop: 8, color: "crimson" }}>
                                    Mismatch: SongNFT points to a different marketplace address.
                                </div>
                            )}
                        </div>
                    )}

                    {(ethBalance !== null || knyPretty !== null) && (
                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee" }}>
                            {ethBalance !== null && <div><b>ETH:</b> {ethBalance}</div>}
                            {knyPretty !== null && <div><b>{knySymbol || "KNY"}:</b> {knyPretty}</div>}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
