import { useContext, useEffect, useState } from "react";
import Web3 from "web3";
import contracts from "../../config/contracts.json";
import { AppContext } from "../context/appContext";
import { getKny } from "./contracts";

export default function useWalletBalances() {
    const { web3, account, refreshNonce } = useContext(AppContext);

    const [eth, setEth] = useState(null);
    const [kny, setKny] = useState(null);
    const [decimals, setDecimals] = useState(null);
    const [symbol, setSymbol] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            try {
                setError(null);
                if (!web3 || !account) {
                    setEth(null);
                    setKny(null);
                    setDecimals(null);
                    setSymbol(null);
                    return;
                }

                setLoading(true);
                const knyContract = getKny(web3);

                const [ethWei, bal, d, s] = await Promise.all([
                    web3.eth.getBalance(account),
                    knyContract.methods.balanceOf(account).call(),
                    knyContract.methods.decimals().call(),
                    knyContract.methods.symbol().call(),
                ]);

                if (cancelled) return;
                setEth(Web3.utils.fromWei(String(ethWei), "ether"));
                setKny(bal);
                setDecimals(Number(d));
                setSymbol(s);
            } catch (e) {
                if (cancelled) return;
                setError(e?.message || String(e));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        run();
        return () => { cancelled = true; };
    }, [web3, account, refreshNonce]);

    return { eth, kny, decimals, symbol, loading, error, tokenAddress: contracts.kny };
}

