import { useContext, useState } from "react";
import BottomTabs from "./components/layout/BottomTabs";
import RegisterPage from "./pages/RegisterPage";
import MarketPage from "./pages/MarketPage";
import ProfilePage from "./pages/ProfilePage";
import SplashPage from "./pages/SplashPage";
import { AppContext } from "./context/appContext";

export default function App() {
    const { connected } = useContext(AppContext);
    const [tab, setTab] = useState("market");

    if (!connected) {
        return <SplashPage />;
    }

    return (
        <div className="app-shell">
            {tab === "register" && <RegisterPage />}
            {tab === "market" && <MarketPage />}
            {tab === "profile" && <ProfilePage />}

            <BottomTabs active={tab} onChange={setTab} />
        </div>
    );
}
