import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const CATEGORY_LABELS = {
  katakit: 'كتاكيت',
  baraem: 'براعم',
  sighar: 'صغار',
  fityan: 'فتيان',
};

const STATUS_LABELS = {
  draft: { text: 'مسودة', class: 'badge-draft' },
  submitted: { text: 'مُرسَلة للمراجعة', class: 'badge-submitted' },
  approved: { text: 'مصادق عليها', class: 'badge-approved' },
  rejected: { text: 'مرفوضة', class: 'badge-rejected' },
};

export default function InstitutionDashboard({ institution }) {
  const [data, setData] = useState(null);
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const { data: inst } = await supabase
      .from('institutions')
      .select('*')
      .eq('id', institution.id)
      .single();

    const { data: ath } = await supabase
      .from('athletes')
      .select('*')
      .eq('institution_id', institution.id)
      .order('created_at', { ascending: false });

    setData(inst);
    setAthletes(ath || []);
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  async function handleSubmitList() {
    if (athletes.length === 0) {
      alert('لا يمكن إرسال لائحة فارغة');
      return;
    }
    if (!confirm(`هل أنت متأكد من إرسال لائحة تضم ${athletes.length} رياضي؟`)) return;

    const { error } = await supabase
      .from('institutions')
      .update({ list_status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('id', institution.id);

    if (error) alert('حدث خطأ: ' + error.message);
    else loadData();
  }

  async function handleDeleteAthlete(id) {
    if (!confirm('هل أنت متأكد من حذف هذا الرياضي؟')) return;
    await supabase.from('athletes').delete().eq('id', id);
    loadData();
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  const canEdit = data.list_status === 'draft' || data.list_status === 'submitted';
  const status = STATUS_LABELS[data.list_status];

  return (
    <>
      <header className="header">
        <div className="header-content">
          <div>
            <div className="header-title">{data.name}</div>
            <div className="header-subtitle">{data.responsible_name}</div>
          </div>
          <button onClick={handleLogout} style={{ background: 'transparent', color: 'white', fontSize: 13 }}>
            خروج
          </button>
        </div>
      </header>

      <div className="container">
        <div className="card mb-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="page-title" style={{ fontSize: 18 }}>حالة اللائحة</div>
              <span className={`badge ${status.class}`} style={{ marginTop: 6 }}>
                {status.text}
              </span>
            </div>
            <div className="text-center">
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--accent)' }}>
                {athletes.length}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>رياضي</div>
            </div>
          </div>

          {data.list_status === 'rejected' && data.rejection_reason && (
            <div className="alert alert-error mt-4">
              <strong>سبب الرفض:</strong> {data.rejection_reason}
            </div>
          )}

          {data.list_status === 'approved' && (
            <div className="alert alert-success mt-4">
              ✓ تمت المصادقة على لائحتك. التعديل لم يعد ممكناً.
            </div>
          )}
        </div>

        {canEdit && (
          <button
            className="btn btn-accent btn-block mb-4"
            onClick={() => setShowAddForm(true)}
          >
            + إضافة رياضي
          </button>
        )}

        {athletes.length > 0 && (
          <>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
              الرياضيون ({athletes.length})
            </h3>
            <div className="list mb-4">
              {athletes.map((a) => (
                <AthleteCard
                  key={a.id}
                  athlete={a}
                  canEdit={canEdit}
                  onDelete={() => handleDeleteAthlete(a.id)}
                />
              ))}
            </div>
          </>
        )}

        {data.list_status === 'draft' && athletes.length > 0 && (
          <button className="btn btn-success btn-block" onClick={handleSubmitList}>
            إرسال اللائحة للمصادقة
          </button>
        )}

        {data.list_status === 'submitted' && (
          <div className="alert alert-info">
            ⏳ لائحتك قيد المراجعة من طرف اللجنة.
          </div>
        )}
      </div>

      {showAddForm && (
        <AddAthleteModal
          institutionId={institution.id}
          onClose={() => setShowAddForm(false)}
          onSuccess={() => { setShowAddForm(false); loadData(); }}
        />
      )}
    </>
  );
}

function AthleteCard({ athlete, canEdit, onDelete }) {
  const fullName = `${athlete.first_name} ${athlete.last_name}`;
  const genderLabel = athlete.gender === 'male' ? 'ذكر' : 'أنثى';
  return (
    <div className="list-item">
      <div className="list-item-info">
        <div className="list-item-title">{fullName}</div>
        <div className="list-item-meta">
          {CATEGORY_LABELS[athlete.category]} • {genderLabel} • {new Date(athlete.birth_date).toLocaleDateString('ar')}
        </div>
        {athlete.duplicate_flag && (
          <span className="badge badge-warning" style={{ marginTop: 4 }}>⚠ ازدواجية محتملة</span>
        )}
      </div>
      {canEdit && (
        <button onClick={onDelete} style={{ background: 'transparent', color: 'var(--danger)', fontSize: 20, padding: 8 }}>
          ✕
        </button>
      )}
    </div>
  );
}

function AddAthleteModal({ institutionId, onClose, onSuccess }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function getCategory(year) {
    const y = parseInt(year);
    if (y === 2015 || y === 2016) return 'كتاكيت';
    if (y === 2013 || y === 2014) return 'براعم';
    if (y === 2011 || y === 2012) return 'صغار';
    if (y === 2009 || y === 2010) return 'فتيان';
    return null;
  }

  const category = birthYear ? getCategory(birthYear) : null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!category) {
      setError('سنة الميلاد خارج الفئات المسموحة');
      return;
    }

    setLoading(true);
    const birthDate = `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`;

    const { error } = await supabase.from('athletes').insert({
      institution_id: institutionId,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      gender,
      birth_date: birthDate,
    });

    if (error) {
      setError('خطأ: ' + error.message);
      setLoading(false);
    } else {
      onSuccess();
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', zIndex: 100,
    }}>
      <div style={{
        background: 'white', width: '100%', maxHeight: '90vh',
        borderRadius: '20px 20px 0 0', padding: 20, overflowY: 'auto',
      }}>
        <div className="flex justify-between items-center mb-4">
          <h2 style={{ fontSize: 18, fontWeight: 900 }}>إضافة رياضي</h2>
          <button onClick={onClose} style={{ background: 'transparent', fontSize: 24 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-group">
            <label className="form-label">الاسم الشخصي</label>
            <input
              type="text" className="form-input" value={firstName}
              onChange={(e) => setFirstName(e.target.value)} required
            />
          </div>

          <div className="form-group">
            <label className="form-label">الاسم العائلي</label>
            <input
              type="text" className="form-input" value={lastName}
              onChange={(e) => setLastName(e.target.value)} required
            />
          </div>

          <div className="form-group">
            <label className="form-label">الجنس</label>
            <select
              className="form-select" value={gender}
              onChange={(e) => setGender(e.target.value)} required
            >
              <option value="">اختر...</option>
              <option value="male">ذكر</option>
              <option value="female">أنثى</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">تاريخ الميلاد</label>
            <div className="flex gap-2">
              <select className="form-select" value={birthDay} onChange={(e) => setBirthDay(e.target.value)} required>
                <option value="">اليوم</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <select className="form-select" value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)} required>
                <option value="">الشهر</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select className="form-select" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} required>
                <option value="">السنة</option>
                {[2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            {category && (
              <div className="alert alert-info mt-2" style={{ marginBottom: 0 }}>
                الفئة: <strong>{category}</strong>
              </div>
            )}
          </div>

          <button type="submit" className="btn btn-accent btn-block mt-4" disabled={loading}>
            {loading ? 'جاري الإضافة...' : 'إضافة الرياضي'}
          </button>
          <button type="button" className="btn btn-outline btn-block mt-2" onClick={onClose}>
            إلغاء
          </button>
        </form>
      </div>
    </div>
  );
}
