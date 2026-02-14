import PageHeader from "./PageHeader";
import useWalletBalances from "../../lib/useWalletBalances";
import { formatUnits } from "../../lib/contracts";

export default function StickyHeader({ title, subtitle, right }) {
    const { eth, kny, decimals, symbol } = useWalletBalances();

    const knyPretty =
        kny !== null && decimals !== null ? `${formatUnits(kny, decimals)} ${symbol || "KNY"}` : "-";

    return (
        <div className="page-header-sticky">
            <div className="page-header-inner">
                <PageHeader title={title} subtitle={subtitle} right={right} />
                <div className="row" style={{ marginTop: 8 }}>
                    <div className="pill">
                        <span className="muted-2">ETH</span>
                        <span style={{ fontWeight: 700 }}>{eth ?? "-"}</span>
                    </div>
                    <div className="pill">
                        <span className="muted-2">{symbol || "KNY"}</span>
                        <span style={{ fontWeight: 700 }}>{knyPretty}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
