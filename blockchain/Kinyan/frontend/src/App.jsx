import { useState } from "react";
import BottomTabs from "./components/layout/BottomTabs";
import WalletPage from "./pages/WalletPage";
import RegisterPage from "./pages/RegisterPage";
import MarketPage from "./pages/MarketPage";
import ProfilePage from "./pages/ProfilePage";

export default function App() {
    const [tab, setTab] = useState("wallet");

    return (
        <div style={{ paddingBottom: 72 }}>
            {tab === "wallet" && <WalletPage />}
            {tab === "register" && <RegisterPage />}
            {tab === "market" && <MarketPage />}
            {tab === "profile" && <ProfilePage />}

            <BottomTabs active={tab} onChange={setTab} />
        </div>
    );
}
