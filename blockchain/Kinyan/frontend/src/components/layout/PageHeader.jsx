import shortLogo from "../../assets/KinyanShortLogo.png";

export default function PageHeader({ title, right, subtitle }) {
    return (
        <div className="page-header">
            <div className="page-header-left">
                <img src={shortLogo} alt="Kinyan" className="brand-mark-wide" />
                <div>
                    <h2 className="page-title" style={{ margin: 0 }}>{title}</h2>
                    {subtitle ? <div className="muted-2" style={{ fontSize: 12, marginTop: 2 }}>{subtitle}</div> : null}
                </div>
            </div>
            {right ? <div className="page-header-right">{right}</div> : null}
        </div>
    );
}
