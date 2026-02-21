import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: "1mb" }));

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    methods: ["GET", "POST"],
  })
);

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function hasEnv(name) {
  const v = process.env[name];
  return Boolean(v && String(v).trim());
}

function extractSpotifyTrackId(input) {
  if (!input) return null;

  if (/^[A-Za-z0-9]{10,}$/.test(input) && !input.includes("spotify.com")) {
    return input;
  }

  try {
    const url = new URL(input);
    const parts = url.pathname.split("/").filter(Boolean);
    const i = parts.indexOf("track");
    if (i !== -1 && parts[i + 1]) return parts[i + 1];

    if (input.startsWith("spotify:track:")) {
      return input.split(":")[2] || null;
    }
    return null;
  } catch {
    if (input.startsWith("spotify:track:")) {
      return input.split(":")[2] || null;
    }
    return null;
  }
}

let spotifyTokenCache = { token: null, expiresAt: 0 };

async function getSpotifyAccessToken() {
  if (!hasEnv("SPOTIFY_CLIENT_ID") || !hasEnv("SPOTIFY_CLIENT_SECRET")) {
    throw new Error("Missing Spotify client credentials");
  }

  const now = Date.now();
  if (spotifyTokenCache.token && now < spotifyTokenCache.expiresAt - 10_000) {
    return spotifyTokenCache.token;
  }

  const clientId = mustEnv("SPOTIFY_CLIENT_ID");
  const clientSecret = mustEnv("SPOTIFY_CLIENT_SECRET");

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify token error (${res.status}): ${text}`);
  }

  const data = await res.json();
  spotifyTokenCache.token = data.access_token;
  spotifyTokenCache.expiresAt = now + data.expires_in * 1000;
  return data.access_token;
}

async function fetchSpotifyTrackOEmbed(trackId) {
  const spotifyUrl = `https://open.spotify.com/track/${trackId}`;
  const res = await fetch(
    `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`,
    { method: "GET" }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify oEmbed error (${res.status}): ${text}`);
  }

  const data = await res.json();
  const rawTitle = typeof data.title === "string" ? data.title : "";
  const authorName = typeof data.author_name === "string" ? data.author_name : "";

  let name = rawTitle || `Spotify Track ${trackId}`;
  let artists = authorName || "";

  if (rawTitle.includes(" - ")) {
    const parts = rawTitle.split(" - ");
    if (parts[0]) name = parts[0].trim();
    if (!artists && parts.slice(1).join(" - ").trim()) artists = parts.slice(1).join(" - ").trim();
  }

  return {
    trackId,
    name,
    artists,
    album: "",
    imageUrl: typeof data.thumbnail_url === "string" ? data.thumbnail_url : null,
    spotifyUrl,
  };
}

async function fetchSpotifyTrack(trackId) {
  if (!hasEnv("SPOTIFY_CLIENT_ID") || !hasEnv("SPOTIFY_CLIENT_SECRET")) {
    return fetchSpotifyTrackOEmbed(trackId);
  }

  const token = await getSpotifyAccessToken();
  const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify track error (${res.status}): ${text}`);
  }

  const t = await res.json();
  const imageUrl = (t.album?.images && t.album.images[0]?.url) || null;

  return {
    trackId: t.id,
    name: t.name,
    artists: (t.artists || []).map((a) => a.name).join(", "),
    album: t.album?.name || "",
    imageUrl,
    spotifyUrl: t.external_urls?.spotify || null,
  };
}

const demoPins = new Map(); // cid -> { json, fileName, pinnedAt }

function makeDemoCid() {
  const rand = Math.random().toString(16).slice(2);
  return `demo-${Date.now().toString(36)}-${rand}`;
}

async function pinJsonToIPFS(jsonObj, fileName = "metadata.json") {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    const cid = makeDemoCid();
    demoPins.set(cid, { json: jsonObj, fileName, pinnedAt: Date.now() });
    return cid;
  }

  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pinataOptions: { cidVersion: 1 },
      pinataMetadata: {
        name: fileName,
      },
      pinataContent: jsonObj,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata pinJSON error (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.IpfsHash;
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    demoMode: !hasEnv("PINATA_JWT"),
    spotifyMode: hasEnv("SPOTIFY_CLIENT_ID") && hasEnv("SPOTIFY_CLIENT_SECRET") ? "web-api" : "oembed",
  });
  });

app.get("/ipfs/:cid", (req, res) => {
  const cid = String(req.params.cid || "").trim();
  const pin = demoPins.get(cid);
  if (!pin) return res.status(404).json({ error: "CID not found (demo gateway)" });
  res.json(pin.json);
});

app.get("/api/spotify/track", async (req, res) => {
  try {
    const input = String(req.query.input || "");
    const trackId = extractSpotifyTrackId(input);
    if (!trackId) {
      return res.status(400).json({ error: "Invalid Spotify track URL or id" });
    }

    const info = await fetchSpotifyTrack(trackId);
    res.json(info);
  } catch (e) {
    res.status(500).json({ error: e.message || "Unknown error" });
  }
});

app.post("/api/metadata/from-spotify", async (req, res) => {
  try {
    const { input, creator, extra } = req.body || {};
    const trackId = extractSpotifyTrackId(String(input || ""));
    if (!trackId) {
      return res.status(400).json({ error: "Invalid Spotify track URL or id" });
    }

    const track = await fetchSpotifyTrack(trackId);

    const metadata = {
      name: track.name,
      description: "Kinyan Song NFT",
      image: track.imageUrl,
      external_url: track.spotifyUrl,
      attributes: [
        { trait_type: "Artist", value: track.artists },
        { trait_type: "Album", value: track.album },
        { trait_type: "Spotify Track ID", value: track.trackId }
      ],
      ...(creator ? { creator } : {}),
      ...(extra && typeof extra === "object" ? extra : {}),
    };

    const cid = await pinJsonToIPFS(metadata, `spotify-${track.trackId}.json`);
    const tokenURI = `ipfs://${cid}`;

    res.json({ track, cid, tokenURI, metadata });
  } catch (e) {
    res.status(500).json({ error: e.message || "Unknown error" });
  }
});

const PORT = Number(process.env.PORT || 8787);
app.listen(PORT);
