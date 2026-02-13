import Web3 from "web3";

export function hasMetaMask() {
    return typeof window !== "undefined" && typeof window.ethereum !== "undefined";
}

export async function connectMetaMask() {
    if (!hasMetaMask()) {
        throw new Error("MetaMask not detected. Please install MetaMask.");
    }

    await window.ethereum.request({ method: "eth_requestAccounts" });

    const web3 = new Web3(window.ethereum);
    const accounts = await web3.eth.getAccounts();

    if (!accounts || accounts.length === 0) {
        throw new Error("No accounts returned from MetaMask.");
    }

    const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
    const chainId = parseInt(chainIdHex, 16);

    return { web3, account: accounts[0], chainId };
}
