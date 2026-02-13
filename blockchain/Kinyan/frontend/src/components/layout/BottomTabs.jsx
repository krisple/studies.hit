export default function BottomTabs({ active, onChange }) {
    const tabs = [
        { key: "wallet", label: "Wallet" },
        { key: "register", label: "Register" },
        { key: "market", label: "Market" },
        { key: "profile", label: "Profile" },
    ];

    return (
        <div style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            borderTop: "1px solid #ddd",
            background: "white",
            display: "flex",
            height: 56
        }}>
            {tabs.map(t => (
                <button
                    key={t.key}
                    onClick={() => onChange(t.key)}
                    style={{
                        flex: 1,
                        border: "none",
                        background: "transparent",
                        fontSize: 14,
                        cursor: "pointer",
                        fontWeight: active === t.key ? 700 : 400
                    }}
                >
                    {t.label}
                </button>
            ))}
        </div>
    );
}
