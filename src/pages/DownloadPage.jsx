export default function DownloadPage() {
  const FILE_ID = "1VeJo6BNn7vyd1zm1U2DXs6BJjxP03qge";
  const DOWNLOAD_URL = `https://drive.google.com/uc?export=download&id=${FILE_ID}`;

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--primary)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: "white",
        borderRadius: 20,
        padding: "40px 32px",
        width: "100%",
        maxWidth: 420,
        textAlign: "center",
        borderTop: "5px solid var(--accent)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
      }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>⬇️</div>

        <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>
          تحميل التطبيق
        </div>

        <div style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>
          Windows 10/11 · 64-bit
        </div>

        <a href={DOWNLOAD_URL} style={{ textDecoration: "none" }}>
          <button style={{
            width: "100%",
            background: "#F5C500",
            color: "#111",
            border: "none",
            borderRadius: 12,
            padding: "16px 24px",
            fontSize: 17,
            fontWeight: 900,
            cursor: "pointer",
            fontFamily: "inherit",
          }}>
            ⬇️ تحميل الآن
          </button>
        </a>

        <div style={{ fontSize: 11, color: "#aaa", marginTop: 16 }}>
          يتم التحميل من Google Drive
        </div>
      </div>
    </div>
  );
}
