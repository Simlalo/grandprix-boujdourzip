function DownloadPage() {
  const FILE_ID = "1VeJo6BNn7vyd1zm1U2DXs6BJjxP03qge";
  const DOWNLOAD_URL = `https://drive.google.com/uc?export=download&id=${FILE_ID}`;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      fontFamily: "inherit",
    }}>
      <div style={{
        background: "#111",
        border: "1px solid #222",
        borderRadius: 20,
        padding: "40px 32px",
        width: "100%",
        maxWidth: 420,
        textAlign: "center",
        borderTop: "4px solid #CCFF00",
      }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>⬇️</div>

        <div style={{ fontSize: 24, fontWeight: 900, color: "white", marginBottom: 8 }}>
          Download
        </div>

        <div style={{ fontSize: 13, color: "#666", marginBottom: 28 }}>
          Windows 10/11 · 64-bit
        </div>

        <a href={DOWNLOAD_URL} style={{ textDecoration: "none" }}>
          <button style={{
            width: "100%",
            background: "#CCFF00",
            color: "#000",
            border: "none",
            borderRadius: 12,
            padding: "16px 24px",
            fontSize: 16,
            fontWeight: 900,
            cursor: "pointer",
            fontFamily: "inherit",
          }}>
            Download Now
          </button>
        </a>

        <div style={{ fontSize: 11, color: "#444", marginTop: 16 }}>
          Hosted on Google Drive
        </div>
      </div>
    </div>
  );
}

export default DownloadPage;
