import shortLogo from "../../assets/KinyanShortLogo.png";

export default function PageHeader({ title, right }) {
    return (
        <div className="page-header">
            <div className="page-header-left">
                <img src={shortLogo} alt="Kinyan" className="brand-mark-wide" />
                <h2 className="page-title" style={{ margin: 0 }}>{title}</h2>
            </div>
            {right ? <div className="page-header-right">{right}</div> : null}
        </div>
    );
}
