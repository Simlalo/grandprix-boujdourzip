import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const STATUS_LABELS = {
  draft: { text: 'مسودة', class: 'badge-draft' },
  submitted: { text: 'قيد المراجعة', class: 'badge-submitted' },
  approved: { text: 'مصادق عليها', class: 'badge-approved' },
  rejected: { text: 'مرفوضة', class: 'badge-rejected' },
};

const TYPE_LABELS = {
  education: 'تعليم',
  youth_culture: 'شباب وثقافة',
};

export default function CommitteeDashboard({ userType }) {
  const [tab, setTab] = useState('institutions');
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = userType.role === 'admin';

  useEffect(() => { loadInstitutions(); }, []);

  async function loadInstitutions() {
    setLoading(true);
    const { data } = await supabase
      .from('institutions')
      .select('*, athletes(count)')
      .order('created_at', { ascending: false });
    setInstitutions(data || []);
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  const stats = {
    total: institutions.length,
    submitted: institutions.filter(i => i.list_status === 'submitted').length,
    approved: institutions.filter(i => i.list_status === 'approved').length,
  };

  return (
    <>
      <header className="header">
        <div className="header-content">
          <div>
            <div className="header-title">لجنة التنظيم</div>
            <div className="header-subtitle">
              {isAdmin ? 'مدير النظام' : 'مشاهد فقط'}
            </div>
          </div>
          <button onClick={handleLogout} style={{ background: 'transparent', color: 'white', fontSize: 13 }}>
            خروج
          </button>
        </div>
      </header>

      <div className="container">
        <div className="flex gap-2 mb-4">
          <StatCard label="إجمالي المؤسسات" value={stats.total} />
          <StatCard label="بانتظار المراجعة" value={stats.submitted} highlight />
          <StatCard label="مصادق عليها" value={stats.approved} success />
        </div>

        <h2 className="page-title" style={{ fontSize: 18 }}>المؤسسات</h2>

        <div className="list">
          {institutions.length === 0 && (
            <div className="card text-center text-muted">
              لم تُسجَّل أي مؤسسة بعد
            </div>
          )}
          {institutions.map((inst) => (
            <InstitutionCard
              key={inst.id}
              institution={inst}
              isAdmin={isAdmin}
              onUpdate={loadInstitutions}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value, highlight, success }) {
  const color = highlight ? 'var(--accent)' : success ? 'var(--success)' : 'var(--primary)';
  return (
    <div className="card text-center" style={{ flex: 1, padding: 12 }}>
      <div style={{ fontSize: 24, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}

function InstitutionCard({ institution, isAdmin, onUpdate }) {
  const [showActions, setShowActions] = useState(false);
  const status = STATUS_LABELS[institution.list_status];
  const athleteCount = institution.athletes?.[0]?.count || 0;

  async function approve() {
    if (!confirm('المصادقة على هذه اللائحة؟')) return;
    await supabase
      .from('institutions')
      .update({
        list_status: 'approved',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', institution.id);
    onUpdate();
  }

  async function reject() {
    const reason = prompt('سبب الرفض:');
    if (!reason) return;
    await supabase
      .from('institutions')
      .update({
        list_status: 'rejected',
        rejection_reason: reason,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', institution.id);
    onUpdate();
  }

  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="flex justify-between items-center" onClick={() => setShowActions(!showActions)}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{institution.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {TYPE_LABELS[institution.type]} • {athleteCount} رياضي
          </div>
          <span className={`badge ${status.class}`} style={{ marginTop: 6 }}>
            {status.text}
          </span>
        </div>
      </div>

      {showActions && isAdmin && institution.list_status === 'submitted' && (
        <div className="flex gap-2 mt-4">
          <button className="btn btn-success" style={{ flex: 1 }} onClick={approve}>
            ✓ مصادقة
          </button>
          <button className="btn btn-danger" style={{ flex: 1 }} onClick={reject}>
            ✕ رفض
          </button>
        </div>
      )}
    </div>
  );
}
