import { useContext, useState } from "react";
import { AppContext } from "../context/appContext";
import logo from "../assets/KinyanLogo.png";

export default function SplashPage() {
    const { metaMaskAvailable, connect, error, setError } = useContext(AppContext);
    const [busy, setBusy] = useState(false);

    async function onConnect() {
        try {
            setError(null);
            setBusy(true);
            await connect();
        } catch (e) {
            setError(e?.message || String(e));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="container" style={{ paddingTop: 48 }}>
            <div className="card">
                <div style={{ textAlign: "center" }}>
                    <img
                        src={logo}
                        alt="Kinyan"
                        style={{
                            height: 220,
                            width: "auto",
                            maxWidth: "100%",
                            display: "block",
                            margin: "8px auto 14px",
                            filter: "drop-shadow(0 16px 30px rgba(0,0,0,0.35))",
                        }}
                    />
                </div>

                {!metaMaskAvailable && (
                    <div className="error" style={{ marginTop: 14 }}>
                        MetaMask not detected. Please install MetaMask.
                    </div>
                )}

                <button
                    onClick={onConnect}
                    disabled={!metaMaskAvailable || busy}
                    className="btn btn-primary"
                    style={{ marginTop: 16, width: "100%" }}
                >
                    {busy ? "Connecting..." : "Connect MetaMask"}
                </button>

                {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
            </div>
        </div>
    );
}
