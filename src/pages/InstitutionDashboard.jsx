import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const STATUS_LABELS = {
  draft: { text: 'مسودة', class: 'badge-draft' },
  submitted: { text: 'مُرسَلة للمراجعة', class: 'badge-submitted' },
  approved: { text: 'مصادق عليها', class: 'badge-approved' },
  rejected: { text: 'مرفوضة', class: 'badge-rejected' },
};

const SCHOOL_CYCLES = {
  primary: {
    label: 'ابتدائي',
    levels: [
      'السنة الأولى ابتدائي',
      'السنة الثانية ابتدائي',
      'السنة الثالثة ابتدائي',
      'السنة الرابعة ابتدائي',
      'السنة الخامسة ابتدائي',
      'السنة السادسة ابتدائي',
    ],
    default: 'السنة السادسة ابتدائي',
  },
  middle: {
    label: 'إعدادي',
    levels: [
      'السنة الأولى إعدادي',
      'السنة الثانية إعدادي',
      'السنة الثالثة إعدادي',
    ],
    default: 'السنة الأولى إعدادي',
  },
  high: {
    label: 'تأهيلي',
    levels: [
      'جذع مشترك',
      'الأولى باكالوريا',
      'الثانية باكالوريا',
    ],
    default: 'جذع مشترك',
  },
};

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

function validateMassarCode(code) {
  if (!code) return true;
  return /^[A-Za-z]\d{9}$/.test(code.trim());
}

export default function InstitutionDashboard({ institution }) {
  const [data, setData] = useState(null);
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deadline, setDeadline] = useState(null);

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

    const { data: settingData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'registration_deadline')
      .single();
    setDeadline(settingData?.value ? new Date(settingData.value) : null);

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

  const isDeadlinePassed = deadline && new Date() > deadline;
  const canEdit = (data.list_status === 'draft' || data.list_status === 'submitted') && !isDeadlinePassed;
  const canEditDossard = data.list_status !== 'rejected' && !isDeadlinePassed;
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

        {isDeadlinePassed && (
          <div className="alert alert-warning mb-4">
            ⏰ <strong>انتهى موعد التسجيل في 13 ماي 2026.</strong>
            <br />
            لا يمكن التعديل. للحالات الاستثنائية تواصل مع لجنة التنظيم.
          </div>
        )}

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
                  canEditDossard={canEditDossard}
                  onDelete={() => handleDeleteAthlete(a.id)}
                  onUpdate={loadData}
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

function AthleteCard({ athlete, canEdit, canEditDossard, onDelete, onUpdate }) {
  const [editingDossard, setEditingDossard] = useState(false);
  const [dossardValue, setDossardValue] = useState(athlete.dossard_number || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fullName = `${athlete.first_name} ${athlete.last_name}`;
  const genderLabel = athlete.gender === 'male' ? 'ذكر' : 'أنثى';

  async function saveDossard() {
    setError('');
    setSaving(true);

    const numValue = dossardValue === '' ? null : parseInt(dossardValue);

    if (numValue !== null && (isNaN(numValue) || numValue < 1)) {
      setError('رقم غير صحيح');
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('athletes')
      .update({ dossard_number: numValue })
      .eq('id', athlete.id);

    if (updateError) {
      if (updateError.code === '23505') {
        setError('هذا الرقم مستخدم في نفس الفئة');
      } else {
        setError('خطأ: ' + updateError.message);
      }
      setSaving(false);
      return;
    }

    setEditingDossard(false);
    setSaving(false);
    onUpdate();
  }

  return (
    <div className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div className="flex justify-between items-center w-full">
        <div className="list-item-info">
          <div className="list-item-title">{fullName}</div>
          <div className="list-item-meta">
            {getCategoryLabel(athlete.category, athlete.gender)} • {genderLabel} • {new Date(athlete.birth_date).toLocaleDateString('ar')}
          </div>
          {athlete.massar_code && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, direction: 'ltr', textAlign: 'right' }}>
              Massar: <strong>{athlete.massar_code}</strong>
            </div>
          )}
          {athlete.school_level && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {athlete.school_level}
            </div>
          )}
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

      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
        {!editingDossard ? (
          <div className="flex justify-between items-center">
            <div style={{ fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>رقم الصدرية: </span>
              {athlete.dossard_number ? (
                <strong style={{ color: 'var(--accent)', fontSize: 16 }}>
                  {athlete.dossard_number}
                </strong>
              ) : (
                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>غير محدد</span>
              )}
            </div>
            {canEditDossard && (
              <button
                onClick={() => setEditingDossard(true)}
                style={{ background: 'transparent', color: 'var(--accent)', fontSize: 13, padding: 4 }}
              >
                {athlete.dossard_number ? 'تعديل' : '+ إضافة'}
              </button>
            )}
          </div>
        ) : (
          <div>
            {error && <div className="alert alert-error" style={{ marginBottom: 8, fontSize: 12, padding: 8 }}>{error}</div>}
            <div className="flex gap-2">
              <input
                type="number"
                className="form-input"
                value={dossardValue}
                onChange={(e) => setDossardValue(e.target.value)}
                placeholder="مثال: 47"
                dir="ltr"
                style={{ flex: 1, minHeight: 40 }}
                min="1"
                autoFocus
              />
              <button
                className="btn btn-success"
                onClick={saveDossard}
                disabled={saving}
                style={{ minWidth: 60, minHeight: 40, padding: '0 12px', fontSize: 13 }}
              >
                {saving ? '...' : 'حفظ'}
              </button>
              <button
                className="btn btn-outline"
                onClick={() => {
                  setEditingDossard(false);
                  setDossardValue(athlete.dossard_number || '');
                  setError('');
                }}
                style={{ minWidth: 50, minHeight: 40, padding: '0 12px', fontSize: 13 }}
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
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
  const [massarCode, setMassarCode] = useState('');
  const [schoolCycle, setSchoolCycle] = useState('primary');
  const [schoolLevel, setSchoolLevel] = useState(SCHOOL_CYCLES.primary.default);

  function handleCycleChange(cycle) {
    setSchoolCycle(cycle);
    setSchoolLevel(SCHOOL_CYCLES[cycle].default);
  }
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function getCategory(year, gender) {
    const y = parseInt(year);
    const isMale = gender === 'male';
    if (y === 2015 || y === 2016) return isMale ? 'كتاكيت ذكور' : 'كتاكيت إناث';
    if (y === 2013 || y === 2014) return isMale ? 'براعم' : 'برعمات';
    if (y === 2011 || y === 2012) return isMale ? 'صغار' : 'صغيرات';
    if (y === 2009 || y === 2010) return isMale ? 'فتيان' : 'فتيات';
    return null;
  }

  const category = birthYear && gender ? getCategory(birthYear, gender) : null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!category) {
      setError('سنة الميلاد خارج الفئات المسموحة');
      return;
    }

    if (!schoolCycle) {
      setError('اختر السلك');
      return;
    }

    if (!schoolLevel) {
      setError('اختر المستوى الدراسي');
      return;
    }

    if (massarCode && !validateMassarCode(massarCode)) {
      setError('رمز Massar غير صحيح — يجب أن يكون حرفاً يليه 9 أرقام (مثال: N123456789)');
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
      massar_code: massarCode.trim().toUpperCase() || null,
      school_level: schoolLevel || null,
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

          <div className="form-group">
            <label className="form-label">السلك</label>
            <select
              className="form-select"
              value={schoolCycle}
              onChange={(e) => handleCycleChange(e.target.value)}
              required
            >
              {Object.entries(SCHOOL_CYCLES).map(([key, cycle]) => (
                <option key={key} value={key}>{cycle.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">المستوى الدراسي</label>
            <select
              className="form-select"
              value={schoolLevel}
              onChange={(e) => setSchoolLevel(e.target.value)}
              required
            >
              {SCHOOL_CYCLES[schoolCycle].levels.map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">
              رمز Massar
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>(اختياري)</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={massarCode}
              onChange={(e) => setMassarCode(e.target.value.toUpperCase())}
              placeholder="مثال: N123456789"
              dir="ltr"
              style={{ letterSpacing: '1px' }}
              maxLength={10}
            />
            {massarCode && !validateMassarCode(massarCode) && (
              <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
                التنسيق غير صحيح — حرف + 9 أرقام
              </div>
            )}
            {massarCode && validateMassarCode(massarCode) && (
              <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 4 }}>
                ✓ صحيح
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
