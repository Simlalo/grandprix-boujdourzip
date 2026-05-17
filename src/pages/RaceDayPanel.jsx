import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const CATEGORY_LABELS = {
  katakit: { male: 'كتاكيت ذكور', female: 'كتاكيت إناث' },
  baraem: { male: 'براعم', female: 'برعمات' },
  sighar: { male: 'صغار', female: 'صغيرات' },
  fityan: { male: 'فتيان', female: 'فتيات' },
};

const CATEGORY_ORDER = ['katakit', 'baraem', 'sighar', 'fityan'];

export default function RaceDayPanel({ isAdmin }) {
  const [selectedRace, setSelectedRace] = useState(null);
  const [currentDay, setCurrentDay] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCurrentDay(); }, []);

  async function loadCurrentDay() {
    setLoading(true);
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'current_race_day')
      .single();
    setCurrentDay(data?.value || 'qualifying');
    setLoading(false);
  }

  async function changeDay(newDay) {
    if (!confirm(
      newDay === 'qualifying'
        ? 'تفعيل وضع التصفيات؟'
        : 'تفعيل وضع النهائيات؟'
    )) return;

    await supabase
      .from('settings')
      .update({ value: newDay, updated_at: new Date().toISOString() })
      .eq('key', 'current_race_day');
    setCurrentDay(newDay);
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  if (selectedRace) {
    return (
      <RaceCertification
        race={selectedRace}
        isAdmin={isAdmin}
        onBack={() => setSelectedRace(null)}
      />
    );
  }

  return (
    <RaceSelector
      onSelect={setSelectedRace}
      currentDay={currentDay}
      isAdmin={isAdmin}
      onChangeDay={changeDay}
    />
  );
}

// ═══════════════════════════════════════════════════════
// شاشة اختيار السباق (دون تغيير)
// ═══════════════════════════════════════════════════════

function RaceSelector({ onSelect, currentDay, isAdmin, onChangeDay }) {
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadRaces(); }, [currentDay]);

  async function loadRaces() {
    setLoading(true);
    const { data } = await supabase
      .from('races')
      .select('*')
      .eq('stage', currentDay);
    setRaces(data || []);
    setLoading(false);
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  const grouped = [];
  CATEGORY_ORDER.forEach(cat => {
    ['male', 'female'].forEach(gender => {
      const race = races.find(r => r.category === cat && r.gender === gender);
      if (race) {
        grouped.push({ race, label: CATEGORY_LABELS[cat][gender] });
      }
    });
  });

  const stageLabel = currentDay === 'qualifying' ? 'التصفيات' : 'النهائيات';

  return (
    <div>
      {isAdmin && (
        <div className="card mb-4" style={{ padding: 12, background: '#f8fafc' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-muted)' }}>
            وضع اليوم
          </div>
          <div className="flex gap-2">
            <button
              className={currentDay === 'qualifying' ? 'btn btn-accent' : 'btn btn-outline'}
              style={{ flex: 1, fontSize: 16, fontWeight: 900, minHeight: 56 }}
              onClick={() => onChangeDay('qualifying')}
            >
              التصفيات
            </button>
            <button
              className={currentDay === 'final' ? 'btn btn-accent' : 'btn btn-outline'}
              style={{ flex: 1, fontSize: 16, fontWeight: 900, minHeight: 56 }}
              onClick={() => onChangeDay('final')}
            >
              النهائيات
            </button>
          </div>
        </div>
      )}

      <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 12, textAlign: 'center' }}>
        🏁 سباقات {stageLabel}
      </h3>

      <div className="flex flex-col gap-2">
        {grouped.map(({ race, label }) => (
          <RaceCard key={race.id} race={race} label={label} onSelect={() => onSelect(race)} />
        ))}
      </div>
    </div>
  );
}

function RaceCard({ race, label, onSelect }) {
  // الحالة المرئية حسب status
  const statusInfo = {
    pending:   { color: '#6b7280', bg: 'white',     label: 'في الانتظار', icon: '○' },
    running:   { color: '#dc2626', bg: '#fef2f2',   label: 'قيد التشغيل', icon: '●' },
    finished:  { color: '#d97706', bg: '#fef3c7',   label: 'بانتظار الاعتماد', icon: '⚠' },
    approved:  { color: '#15803d', bg: '#d1fae5',   label: 'معتمد',        icon: '✓' },
  };
  const info = statusInfo[race.status] || statusInfo.pending;

  return (
    <button
      onClick={onSelect}
      className="card"
      style={{
        padding: 18,
        background: info.bg,
        borderColor: info.color,
        borderWidth: 2,
        cursor: 'pointer',
        textAlign: 'right',
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 70,
      }}
    >
      <div style={{ fontSize: 24, color: info.color, fontWeight: 900 }}>
        {info.icon}
      </div>
      <div style={{ flex: 1, textAlign: 'right', marginRight: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>{label}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>
          {race.distance_meters && `${race.distance_meters}م`}
          {race.distance_meters && race.scheduled_at && ' • '}
          {race.scheduled_at && new Date(race.scheduled_at).toLocaleTimeString('ar-MA', {
            hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca'
          })}
        </div>
        <div style={{ fontSize: 12, color: info.color, fontWeight: 700, marginTop: 4 }}>
          {info.label}
        </div>
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════
// شاشة الاعتماد الجديدة
// ═══════════════════════════════════════════════════════

function RaceCertification({ race, isAdmin, onBack }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timings, setTimings] = useState([]);          // race_timings (ميقاتي)
  const [finishOrders, setFinishOrders] = useState([]); // race_finish_orders (خط الوصول)
  const [attendance, setAttendance] = useState([]);     // attendance (DNF حساب)
  const [athletesById, setAthletesById] = useState({}); // map: dossard -> athlete
  const [existingResults, setExistingResults] = useState([]); // النتائج المعتمدة (لإعادة الفتح)
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const raceLabel = CATEGORY_LABELS[race.category][race.gender];
  const stageLabel = race.stage === 'qualifying' ? 'التصفيات' : 'النهائيات';
  const isApproved = race.status === 'approved';
  const isPending = race.status === 'pending';
  const isRunning = race.status === 'running';
  const isFinished = race.status === 'finished';

  useEffect(() => { loadAll(); }, [race.id]);

  async function loadAll() {
    setLoading(true);
    setError('');

    // 1. تواقيت الميقاتي
    const { data: timingsData } = await supabase
      .from('race_timings')
      .select('*')
      .eq('race_id', race.id)
      .order('position', { ascending: true });

    // 2. ترتيب خط الوصول
    const { data: ordersData } = await supabase
      .from('race_finish_orders')
      .select('*')
      .eq('race_id', race.id)
      .order('position', { ascending: true });

    // 3. الحضور (للـ DNF)
    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('*, athlete:athletes(id, first_name, last_name, dossard_number, institution:institutions(id, name, is_free_participants))')
      .eq('race_id', race.id)
      .not('start_line_at', 'is', null);

    // 4. خريطة dossard → athlete
    const dossards = (ordersData || []).map(o => o.dossard_number).filter(d => d != null);
    let athletesMap = {};
    if (dossards.length > 0) {
      const { data: athletes } = await supabase
        .from('athletes')
        .select('id, first_name, last_name, dossard_number, category, gender, institution:institutions(id, name, is_free_participants)')
        .in('dossard_number', dossards);
      (athletes || []).forEach(a => { athletesMap[a.dossard_number] = a; });
    }

    // 5. النتائج المعتمدة (لو موجودة)
    const { data: resultsData } = await supabase
      .from('results')
      .select('*, athlete:athletes(id, first_name, last_name, dossard_number, institution:institutions(id, name, is_free_participants))')
      .eq('race_id', race.id)
      .order('rank', { ascending: true, nullsLast: true });

    setTimings(timingsData || []);
    setFinishOrders(ordersData || []);
    setAttendance(attendanceData || []);
    setAthletesById(athletesMap);
    setExistingResults(resultsData || []);
    setLoading(false);
  }

  // بناء الجدول الموحد (ميقاتي ⨯ خط الوصول مع الربط)
  function buildLinkedTable() {
    const maxLen = Math.max(timings.length, finishOrders.length);
    const rows = [];
    for (let i = 0; i < maxLen; i++) {
      const t = timings[i] || null;
      const o = finishOrders[i] || null;
      const dossard = o?.dossard_number;
      const athlete = dossard ? athletesById[dossard] : null;
      rows.push({
        position: i + 1,
        timing: t,
        order: o,
        athlete,
        warnings: collectWarnings(t, o, athlete, i),
      });
    }
    return rows;
  }

  function collectWarnings(t, o, athlete, idx) {
    const w = [];
    if (!t && o) w.push('لا توقيت');
    if (t && !o) w.push('لا صدرية');
    if (o?.out_of_flow_warning) w.push('تخطى التدفق');
    if (o && o.dossard_number && !athlete) w.push('صدرية غير معروفة');
    if (athlete && athlete.category !== race.category) w.push('فئة لا تطابق');
    if (athlete && athlete.gender !== race.gender) w.push('جنس لا يطابق');
    return w;
  }

  // قائمة الـ DNF (في attendance لكن ليسوا في finish_orders)
  function getDnfList() {
    const arrivedDossards = new Set(
      finishOrders.map(o => o.dossard_number).filter(Boolean)
    );
    return attendance.filter(a => {
      const d = a.athlete?.dossard_number;
      return d && !arrivedDossards.has(d);
    });
  }

  // اعتماد النتائج
  async function handleApprove() {
    setError('');
    const rows = buildLinkedTable();
    const dnfList = getDnfList();

    // التحقق من السلامة الأساسية
    const incompleteRows = rows.filter(r => !r.athlete);
    if (incompleteRows.length > 0) {
      if (!confirm(
        `يوجد ${incompleteRows.length} صف ناقص (بدون رياضي معروف).\n` +
        `سيتم تجاهلهم.\nمتابعة الاعتماد؟`
      )) return;
    }

    if (!confirm(
      `اعتماد نتائج ${stageLabel} ${raceLabel}؟\n\n` +
      `• ${rows.filter(r => r.athlete).length} رياضي بنتيجة\n` +
      `• ${dnfList.length} رياضي لم يكمل\n\n` +
      `هذا سيُحرك السباق إلى "معتمد".`
    )) return;

    setSaving(true);

    try {
      // 1. مسح أي نتائج سابقة لنفس السباق (إعادة الاعتماد)
      await supabase.from('results').delete().eq('race_id', race.id);

      // 2. صفوف النتائج
      const resultsToInsert = [];
      let rank = 1;
      for (const row of rows) {
        if (!row.athlete) continue;
        // ملاحظة: points و qualified_to_final أعمدة مولّدة في DB
        // تُحسب تلقائياً من rank
        resultsToInsert.push({
          athlete_id: row.athlete.id,
          race_id: race.id,
          rank,
          finish_time_ms: row.timing?.finish_time_ms || null,
        });
        rank++;
      }

      // 3. صفوف DNF (rank = null)
      for (const att of dnfList) {
        if (!att.athlete?.id) continue;
        resultsToInsert.push({
          athlete_id: att.athlete.id,
          race_id: race.id,
          rank: null,
          finish_time_ms: null,
        });
      }

      if (resultsToInsert.length > 0) {
        const { error: insertErr } = await supabase
          .from('results')
          .insert(resultsToInsert);
        if (insertErr) throw insertErr;
      }

      // 4. تحديث حالة السباق
      const { error: updateErr } = await supabase
        .from('races')
        .update({ status: 'approved', is_completed: true })
        .eq('id', race.id);
      if (updateErr) throw updateErr;

      setSuccess('✅ تم الاعتماد بنجاح');
      setTimeout(() => onBack(), 1500);
    } catch (e) {
      setError('خطأ في الحفظ: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  // إعادة فتح للتعديل
  async function handleReopen() {
    if (!confirm(
      'إعادة فتح هذا السباق للتعديل؟\n' +
      'سيتم حذف النتائج المعتمدة الحالية.'
    )) return;
    setSaving(true);
    await supabase.from('results').delete().eq('race_id', race.id);
    await supabase
      .from('races')
      .update({ status: 'finished', is_completed: false })
      .eq('id', race.id);
    setSaving(false);
    await loadAll();
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  const linkedRows = buildLinkedTable();
  const dnfList = getDnfList();

  return (
    <div>
      {/* رأس الصفحة */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="btn btn-outline" style={{ minHeight: 44 }}>
          → الرجوع
        </button>
        <div style={{ textAlign: 'center', flex: 1, marginRight: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{raceLabel}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>
            {stageLabel} • {raceStatusLabel(race.status)}
          </div>
        </div>
      </div>

      {/* رسائل */}
      {error && (
        <div className="card mb-3" style={{ padding: 12, background: '#fef2f2', borderColor: '#fca5a5' }}>
          <div style={{ color: '#991b1b', fontWeight: 700 }}>{error}</div>
        </div>
      )}
      {success && (
        <div className="card mb-3" style={{ padding: 12, background: '#d1fae5', borderColor: '#6ee7b7' }}>
          <div style={{ color: '#065f46', fontWeight: 700 }}>{success}</div>
        </div>
      )}

      {/* حالة pending — لا شيء بعد */}
      {isPending && (
        <div className="card text-center" style={{ padding: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>○</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
            السباق لم يبدأ بعد
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            الميقاتي يحتاج بدء السباق من شاشته
          </div>
        </div>
      )}

      {/* حالة running — منتظرون النهاية */}
      {isRunning && (
        <div className="card text-center" style={{ padding: 32, background: '#fef2f2', borderColor: '#fca5a5' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>●</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: '#991b1b' }}>
            السباق قيد التشغيل
          </div>
          <div style={{ fontSize: 13, color: '#7f1d1d' }}>
            ميقاتي: {timings.length} توقيت • خط الوصول: {finishOrders.length} صدرية
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            انتظر إنهاء الميقاتي للسباق ثم عُد للاعتماد
          </div>
        </div>
      )}

      {/* حالة finished — جاهز للاعتماد */}
      {(isFinished || isApproved) && (
        <>
          {/* إحصائيات سريعة */}
          <div className="card mb-3" style={{ padding: 12 }}>
            <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: 'var(--text-muted)', fontWeight: 700 }}>ميقاتي</div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{timings.length}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: 'var(--text-muted)', fontWeight: 700 }}>خط الوصول</div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{finishOrders.length}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: 'var(--text-muted)', fontWeight: 700 }}>غير مكتملين</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: dnfList.length > 0 ? '#d97706' : 'inherit' }}>
                  {dnfList.length}
                </div>
              </div>
            </div>
          </div>

          {/* تحذير عدم التطابق */}
          {timings.length !== finishOrders.length && !isApproved && (
            <div className="card mb-3" style={{ padding: 12, background: '#fef3c7', borderColor: '#fcd34d' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>
                ⚠ عدم تطابق: {timings.length} توقيت مقابل {finishOrders.length} صدرية
              </div>
              <div style={{ fontSize: 12, color: '#78350f', marginTop: 4 }}>
                راجع الجدول بعناية قبل الاعتماد
              </div>
            </div>
          )}

          {/* جدول الربط */}
          {linkedRows.length === 0 ? (
            <div className="card text-center" style={{ padding: 32 }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                لا توجد بيانات للعرض
              </div>
            </div>
          ) : (
            <LinkedTable rows={linkedRows} />
          )}

          {/* قائمة الـ DNF */}
          {dnfList.length > 0 && (
            <DnfList list={dnfList} />
          )}

          {/* أزرار الإجراء */}
          {isAdmin && isFinished && (
            <button
              onClick={handleApprove}
              disabled={saving}
              className="btn btn-accent"
              style={{
                width: '100%',
                marginTop: 16,
                minHeight: 56,
                fontSize: 17,
                fontWeight: 900,
              }}
            >
              {saving ? '⏳ جارٍ الاعتماد...' : '✓ اعتماد النتائج'}
            </button>
          )}

          {isAdmin && isApproved && (
            <>
              <div className="card mb-3" style={{ padding: 12, background: '#d1fae5' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#065f46' }}>
                  ✓ هذا السباق معتمد. النتائج محفوظة في الجدول الرسمي.
                </div>
              </div>
              <button
                onClick={handleReopen}
                disabled={saving}
                className="btn btn-outline"
                style={{
                  width: '100%',
                  minHeight: 48,
                  fontSize: 14,
                  color: '#dc2626',
                  borderColor: '#fca5a5',
                }}
              >
                {saving ? '⏳ ...' : '↺ إعادة فتح للتعديل (تحذير: يمسح النتائج)'}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

function raceStatusLabel(status) {
  switch (status) {
    case 'pending':  return 'لم يبدأ بعد';
    case 'running':  return 'قيد التشغيل';
    case 'finished': return 'بانتظار الاعتماد';
    case 'approved': return 'معتمد';
    default: return status;
  }
}

function LinkedTable({ rows }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '50px 1fr 80px',
        background: '#f8fafc',
        padding: '10px 12px',
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--text-muted)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div>المركز</div>
        <div>الرياضي</div>
        <div style={{ textAlign: 'left', direction: 'ltr' }}>التوقيت</div>
      </div>

      {rows.map((row, idx) => (
        <LinkedRow key={idx} row={row} idx={idx} />
      ))}
    </div>
  );
}

function LinkedRow({ row, idx }) {
  const hasIssue = row.warnings.length > 0;
  const bg = hasIssue ? '#fef3c7' : (idx % 2 === 0 ? 'white' : '#fafafa');

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '50px 1fr 80px',
      padding: '10px 12px',
      background: bg,
      borderBottom: '1px solid #f1f5f9',
      alignItems: 'center',
    }}>
      <div style={{ fontSize: 18, fontWeight: 900 }}>{row.position}</div>

      <div>
        {row.athlete ? (
          <>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              <span style={{ color: 'var(--accent)', fontWeight: 900, marginLeft: 6 }}>
                #{row.athlete.dossard_number}
              </span>
              {row.athlete.first_name} {row.athlete.last_name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {row.athlete.institution?.name || '—'}
            </div>
          </>
        ) : row.order ? (
          <div style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>
            #{row.order.dossard_number} (غير معروف)
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            بدون صدرية
          </div>
        )}
        {row.warnings.length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
            {row.warnings.map((w, i) => (
              <span key={i} style={{
                fontSize: 10,
                background: '#fcd34d',
                color: '#78350f',
                padding: '2px 6px',
                borderRadius: 4,
                fontWeight: 700,
              }}>
                ⚠ {w}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{
        fontSize: 13,
        fontFamily: 'monospace',
        direction: 'ltr',
        textAlign: 'left',
        fontWeight: 700,
      }}>
        {row.timing ? formatMs(row.timing.finish_time_ms) : '—'}
      </div>
    </div>
  );
}

function DnfList({ list }) {
  return (
    <div className="card mt-3" style={{ padding: 0, background: '#fafafa' }}>
      <div style={{
        padding: '10px 12px',
        background: '#fef3c7',
        fontSize: 13,
        fontWeight: 700,
        color: '#92400e',
        borderBottom: '1px solid #fcd34d',
      }}>
        ⚠ لم يكملوا السباق ({list.length})
      </div>
      <div>
        {list.map((att) => (
          <div key={att.id} style={{
            padding: '8px 12px',
            fontSize: 13,
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
          }}>
            <div>
              <span style={{ color: 'var(--accent)', fontWeight: 900, marginLeft: 6 }}>
                #{att.athlete?.dossard_number}
              </span>
              {att.athlete?.first_name} {att.athlete?.last_name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {att.athlete?.institution?.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatMs(ms) {
  if (ms == null) return '—';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const cs = Math.floor((ms % 1000) / 10);
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}