import { useContext, useEffect, useMemo, useState } from "react";
import Web3 from "web3";
import contracts from "../../config/contracts.json";
import { AppContext } from "../context/appContext";
import { getSongNFT } from "../lib/contracts";
import { fetchMetadata } from "../lib/metadata";
import PageHeader from "../components/layout/PageHeader";

export default function RegisterPage() {
    const { web3, account, chainId, bumpRefresh } = useContext(AppContext);

    const expectedChainId = contracts.chainId;
    const chainOk = chainId !== null && Number(chainId) === Number(expectedChainId);

    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    const backendUrl = useMemo(
        () => (import.meta.env.VITE_BACKEND_URL ? String(import.meta.env.VITE_BACKEND_URL) : "http://localhost:8787"),
        []
    );

    const [spotifyInput, setSpotifyInput] = useState("");
    const [songName, setSongName] = useState("demo-song-1");
    const [tokenURI, setTokenURI] = useState("");
    const [hash, setHash] = useState(Web3.utils.keccak256("demo-song-1"));

    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState(null);
    const [preview, setPreview] = useState(null); // { title, artists, album, imageUrl, spotifyUrl, tokenURI, meta? }
    const [existingTokenId, setExistingTokenId] = useState(null);

    const [tokenId, setTokenId] = useState(null);
    const [registeredAt, setRegisteredAt] = useState(null);
    const [txHash, setTxHash] = useState(null);

    function computeHash(name) {
        const h = Web3.utils.keccak256(name);
        setHash(h);
        return h;
    }

    function resetRegisterState() {
        setTxHash(null);
        setTokenId(null);
        setRegisteredAt(null);
        setExistingTokenId(null);
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

    async function loadPreviewFromTokenUri(uri) {
        try {
            setPreviewError(null);
            setPreviewLoading(true);

            const md = await fetchMetadata(uri);
            if (!md.ok) throw new Error(`Failed to load metadata (${md.error || "unknown error"})`);

            const title = md.data?.name || null;
            const artists =
                getTrait(md.data, ["Artist", "artist", "artists"]) ||
                (Array.isArray(md.data?.raw?.artists) ? md.data.raw.artists.join(", ") : null) ||
                null;
            const album =
                getTrait(md.data, ["Album", "album"]) ||
                (typeof md.data?.raw?.album === "string" ? md.data.raw.album : null) ||
                null;
            const spotifyUrl =
                (typeof md.data?.raw?.external_url === "string" ? md.data.raw.external_url : null) ||
                (typeof md.data?.raw?.externalUrl === "string" ? md.data.raw.externalUrl : null) ||
                null;

            setPreview({
                title,
                artists,
                album,
                imageUrl: md.data?.imageUrl || null,
                spotifyUrl,
                tokenURI: uri,
                meta: md.data,
            });

            if (title) {
                setSongName(title);
                computeHash(title);
            }
        } catch (e) {
            setPreview(null);
            setPreviewError(e?.message || String(e));
        } finally {
            setPreviewLoading(false);
        }
    }

    async function onGenerate() {
        try {
            setError(null);
            setPreviewError(null);
            setPreview(null);
            setPreviewLoading(true);
            resetRegisterState();

            const input = String(spotifyInput || "").trim();
            if (!input) throw new Error("Please paste a Spotify track URL or Track ID");

            const res = await fetch(`${backendUrl.replace(/\/$/, "")}/api/metadata/from-spotify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ input }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || `Backend error (HTTP ${res.status})`);

            const uri = data?.tokenURI ? String(data.tokenURI) : "";
            if (!uri) throw new Error("Backend response missing tokenURI");

            const track = data?.track || {};
            const title = typeof track.name === "string" ? track.name : (data?.metadata?.name || null);
            const artists = typeof track.artists === "string" ? track.artists : null;
            const album = typeof track.album === "string" ? track.album : null;
            const imageUrl = typeof track.imageUrl === "string" ? track.imageUrl : null;
            const spotifyUrl = typeof track.spotifyUrl === "string" ? track.spotifyUrl : null;

            setTokenURI(uri);
            setPreview({ title, artists, album, imageUrl, spotifyUrl, tokenURI: uri, meta: null });

            if (title) {
                setSongName(title);
                computeHash(title);
            }
        } catch (e) {
            setPreview(null);
            setPreviewError(e?.message || String(e));
        } finally {
            setPreviewLoading(false);
        }
    }

    async function onRegister() {
        try {
            setError(null);
            setBusy(true);
            setTokenId(null);
            setRegisteredAt(null);
            setTxHash(null);

            if (!web3 || !account) throw new Error("Not connected");
            if (!chainOk) throw new Error(`Wrong network (expected chainId ${expectedChainId})`);
            if (!preview) throw new Error("Missing preview. Generate or paste a tokenURI first.");
            if (previewLoading) throw new Error("Preview is still loading");
            if (previewError) throw new Error("Fix the preview error before registering");
            if (!tokenURI) throw new Error("Missing tokenURI");

            const song = getSongNFT(web3);
            const h = computeHash(songName);

            const existing = await song.methods.tokenIdBySongHash(h).call().catch(() => "0");
            if (BigInt(existing) !== 0n) {
                setExistingTokenId(existing);
                setTokenId(existing);
                throw new Error(`Song already registered (tokenId: ${existing}).`);
            }

            const receipt = await song.methods.registerSong(h, tokenURI).send({ from: account });
            setTxHash(receipt.transactionHash);

            const topic0 = web3.utils.keccak256("SongRegistered(address,uint256,bytes32,uint256,string)");
            const log = receipt.logs.find((l) =>
                l.address.toLowerCase() === song.options.address.toLowerCase() &&
                l.topics?.[0]?.toLowerCase() === topic0.toLowerCase()
            );

            if (log) {
                const decoded = web3.eth.abi.decodeLog(
                    [
                        { indexed: true, name: "creator", type: "address" },
                        { indexed: true, name: "tokenId", type: "uint256" },
                        { indexed: true, name: "songHash", type: "bytes32" },
                        { indexed: false, name: "registeredAt", type: "uint256" },
                        { indexed: false, name: "tokenURI", type: "string" },
                    ],
                    log.data,
                    log.topics.slice(1)
                );

                setTokenId(decoded.tokenId);
                setRegisteredAt(decoded.registeredAt);
            }

            bumpRefresh();
        } catch (e) {
            setError(e?.message || String(e));
        } finally {
            setBusy(false);
        }
    }

    useEffect(() => {
        resetRegisterState();
    }, [tokenURI, songName]);

    useEffect(() => {
        const uri = String(tokenURI || "").trim();
        if (!uri) {
            setPreview(null);
            setPreviewError(null);
            setPreviewLoading(false);
            return;
        }

        if (preview?.tokenURI === uri) return;

        let cancelled = false;
        (async () => {
            setPreviewError(null);
            setPreviewLoading(true);
            try {
                await loadPreviewFromTokenUri(uri);
            } catch (e) {
                void e;
            } finally {
                if (!cancelled) setPreviewLoading(false);
            }
        })();

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tokenURI]);

    return (
        <div className="container">
            <PageHeader title="Register"/>

            <div className="card">
                <div className="stack">
                    <div>
                        <label className="label">Spotify track URL / Track ID</label>
                        <div className="row" style={{ justifyContent: "flex-start" }}>
                            <input
                                value={spotifyInput}
                                onChange={(e) => setSpotifyInput(e.target.value)}
                                placeholder="https://open.spotify.com/track/..."
                                className="input"
                                style={{ flex: 1, minWidth: 240 }}
                            />
                            <button onClick={onGenerate} disabled={previewLoading || busy} className="btn btn-primary">
                                {previewLoading ? "Generating..." : "Generate"}
                            </button>
                        </div>
                        <div className="muted-2" style={{ fontSize: 12, marginTop: 6 }}>
                            Backend: <span className="mono">{backendUrl}</span>
                        </div>
                    </div>

                    <div>
                        <label className="label">Song name (used for hash)</label>
                        <input
                            value={songName}
                            onChange={(e) => { setSongName(e.target.value); computeHash(e.target.value); }}
                            className="input"
                        />
                    </div>

                    <div>
                        <label className="label">Token URI</label>
                        <input
                            value={tokenURI}
                            onChange={(e) => setTokenURI(e.target.value)}
                            placeholder="ipfs://<CID> or https://..."
                            className="input"
                        />
                        <div className="muted-2" style={{ fontSize: 12, marginTop: 6 }}>
                            Paste an existing `ipfs://...` tokenURI and we’ll load its metadata preview automatically.
                        </div>
                    </div>

                    <div style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 12 }}>
                        <div className="muted-2" style={{ fontSize: 12 }}>Computed hash</div>
                        <div className="mono">{hash}</div>
                    </div>

                    {previewError && <div className="error" style={{ fontSize: 12 }}>{previewError}</div>}

                    {preview && (
                        <div className="card" style={{ padding: 12 }}>
                            <div className="row" style={{ alignItems: "flex-start" }}>
                                {preview.imageUrl ? (
                                    <img
                                        src={preview.imageUrl}
                                        alt={preview.title || "Preview"}
                                        style={{ width: 92, height: 92, borderRadius: 14, objectFit: "cover", border: "1px solid var(--border)" }}
                                    />
                                ) : (
                                    <div
                                        style={{
                                            width: 92,
                                            height: 92,
                                            borderRadius: 14,
                                            border: "1px dashed var(--border)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            color: "var(--muted)",
                                            fontSize: 12,
                                        }}
                                    >
                                        No image
                                    </div>
                                )}

                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 16, fontWeight: 900 }}>
                                        {preview.title || "(No title in metadata)"}
                                    </div>
                                    {preview.artists ? (
                                        <div className="muted-2" style={{ marginTop: 4, fontSize: 12 }}>
                                            Artists: {preview.artists}
                                        </div>
                                    ) : null}
                                    {preview.album ? (
                                        <div className="muted-2" style={{ marginTop: 2, fontSize: 12 }}>
                                            Album: {preview.album}
                                        </div>
                                    ) : null}
                                    <div className="muted-2" style={{ marginTop: 6, fontSize: 12 }}>
                                        tokenURI: <span className="mono">{preview.tokenURI}</span>
                                    </div>
                                    {preview.spotifyUrl ? (
                                        <div style={{ marginTop: 6, fontSize: 12 }}>
                                            <a href={preview.spotifyUrl} target="_blank" rel="noreferrer" className="muted-2">
                                                Open in Spotify
                                            </a>
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            <div className="row" style={{ marginTop: 12 }}>
                                {txHash ? (
                                    <span className="pill" style={{ color: "white", background: "linear-gradient(180deg, var(--ok), #2a9d3a)", borderColor: "rgba(56, 176, 0, 0.4)" }}>
                                        Registered successfully
                                    </span>
                                ) : existingTokenId ? (
                                    <span className="pill" style={{ color: "white", background: "linear-gradient(180deg, var(--danger), #ff2e5c)", borderColor: "rgba(255, 77, 109, 0.35)" }}>
                                        Already registered (Token #{existingTokenId})
                                    </span>
                                ) : (
                                    <button
                                        onClick={onRegister}
                                        disabled={!chainOk || busy || previewLoading || Boolean(previewError) || !preview}
                                        className="btn btn-primary"
                                    >
                                        {busy ? "Registering..." : "registerSong"}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}

            {txHash && (
                <div className="card" style={{ marginTop: 16 }}>
                    <div className="row">
                        <h3 style={{ margin: 0, fontSize: 16 }}>Registered</h3>
                        <span className="pill" style={{ color: "white", background: "linear-gradient(180deg, var(--ok), #2a9d3a)", borderColor: "rgba(56, 176, 0, 0.4)" }}>
                            Success
                        </span>
                    </div>
                    <div style={{ marginTop: 10 }}><b>Transaction hash:</b> <span className="mono">{txHash}</span></div>
                    {tokenId !== null && <div style={{ marginTop: 6 }}><b>TokenId:</b> {tokenId}</div>}
                    {registeredAt !== null && (
                        <div style={{ marginTop: 10 }}>
                            <div><b>RegisteredAt (unix):</b> {registeredAt}</div>
                            <div className="muted-2" style={{ fontSize: 12 }}>
                                {new Date(Number(registeredAt) * 1000).toLocaleString()}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
