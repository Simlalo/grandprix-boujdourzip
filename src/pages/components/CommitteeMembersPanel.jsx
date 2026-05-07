export default function CommitteeMembersPanel({ isSuperAdmin, onBack }) {
  return (
    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>إدارة أعضاء اللجنة</div>
      <div style={{ fontSize: 13 }}>سيتم تفعيل هذا القسم قريباً</div>
      <button className="btn btn-outline" style={{ marginTop: 20 }} onClick={onBack}>
        ← الرجوع
      </button>
    </div>
  );
}
