const DEFAULT_IPFS_GATEWAY = "https://ipfs.io/ipfs/";
const DEFAULT_TIMEOUT_MS = 12_000;

const _jsonCache = new Map(); // url -> Promise

function getIpfsGateway() {
    try {
        const env =
            typeof import.meta !== "undefined" && import.meta.env
                ? import.meta.env.VITE_IPFS_GATEWAY || import.meta.env.VITE_PINATA_GATEWAY
                : null;

        const raw = env ? String(env).trim() : "";
        if (!raw) return DEFAULT_IPFS_GATEWAY;

        // Allow passing either ".../ipfs/" or just the origin (e.g. "https://gateway.pinata.cloud").
        if (raw.includes("/ipfs/")) return raw.endsWith("/") ? raw : `${raw}/`;
        if (raw.endsWith("/ipfs")) return `${raw}/`;

        const base = raw.endsWith("/") ? raw : `${raw}/`;
        return `${base}ipfs/`;
    } catch {
        return DEFAULT_IPFS_GATEWAY;
    }
}

function toHttpUrl(uri) {
    if (!uri) return null;
    const s = String(uri).trim();
    if (!s) return null;

    if (s.startsWith("ipfs://")) {
        const path = s.slice("ipfs://".length).replace(/^ipfs\//, "");
        // If backend returned a demo CID (ipfs://demo-...), always fetch it from the local backend gateway.
        if (path.startsWith("demo-")) {
            const backend =
                typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_BACKEND_URL
                    ? String(import.meta.env.VITE_BACKEND_URL).replace(/\/$/, "")
                    : "";
            if (backend) return `${backend}/ipfs/${path}`;
        }
        return `${getIpfsGateway()}${path}`;
    }

    if (s.startsWith("http://") || s.startsWith("https://")) return s;
    if (s.startsWith("data:")) return s;

    // Allow relative paths for local dev (e.g. "/metadata/song1.json" or "metadata/song1.json")
    if (typeof window !== "undefined") {
        if (s.startsWith("/")) return `${window.location.origin}${s}`;
        return `${window.location.origin}/${s}`;
    }

    return s;
}

export function resolveUri(uri) {
    return toHttpUrl(uri);
}

export function extractDisplayNameFromUri(uri) {
    if (!uri) return null;
    const s = String(uri);
    const cleaned = s.replace(/^ipfs:\/\//, "").replace(/^https?:\/\//, "");
    const parts = cleaned.split(/[/?#]/g).filter(Boolean);
    const last = parts[parts.length - 1];
    return last || null;
}

export function normalizeMetadata(raw) {
    const obj = raw && typeof raw === "object" ? raw : {};
    const name = typeof obj.name === "string" ? obj.name : null;
    const description = typeof obj.description === "string" ? obj.description : null;
    const image = typeof obj.image === "string" ? obj.image : null;
    const attributes = Array.isArray(obj.attributes) ? obj.attributes : [];

    const traits = new Map();
    for (const a of attributes) {
        if (!a || typeof a !== "object") continue;
        const traitType = a.trait_type ?? a.traitType ?? a.key ?? a.name;
        const value = a.value ?? a.val;
        if (!traitType || value === undefined) continue;
        traits.set(String(traitType), value);
    }

    return {
        name,
        description,
        image,
        imageUrl: resolveUri(image),
        attributes,
        traits,
        raw: obj,
    };
}

export async function fetchMetadata(tokenURI) {
    const url = resolveUri(tokenURI);
    if (!url) return { ok: false, error: "Missing tokenURI", url: null, data: null };

    if (_jsonCache.has(url)) {
        try {
            const raw = await _jsonCache.get(url);
            return { ok: true, error: null, url, data: normalizeMetadata(raw) };
        } catch (e) {
            return { ok: false, error: e?.message || String(e), url, data: null };
        }
    }

    const p = (async () => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
        try {
            const res = await fetch(url, { method: "GET", signal: controller.signal });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        } catch (e) {
            if (e?.name === "AbortError") {
                throw new Error("Metadata fetch timed out");
            }
            throw e;
        } finally {
            clearTimeout(id);
        }
    })();

    _jsonCache.set(url, p);

    try {
        const raw = await p;
        return { ok: true, error: null, url, data: normalizeMetadata(raw) };
    } catch (e) {
        _jsonCache.delete(url);
        return { ok: false, error: e?.message || String(e), url, data: null };
    }
}
