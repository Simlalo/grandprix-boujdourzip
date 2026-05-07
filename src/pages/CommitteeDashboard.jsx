import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import RaceDayPanel from './RaceDayPanel';
import FinalResultsPanel from './FinalResultsPanel';

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
  const [view, setView] = useState('home');
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const isAdmin = userType.role === 'admin' || userType.role === 'super_admin';
  const isSuperAdmin = userType.role === 'super_admin';

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
          <div className="flex items-center gap-2">
            {view !== 'home' && (
              <button
                onClick={() => setView('home')}
                style={{ background: 'transparent', color: 'white', fontSize: 22, padding: '0 8px' }}
              >
                →
              </button>
            )}
            <div>
              <div className="header-title">
                {view === 'home' && 'لجنة التنظيم'}
                {view === 'institutions' && 'المؤسسات'}
                {view === 'race' && 'يوم السباق'}
                {view === 'results' && 'النتائج النهائية'}
              </div>
              <div className="header-subtitle">
                {isAdmin ? 'مدير النظام' : 'مشاهد فقط'}
              </div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ background: 'transparent', color: 'white', fontSize: 13 }}>
            خروج
          </button>
        </div>
      </header>

      <div className="container">
        {/* ============ الصفحة الرئيسية ============ */}
        {view === 'home' && (
          <>
            <div className="flex gap-2 mb-4">
              <StatCard label="إجمالي المؤسسات" value={stats.total} />
              <StatCard label="بانتظار المراجعة" value={stats.submitted} highlight />
              <StatCard label="مصادق عليها" value={stats.approved} success />
            </div>

            <div className="flex flex-col gap-4 mt-4">
              <NavCard
                icon="🏫"
                title="المؤسسات"
                subtitle={`${stats.total} مؤسسة • ${stats.submitted} بانتظار المراجعة`}
                onClick={() => setView('institutions')}
              />
              <NavCard
                icon="🏁"
                title="يوم السباق"
                subtitle="إدخال نتائج السباقات"
                onClick={() => setView('race')}
              />
              <NavCard
                icon="🏆"
                title="النتائج النهائية"
                subtitle="الترتيب العام والفئات"
                onClick={() => setView('results')}
              />
              <button
                className="btn btn-outline btn-block"
                style={{ marginTop: -8, fontSize: 13, minHeight: 44 }}
                onClick={() => setShowQR(true)}
              >
                📲 مشاركة النتائج مع الجمهور
              </button>
            </div>
          </>
        )}

        {/* ============ قسم المؤسسات ============ */}
        {view === 'institutions' && (
          <>
            {isAdmin && (
              <button
                className="btn btn-accent btn-block mb-4"
                onClick={() => setShowAddForm(true)}
              >
                + إضافة مؤسسة جديدة
              </button>
            )}

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
          </>
        )}

        {/* ============ قسم يوم السباق ============ */}
        {view === 'race' && (
          <RaceDayPanel isAdmin={isAdmin} />
        )}

        {/* ============ قسم النتائج النهائية ============ */}
        {view === 'results' && (
          <FinalResultsPanel />
        )}
      </div>

      {showAddForm && (
        <AddInstitutionModal
          onClose={() => setShowAddForm(false)}
          onSuccess={() => { setShowAddForm(false); loadInstitutions(); }}
        />
      )}
      {showQR && <QRCodeModal onClose={() => setShowQR(false)} />}
    </>
  );
}

function NavCard({ icon, title, subtitle, onClick }) {
  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        padding: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        transition: 'transform 0.1s',
      }}
    >
      <div style={{ fontSize: 40 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 18, fontWeight: 900 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          {subtitle}
        </div>
      </div>
      <div style={{ fontSize: 24, color: 'var(--text-muted)' }}>‹</div>
    </div>
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
  const [athletes, setAthletes] = useState(null);
  const [loadingAthletes, setLoadingAthletes] = useState(false);

  const status = STATUS_LABELS[institution.list_status];
  const athleteCount = institution.athletes?.[0]?.count || 0;

  async function toggleDetails() {
    if (!showActions && !athletes) {
      setLoadingAthletes(true);
      const { data } = await supabase
        .from('athletes')
        .select('*')
        .eq('institution_id', institution.id)
        .order('category')
        .order('last_name');
      setAthletes(data || []);
      setLoadingAthletes(false);
    }
    setShowActions(!showActions);
  }

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

  function getCategoryLabel(category, gender) {
    const isMale = gender === 'male';
    const labels = {
      katakit: isMale ? 'كتاكيت ذكور' : 'كتاكيت إناث',
      baraem: isMale ? 'براعم' : 'برعمات',
      sighar: isMale ? 'صغار' : 'صغيرات',
      fityan: isMale ? 'فتيان' : 'فتيات',
    };
    return labels[category] || category;
  }

  return (
    <div className="card" style={{ padding: 14 }}>
      <div onClick={toggleDetails} style={{ cursor: 'pointer' }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{institution.name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {TYPE_LABELS[institution.type]} • {athleteCount} رياضي
        </div>
        {institution.responsible_name && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            المسؤول: {institution.responsible_name}
          </div>
        )}
        <div className="flex justify-between items-center mt-2">
          <span className={`badge ${status.class}`}>{status.text}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {showActions ? '▲ إخفاء' : '▼ عرض اللائحة'}
          </span>
        </div>
      </div>

      {showActions && (
        <>
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
            {loadingAthletes && <div className="text-center text-muted">جاري التحميل...</div>}

            {athletes && athletes.length === 0 && (
              <div className="text-center text-muted">لا يوجد رياضيون مسجلون</div>
            )}

            {athletes && athletes.length > 0 && (
              <>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
                  الرياضيون ({athletes.length})
                </div>
                <div className="list">
                  {athletes.map((a) => (
                    <div key={a.id} style={{
                      background: '#f8fafc',
                      padding: 10,
                      borderRadius: 8,
                      marginBottom: 4,
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {a.first_name} {a.last_name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {getCategoryLabel(a.category, a.gender)} • {a.gender === 'male' ? 'ذكر' : 'أنثى'} • {new Date(a.birth_date).toLocaleDateString('ar')}
                        {a.duplicate_flag && (
                          <span className="badge badge-warning" style={{ marginRight: 6 }}>⚠ ازدواجية</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {isAdmin && institution.list_status === 'submitted' && (
            <div className="flex gap-2 mt-4">
              <button className="btn btn-success" style={{ flex: 1 }} onClick={approve}>
                ✓ مصادقة
              </button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={reject}>
                ✕ رفض
              </button>
            </div>
          )}

          {institution.list_status === 'approved' && (
            <div className="alert alert-success" style={{ marginTop: 12, marginBottom: 0 }}>
              ✓ تمت المصادقة على هذه اللائحة
            </div>
          )}

          {institution.list_status === 'rejected' && institution.rejection_reason && (
            <div className="alert alert-error" style={{ marginTop: 12, marginBottom: 0 }}>
              <strong>سبب الرفض:</strong> {institution.rejection_reason}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AddInstitutionModal({ onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [type, setType] = useState('');
  const [predefinedList, setPredefinedList] = useState([]);
  const [youthTypes, setYouthTypes] = useState([]);
  const [selectedPredefined, setSelectedPredefined] = useState('');
  const [selectedYouthType, setSelectedYouthType] = useState('');
  const [customYouthName, setCustomYouthName] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdInfo, setCreatedInfo] = useState(null);

  useEffect(() => {
    loadReferenceData();
  }, []);

  async function loadReferenceData() {
    const { data: edu } = await supabase
      .from('predefined_educational_institutions')
      .select('*')
      .order('display_order');
    setPredefinedList(edu || []);

    const { data: youth } = await supabase
      .from('youth_institution_types')
      .select('*')
      .order('display_order');
    setYouthTypes(youth || []);
  }

  function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let pw = '';
    for (let i = 0; i < 8; i++) {
      pw += chars[Math.floor(Math.random() * chars.length)];
    }
    return pw;
  }

  function handleNext() {
    setError('');
    if (step === 1) {
      if (!type) {
        setError('اختر القطاع');
        return;
      }
      if (type === 'education' && !selectedPredefined) {
        setError('اختر المؤسسة من القائمة');
        return;
      }
      if (type === 'youth_culture') {
        if (!selectedYouthType) {
          setError('اختر نوع المؤسسة');
          return;
        }
        if (!customYouthName.trim()) {
          setError('اكتب اسم المؤسسة');
          return;
        }
      }
      setPassword(generatePassword());
      setStep(2);
    }
  }

  async function handleCreate() {
    setError('');
    setLoading(true);

    let institutionName = '';
    if (type === 'education') {
      const found = predefinedList.find(p => p.id === parseInt(selectedPredefined));
      institutionName = found?.name || '';
    } else {
      const youthType = youthTypes.find(y => y.id === parseInt(selectedYouthType));
      institutionName = `${youthType?.name || ''} - ${customYouthName.trim()}`;
    }

    const { data, error: rpcError } = await supabase.rpc('admin_create_institution', {
      p_email: email.trim(),
      p_password: password,
      p_name: institutionName,
      p_type: type,
      p_responsible_name: responsibleName.trim(),
      p_phone: phone.trim(),
      p_predefined_id: type === 'education' ? parseInt(selectedPredefined) : null,
      p_youth_type_id: type === 'youth_culture' ? parseInt(selectedYouthType) : null,
    });

    if (rpcError) {
      setError('خطأ: ' + rpcError.message);
      setLoading(false);
      return;
    }

    setCreatedInfo({
      name: institutionName,
      email,
      password,
    });
    setStep(3);
    setLoading(false);
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      alert('تم النسخ');
    } catch {
      // fallback
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', zIndex: 100,
    }}>
      <div style={{
        background: 'white', width: '100%', maxHeight: '95vh',
        borderRadius: '20px 20px 0 0', padding: 20, overflowY: 'auto',
      }}>
        <div className="flex justify-between items-center mb-4">
          <h2 style={{ fontSize: 18, fontWeight: 900 }}>
            {step === 1 && 'إضافة مؤسسة - الخطوة 1/2'}
            {step === 2 && 'إضافة مؤسسة - الخطوة 2/2'}
            {step === 3 && '✓ تم الإنشاء بنجاح'}
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', fontSize: 24 }}>✕</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {step === 1 && (
          <>
            <div className="form-group">
              <label className="form-label">القطاع</label>
              <select
                className="form-select"
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setSelectedPredefined('');
                  setSelectedYouthType('');
                }}
              >
                <option value="">اختر...</option>
                <option value="education">التربية الوطنية</option>
                <option value="youth_culture">الشباب والثقافة</option>
              </select>
            </div>

            {type === 'education' && (
              <div className="form-group">
                <label className="form-label">المؤسسة التعليمية</label>
                <select
                  className="form-select"
                  value={selectedPredefined}
                  onChange={(e) => setSelectedPredefined(e.target.value)}
                >
                  <option value="">اختر المؤسسة...</option>
                  <option disabled>━━ ابتدائي ━━</option>
                  {predefinedList.filter(p => p.sector === 'public' && p.level === 'ابتدائي').map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                  <option disabled>━━ إعدادي ━━</option>
                  {predefinedList.filter(p => p.sector === 'public' && p.level === 'إعدادي').map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                  <option disabled>━━ تأهيلي ━━</option>
                  {predefinedList.filter(p => p.sector === 'public' && p.level === 'تأهيلي').map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                  <option disabled>━━ خصوصي ━━</option>
                  {predefinedList.filter(p => p.sector === 'private').map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            {type === 'youth_culture' && (
              <>
                <div className="form-group">
                  <label className="form-label">نوع المؤسسة</label>
                  <select
                    className="form-select"
                    value={selectedYouthType}
                    onChange={(e) => setSelectedYouthType(e.target.value)}
                  >
                    <option value="">اختر النوع...</option>
                    {youthTypes.map(y => (
                      <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">اسم المؤسسة</label>
                  <input
                    type="text"
                    className="form-input"
                    value={customYouthName}
                    onChange={(e) => setCustomYouthName(e.target.value)}
                    placeholder="مثال: دار الشباب المركزية"
                  />
                </div>
              </>
            )}

            <button
              type="button"
              className="btn btn-accent btn-block mt-4"
              onClick={handleNext}
            >
              التالي ←
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="form-group">
              <label className="form-label">اسم المسؤول</label>
              <input
                type="text"
                className="form-input"
                value={responsibleName}
                onChange={(e) => setResponsibleName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">رقم الهاتف</label>
              <input
                type="tel"
                className="form-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                dir="ltr"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">البريد الإلكتروني</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                dir="ltr"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">كلمة المرور</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  dir="ltr"
                  style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700 }}
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setPassword(generatePassword())}
                  style={{ minWidth: 100 }}
                >
                  🎲 جديدة
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                احفظها — ستحتاجها لتسليمها للمؤسسة
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setStep(1)}
                style={{ flex: 1 }}
              >
                → السابق
              </button>
              <button
                type="button"
                className="btn btn-accent"
                onClick={handleCreate}
                disabled={loading}
                style={{ flex: 2 }}
              >
                {loading ? 'جاري الإنشاء...' : 'إنشاء المؤسسة'}
              </button>
            </div>
          </>
        )}

        {step === 3 && createdInfo && (
          <>
            <div className="alert alert-success">
              تم إنشاء المؤسسة بنجاح. سلّم البيانات التالية للمسؤول:
            </div>

            <div className="card" style={{ background: '#f8fafc', marginBottom: 16 }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>المؤسسة</div>
                <div style={{ fontWeight: 700 }}>{createdInfo.name}</div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>البريد الإلكتروني</div>
                <div className="flex justify-between items-center">
                  <div style={{ fontFamily: 'monospace', fontWeight: 700 }} dir="ltr">
                    {createdInfo.email}
                  </div>
                  <button
                    onClick={() => copyToClipboard(createdInfo.email)}
                    style={{ background: 'transparent', fontSize: 18 }}
                  >
                    📋
                  </button>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>كلمة المرور</div>
                <div className="flex justify-between items-center">
                  <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 18 }} dir="ltr">
                    {createdInfo.password}
                  </div>
                  <button
                    onClick={() => copyToClipboard(createdInfo.password)}
                    style={{ background: 'transparent', fontSize: 18 }}
                  >
                    📋
                  </button>
                </div>
              </div>
            </div>

            <div className="alert alert-warning">
              ⚠ احفظ كلمة المرور الآن — لن تظهر مرة أخرى
            </div>

            <button
              className="btn btn-primary btn-block"
              onClick={onSuccess}
            >
              إنهاء
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pw = '';
  for (let i = 0; i < 8; i++) {
    pw += chars[Math.floor(Math.random() * chars.length)];
  }
  return pw;
}

function QRCodeModal({ onClose }) {
  const url = `${window.location.origin}/results`;
  const canvasRef = useState(null);
  const [canvasEl, setCanvasEl] = canvasRef;

  useEffect(() => {
    if (!canvasEl) return;
    import('qrcode').then(QRCode => {
      QRCode.toCanvas(canvasEl, url, {
        width: 220,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
    });
  }, [canvasEl]);

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

        <div style={{
          background: 'white', padding: 12, borderRadius: 12,
          border: '2px solid var(--border)', display: 'inline-block', marginBottom: 16,
        }}>
          <canvas ref={setCanvasEl} style={{ display: 'block' }} />
        </div>

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
