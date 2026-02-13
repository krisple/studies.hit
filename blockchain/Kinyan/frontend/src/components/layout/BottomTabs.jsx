export default function BottomTabs({ active, onChange }) {
    const tabs = [
        { key: "market", label: "Market" },
        { key: "register", label: "Register" },
        { key: "profile", label: "Profile" },
    ];

    return (
        <div style={{
            position: "fixed",
            bottom: 14,
            left: 14,
            right: 14,
            margin: "0 auto",
            maxWidth: 980,
            border: "1px solid var(--border)",
            background: "rgba(255,255,255,0.06)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            display: "flex",
            gap: 8,
            padding: 8,
            borderRadius: 16,
            boxShadow: "var(--shadow)",
        }}>
            {tabs.map(t => (
                <button
                    key={t.key}
                    onClick={() => onChange(t.key)}
                    style={{
                        flex: 1,
                        border: "1px solid transparent",
                        background: active === t.key
                            ? "linear-gradient(180deg, var(--primary), var(--primary-2))"
                            : "transparent",
                        fontSize: 14,
                        cursor: "pointer",
                        fontWeight: active === t.key ? 700 : 500,
                        padding: "10px 12px",
                        borderRadius: 12,
                        color: active === t.key ? "white" : "var(--muted)",
                    }}
                >
                    {t.label}
                </button>
            ))}
        </div>
    );
}
