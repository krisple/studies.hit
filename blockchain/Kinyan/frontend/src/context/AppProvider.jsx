import { useCallback, useEffect, useMemo, useState } from "react";
import { AppContext } from "./appContext";
import { connectMetaMask, hasMetaMask } from "../lib/web3";

export default function AppProvider({ children }) {
    const [web3, setWeb3] = useState(null);
    const [account, setAccount] = useState(null);
    const [chainId, setChainId] = useState(null);
    const [error, setError] = useState(null);

    const [refreshNonce, setRefreshNonce] = useState(0);

    const connect = useCallback(async () => {
        setError(null);
        const { web3, account, chainId } = await connectMetaMask();
        setWeb3(web3);
        setAccount(account);
        setChainId(chainId);
        return { web3, account, chainId };
    }, []);

    const disconnect = useCallback(() => {
        setError(null);
        setWeb3(null);
        setAccount(null);
        setChainId(null);
        setRefreshNonce((n) => n + 1);
    }, []);

    const bumpRefresh = useCallback(() => {
        setRefreshNonce((n) => n + 1);
    }, []);

    const metaMaskAvailable = hasMetaMask();
    const connected = Boolean(web3 && account);

    useEffect(() => {
        if (!metaMaskAvailable) return;

        const eth = window.ethereum;
        if (!eth?.on) return;

        const onAccountsChanged = (accounts) => {
            if (!accounts || accounts.length === 0) {
                disconnect();
                return;
            }
            setAccount(accounts[0]);
            bumpRefresh();
        };

        const onChainChanged = (chainIdHex) => {
            const id = parseInt(chainIdHex, 16);
            setChainId(id);
            bumpRefresh();
        };

        eth.on("accountsChanged", onAccountsChanged);
        eth.on("chainChanged", onChainChanged);

        return () => {
            eth.removeListener?.("accountsChanged", onAccountsChanged);
            eth.removeListener?.("chainChanged", onChainChanged);
        };
    }, [bumpRefresh, disconnect, metaMaskAvailable]);

    const value = useMemo(() => ({
        web3,
        account,
        chainId,
        connected,
        metaMaskAvailable,
        error,
        setError,
        connect,
        disconnect,
        refreshNonce,
        bumpRefresh,
    }), [account, chainId, connect, connected, disconnect, error, metaMaskAvailable, refreshNonce, web3, bumpRefresh]);

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

