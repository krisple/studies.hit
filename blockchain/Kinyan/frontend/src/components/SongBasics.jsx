import { extractDisplayNameFromUri } from "../lib/metadata";

function pickTrait(meta, keys) {
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

export default function SongBasics({ tokenId, tokenURI, meta, titleFallback, showTokenUri = true }) {
    const displayName =
        meta?.name || titleFallback || extractDisplayNameFromUri(tokenURI) || (tokenId ? `Token #${tokenId}` : "Song");

    const artists =
        pickTrait(meta, ["Artist", "artist", "artists"]) ||
        (Array.isArray(meta?.raw?.artists) ? meta.raw.artists.join(", ") : null) ||
        (typeof meta?.raw?.artists === "string" ? meta.raw.artists : null) ||
        null;

    const album =
        pickTrait(meta, ["Album", "album"]) ||
        (typeof meta?.raw?.album === "string" ? meta.raw.album : null) ||
        null;

    const spotifyUrl =
        (typeof meta?.raw?.external_url === "string" ? meta.raw.external_url : null) ||
        (typeof meta?.raw?.externalUrl === "string" ? meta.raw.externalUrl : null) ||
        (typeof meta?.raw?.spotifyUrl === "string" ? meta.raw.spotifyUrl : null) ||
        null;

    return (
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {meta?.imageUrl ? (
                <img
                    src={meta.imageUrl}
                    alt={displayName}
                    style={{
                        width: 72,
                        height: 72,
                        borderRadius: 14,
                        objectFit: "cover",
                        border: "1px solid var(--border)",
                    }}
                />
            ) : (
                <div
                    style={{
                        width: 72,
                        height: 72,
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
                <div style={{ fontSize: 16, fontWeight: 900 }}>{displayName}</div>
                <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {tokenId !== null && tokenId !== undefined ? (
                        <span className="pill">
                            <span className="muted-2">Token</span> #{tokenId}
                        </span>
                    ) : null}
                    {artists ? (
                        <span className="pill">
                            <span className="muted-2">Artists</span> {artists}
                        </span>
                    ) : null}
                    {album ? (
                        <span className="pill">
                            <span className="muted-2">Album</span> {album}
                        </span>
                    ) : null}
                    {spotifyUrl ? (
                        <a href={spotifyUrl} target="_blank" rel="noreferrer" className="pill">
                            <span className="muted-2">Spotify</span> Open
                        </a>
                    ) : null}
                </div>

                {showTokenUri ? (
                    <div style={{ marginTop: 8, fontSize: 12 }} className="muted-2">
                        tokenURI: <span className="mono">{tokenURI || "(loading...)"}</span>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

