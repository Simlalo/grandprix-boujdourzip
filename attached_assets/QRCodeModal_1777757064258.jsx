// ── أضف هذا المكوّن في نهاية CommitteeDashboard.jsx ──

function QRCodeModal({ onClose }) {
  const url = `${window.location.origin}/results`;

  // رسم QR بدون مكتبة — نستخدم Google Charts API
  const qrUrl = `https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=${encodeURIComponent(url)}&choe=UTF-8`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      alert('تم نسخ الرابط');
    } catch {
      // fallback
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 20,
    }}>
      <div style={{
        background: 'white', borderRadius: 20, padding: 28,
        width: '100%', maxWidth: 360, textAlign: 'center',
      }}>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>
          📲 مشاركة النتائج
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
          امسح الكود لمتابعة النتائج مباشرة
        </div>

        {/* QR Code */}
        <div style={{
          background: 'white', padding: 12, borderRadius: 12,
          border: '2px solid var(--border)', display: 'inline-block', marginBottom: 16,
        }}>
          <img
            src={qrUrl}
            alt="QR Code"
            width={200}
            height={200}
            style={{ display: 'block' }}
          />
        </div>

        {/* الرابط */}
        <div style={{
          background: '#f8fafc', borderRadius: 10, padding: '10px 14px',
          fontSize: 12, fontFamily: 'monospace', direction: 'ltr',
          wordBreak: 'break-all', marginBottom: 16, color: 'var(--primary)',
          fontWeight: 700,
        }}>
          {url}
        </div>

        <div className="flex gap-2">
          <button
            className="btn btn-accent"
            style={{ flex: 1, minHeight: 48, fontWeight: 700 }}
            onClick={copyLink}
          >
            📋 نسخ الرابط
          </button>
          <button
            className="btn btn-outline"
            style={{ flex: 1, minHeight: 48 }}
            onClick={onClose}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
