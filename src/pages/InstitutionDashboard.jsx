import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import CategoryCounters from '../components/athletes/CategoryCounters';
import AthletesList from '../components/athletes/AthletesList';
import { MAX_PER_CATEGORY } from '../lib/categories';

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

function validateMassarCode(code) {
  if (!code) return true;
  return /^[A-Za-z]\d{9}$/.test(code.trim());
}

export default function InstitutionDashboard({
  institution,
  hasDualRole,
  onSwitchToCommittee,
  onLogout,
}) {
  const [data, setData] = useState(null);
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deadline, setDeadline] = useState(null);
  const [dossardAthlete, setDossardAthlete] = useState(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const { data: inst } = await supabase
      .from('institutions')
      .select('*, predefined:predefined_educational_institutions(level)')
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
    if (onLogout) {
      await onLogout();
    } else {
      await supabase.auth.signOut();
    }
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

  async function handleDeleteAthlete(athlete) {
    if (!confirm('هل أنت متأكد من حذف هذا الرياضي؟')) return;
    await supabase.from('athletes').delete().eq('id', athlete.id);
    loadData();
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  const isDeadlinePassed = deadline && new Date() > deadline;
  const isFreeParticipants = data.is_free_participants === true;
  const canEdit = isFreeParticipants
    || ((data.list_status === 'draft' || data.list_status === 'submitted') && !isDeadlinePassed);
  const canEditDossard = isFreeParticipants
    || (data.list_status !== 'rejected' && !isDeadlinePassed);
  const status = STATUS_LABELS[data.list_status];

  return (
    <>
      <header className="header">
        <div className="header-content">
          <div>
            <div className="header-title">{data.name}</div>
            <div className="header-subtitle">{data.responsible_name}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {hasDualRole && (
              <button
                onClick={onSwitchToCommittee}
                className="btn btn-outline"
                style={{
                  fontSize: 12,
                  padding: '6px 12px',
                  minHeight: 'auto',
                  background: 'var(--accent)',
                  color: 'white',
                  borderColor: 'var(--accent)',
                  fontWeight: 700,
                }}
                title="التبديل لواجهة اللجنة"
              >
                🔀 لجنة التنظيم
              </button>
            )}
            <button onClick={handleLogout} className="logout-btn">
              خروج
            </button>
          </div>
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

          {data.list_status === 'approved' && !isFreeParticipants && (
            <div className="alert alert-success mt-4">
              ✓ تمت المصادقة على لائحتك. التعديل لم يعد ممكناً.
            </div>
          )}
        </div>

        <CategoryCounters athletes={athletes} isFreeParticipants={isFreeParticipants} />

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

        <AthletesList
          athletes={athletes}
          canEdit={canEdit}
          onDelete={handleDeleteAthlete}
          onSetDossard={canEditDossard ? (a) => setDossardAthlete(a) : undefined}
        />

        {data.list_status === 'draft' && athletes.length > 0 && (
          <button className="btn btn-success btn-block mt-4" onClick={handleSubmitList}>
            إرسال اللائحة للمصادقة
          </button>
        )}

        {data.list_status === 'submitted' && (
          <div className="alert alert-info mt-4">
            ⏳ لائحتك قيد المراجعة من طرف اللجنة.
          </div>
        )}
      </div>

      {showAddForm && (
        <AddAthleteModal
          institutionId={institution.id}
          institutionLevel={data.predefined?.level || null}
          athletes={athletes}
          isFreeParticipants={isFreeParticipants}
          onClose={() => setShowAddForm(false)}
          onSuccess={() => { setShowAddForm(false); loadData(); }}
        />
      )}

      {dossardAthlete && (
        <DossardModal
          athlete={dossardAthlete}
          onClose={() => setDossardAthlete(null)}
          onSuccess={() => { setDossardAthlete(null); loadData(); }}
        />
      )}
    </>
  );
}

// ─── Dossard Modal ─────────────────────────────────────────────────────────────

function DossardModal({ athlete, onClose, onSuccess }) {
  const [dossardValue, setDossardValue] = useState(athlete.dossard_number || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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

    setSaving(false);
    onSuccess();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', zIndex: 100,
    }}>
      <div style={{
        background: 'white', width: '100%',
        borderRadius: '20px 20px 0 0', padding: 20,
      }}>
        <div className="flex justify-between items-center mb-4">
          <h2 style={{ fontSize: 18, fontWeight: 900 }}>
            رقم الصدرية — {athlete.first_name} {athlete.last_name}
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', fontSize: 24 }}>✕</button>
        </div>

        {error && <div className="alert alert-error mb-3">{error}</div>}

        <div className="flex gap-2">
          <input
            type="number"
            className="form-input"
            value={dossardValue}
            onChange={(e) => setDossardValue(e.target.value)}
            placeholder="مثال: 47"
            dir="ltr"
            style={{ flex: 1, minHeight: 44 }}
            min="1"
            autoFocus
          />
          <button
            className="btn btn-success"
            onClick={saveDossard}
            disabled={saving}
            style={{ minWidth: 80, minHeight: 44 }}
          >
            {saving ? '...' : 'حفظ'}
          </button>
        </div>

        <button className="btn btn-outline btn-block mt-3" onClick={onClose}>
          إلغاء
        </button>
      </div>
    </div>
  );
}

// ─── Add Athlete Modal ─────────────────────────────────────────────────────────

const LEVEL_TO_CYCLE = {
  'ابتدائي': 'primary',
  'إعدادي': 'middle',
  'تأهيلي': 'high',
};

function AddAthleteModal({ institutionId, institutionLevel, athletes, isFreeParticipants, onClose, onSuccess }) {
  const fixedCycle = institutionLevel ? LEVEL_TO_CYCLE[institutionLevel] : null;
  const isFixed = !!fixedCycle;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('1');
  const [birthDay, setBirthDay] = useState('1');
  const [showFullDate, setShowFullDate] = useState(false);
  const [massarCode, setMassarCode] = useState('');
  const [schoolCycle, setSchoolCycle] = useState(fixedCycle || 'primary');
  const [schoolLevel, setSchoolLevel] = useState(
    fixedCycle ? SCHOOL_CYCLES[fixedCycle].default : ''
  );

  function handleCycleChange(cycle) {
    setSchoolCycle(cycle);
    setSchoolLevel(SCHOOL_CYCLES[cycle].default);
  }

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function getCategoryKey(year) {
    const y = parseInt(year);
    if (y === 2015 || y === 2016) return 'katakit';
    if (y === 2013 || y === 2014) return 'baraem';
    if (y === 2011 || y === 2012) return 'sighar';
    if (y === 2009 || y === 2010) return 'fityan';
    return null;
  }

  function getCategoryDisplay(year, g) {
    const y = parseInt(year);
    const isMale = g === 'male';
    if (y === 2015 || y === 2016) return isMale ? 'كتاكيت ذكور' : 'كتاكيت إناث';
    if (y === 2013 || y === 2014) return isMale ? 'براعم' : 'برعمات';
    if (y === 2011 || y === 2012) return isMale ? 'صغار' : 'صغيرات';
    if (y === 2009 || y === 2010) return isMale ? 'فتيان' : 'فتيات';
    return null;
  }

  const categoryKey = birthYear ? getCategoryKey(birthYear) : null;
  const categoryDisplay = birthYear && gender ? getCategoryDisplay(birthYear, gender) : null;

  function countInCategory(catKey, gen) {
    return (athletes || []).filter(
      (a) => a.category === catKey && a.gender === gen
    ).length;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!categoryKey) {
      setError('سنة الميلاد خارج الفئات المسموحة');
      return;
    }

    if (!isFreeParticipants) {
      const currentCount = countInCategory(categoryKey, gender);
      if (currentCount >= MAX_PER_CATEGORY) {
        setError(`وصلت هذه الفئة للحد الأقصى (${MAX_PER_CATEGORY} رياضيين)`);
        return;
      }
    }

    if (massarCode && !validateMassarCode(massarCode)) {
      setError('رمز Massar غير صحيح — يجب أن يكون حرفاً يليه 9 أرقام (مثال: N123456789)');
      return;
    }

    setLoading(true);
    const birthDate = `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`;

    const { error: insertError } = await supabase.from('athletes').insert({
      institution_id: institutionId,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      gender,
      birth_date: birthDate,
      massar_code: massarCode.trim().toUpperCase() || null,
      school_level: schoolLevel || null,
    });

    if (insertError) {
      setError('خطأ: ' + insertError.message);
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
            <label className="form-label">سنة الميلاد</label>
            <select
              className="form-select"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              required
            >
              <option value="">اختر السنة</option>
              {[2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            {!showFullDate && (
              <button
                type="button"
                onClick={() => setShowFullDate(true)}
                style={{
                  background: 'transparent',
                  color: 'var(--accent)',
                  fontSize: 13,
                  marginTop: 8,
                  padding: '4px 0',
                  fontWeight: 700,
                }}
              >
                ← تعديل اليوم والشهر (افتراضي: 1 يناير)
              </button>
            )}

            {showFullDate && (
              <div style={{ marginTop: 12 }}>
                <label className="form-label" style={{ fontSize: 12 }}>اليوم والشهر</label>
                <div className="flex gap-2">
                  <select className="form-select" value={birthDay} onChange={(e) => setBirthDay(e.target.value)}>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <select className="form-select" value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {categoryDisplay && (
              <div className="alert alert-info mt-2" style={{ marginBottom: 0 }}>
                الفئة: <strong>{categoryDisplay}</strong>
                {!isFreeParticipants && categoryKey && gender && (
                  <span style={{ marginRight: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                    ({countInCategory(categoryKey, gender)}/{MAX_PER_CATEGORY} مسجل)
                  </span>
                )}
              </div>
            )}
          </div>

          {!isFixed && (
            <div className="form-group">
              <label className="form-label">السلك</label>
              <select
                className="form-select"
                value={schoolCycle}
                onChange={(e) => handleCycleChange(e.target.value)}
              >
                <option value="">— غير محدد —</option>
                {Object.entries(SCHOOL_CYCLES).map(([key, cycle]) => (
                  <option key={key} value={key}>{cycle.label}</option>
                ))}
              </select>
            </div>
          )}

          {schoolCycle && (
            <div className="form-group">
              <label className="form-label">
                المستوى الدراسي
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 6 }}>
                  (اختياري{isFixed && ` - ${SCHOOL_CYCLES[fixedCycle].label}`})
                </span>
              </label>
              <select
                className="form-select"
                value={schoolLevel}
                onChange={(e) => setSchoolLevel(e.target.value)}
              >
                <option value="">— اختر —</option>
                {SCHOOL_CYCLES[schoolCycle].levels.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
          )}

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

          {/* ← رسالة الخطأ نُقلت هنا، فوق زر الحفظ مباشرة */}
          {error && <div className="alert alert-error mt-4">{error}</div>}

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