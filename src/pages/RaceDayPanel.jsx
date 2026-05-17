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
      .from('settings').select('value').eq('key', 'current_race_day').single();
    setCurrentDay(data?.value || 'qualifying');
    setLoading(false);
  }

  async function changeDay(newDay) {
    if (!confirm(newDay === 'qualifying' ? 'تفعيل وضع التصفيات؟' : 'تفعيل وضع النهائيات؟')) return;
    await supabase.from('settings').update({ value: newDay, updated_at: new Date().toISOString() }).eq('key', 'current_race_day');
    setCurrentDay(newDay);
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>;
  if (selectedRace) {
    return <RaceCertification race={selectedRace} isAdmin={isAdmin} onBack={() => setSelectedRace(null)} />;
  }
  return <RaceSelector onSelect={setSelectedRace} currentDay={currentDay} isAdmin={isAdmin} onChangeDay={changeDay} />;
}

function RaceSelector({ onSelect, currentDay, isAdmin, onChangeDay }) {
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadRaces(); }, [currentDay]);

  async function loadRaces() {
    setLoading(true);
    const { data } = await supabase.from('races').select('*').eq('stage', currentDay);
    setRaces(data || []);
    setLoading(false);
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  const grouped = [];
  CATEGORY_ORDER.forEach(cat => {
    ['male', 'female'].forEach(gender => {
      const race = races.find(r => r.category === cat && r.gender === gender);
      if (race) grouped.push({ race, label: CATEGORY_LABELS[cat][gender] });
    });
  });

  const stageLabel = currentDay === 'qualifying' ? 'التصفيات' : 'النهائيات';

  return (
    <div>
      {isAdmin && (
        <div className="card mb-4" style={{ padding: 12, background: '#f8fafc' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-muted)' }}>وضع اليوم</div>
          <div className="flex gap-2">
            <button className={currentDay === 'qualifying' ? 'btn btn-accent' : 'btn btn-outline'}
              style={{ flex: 1, fontSize: 16, fontWeight: 900, minHeight: 56 }}
              onClick={() => onChangeDay('qualifying')}>التصفيات</button>
            <button className={currentDay === 'final' ? 'btn btn-accent' : 'btn btn-outline'}
              style={{ flex: 1, fontSize: 16, fontWeight: 900, minHeight: 56 }}
              onClick={() => onChangeDay('final')}>النهائيات</button>
          </div>
        </div>
      )}
      <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 12, textAlign: 'center' }}>🏁 سباقات {stageLabel}</h3>
      <div className="flex flex-col gap-2">
        {grouped.map(({ race, label }) => (
          <RaceCard key={race.id} race={race} label={label} onSelect={() => onSelect(race)} />
        ))}
      </div>
    </div>
  );
}

function RaceCard({ race, label, onSelect }) {
  const statusInfo = {
    pending:  { color: '#6b7280', bg: 'white',   label: 'في الانتظار', icon: '○' },
    running:  { color: '#dc2626', bg: '#fef2f2', label: 'قيد التشغيل', icon: '●' },
    finished: { color: '#d97706', bg: '#fef3c7', label: 'بانتظار الاعتماد', icon: '⚠' },
    approved: { color: '#15803d', bg: '#d1fae5', label: 'معتمد', icon: '✓' },
  };
  const info = statusInfo[race.status] || statusInfo.pending;
  return (
    <button onClick={onSelect} className="card"
      style={{
        padding: 18, background: info.bg, borderColor: info.color, borderWidth: 2,
        cursor: 'pointer', textAlign: 'right', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 70,
      }}>
      <div style={{ fontSize: 24, color: info.color, fontWeight: 900 }}>{info.icon}</div>
      <div style={{ flex: 1, textAlign: 'right', marginRight: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>{label}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>
          {race.distance_meters && `${race.distance_meters}م`}
          {race.distance_meters && race.scheduled_at && ' • '}
          {race.scheduled_at && new Date(race.scheduled_at).toLocaleTimeString('ar-MA', {
            hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca'
          })}
        </div>
        <div style={{ fontSize: 12, color: info.color, fontWeight: 700, marginTop: 4 }}>{info.label}</div>
      </div>
    </button>
  );
}

function RaceCertification({ race, isAdmin, onBack }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timingsRaw, setTimingsRaw] = useState([]);
  const [ordersRaw, setOrdersRaw] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [athletesByDossard, setAthletesByDossard] = useState({});
  const [timingColumn, setTimingColumn] = useState([]);
  const [dossardColumn, setDossardColumn] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [localStatus, setLocalStatus] = useState(race.status);
  const raceLabel = CATEGORY_LABELS[race.category][race.gender];
  const stageLabel = race.stage === 'qualifying' ? 'التصفيات' : 'النهائيات';
  const isApproved = localStatus === 'approved';
  const isPending = localStatus === 'pending';
  const isRunning = localStatus === 'running';
  const isFinished = localStatus === 'finished';

  useEffect(() => { loadAll(); }, [race.id]);

  async function loadAll() {
    setLoading(true); setError('');
    const { data: timingsData } = await supabase.from('race_timings').select('*').eq('race_id', race.id).order('position', { ascending: true });
    const { data: ordersData } = await supabase.from('race_finish_orders').select('*').eq('race_id', race.id).order('position', { ascending: true });
    const { data: attendanceData } = await supabase.from('attendance')
      .select('*, athlete:athletes(id, first_name, last_name, dossard_number, institution:institutions(id, name, is_free_participants))')
      .eq('race_id', race.id).not('start_line_at', 'is', null);

    // إذا السباق معتمد، نقرأ النتائج المُعتمدة لإعادة بناء الجدول
    let resultsData = null;
    if (localStatus === 'approved') {
      const { data } = await supabase.from('results')
        .select('*, athlete:athletes(id, first_name, last_name, dossard_number, category, gender, institution:institutions(id, name, is_free_participants))')
        .eq('race_id', race.id)
        .order('rank', { ascending: true, nullsFirst: false });
      resultsData = data;
    }

    // خريطة dossard → athlete (من الجداول الخام أو من results)
    let athletesMap = {};
    if (resultsData) {
      // أضف من results
      resultsData.forEach(r => {
        if (r.athlete?.dossard_number != null) {
          athletesMap[r.athlete.dossard_number] = r.athlete;
        }
      });
    }
    const dossards = (ordersData || []).map(o => o.dossard_number).filter(d => d != null);
    if (dossards.length > 0) {
      const { data: athletes } = await supabase.from('athletes')
        .select('id, first_name, last_name, dossard_number, category, gender, institution:institutions(id, name, is_free_participants)')
        .in('dossard_number', dossards);
      (athletes || []).forEach(a => { athletesMap[a.dossard_number] = a; });
    }

    setTimingsRaw(timingsData || []);
    setOrdersRaw(ordersData || []);
    setAttendance(attendanceData || []);
    setAthletesByDossard(athletesMap);

    // ─── بناء الأعمدة ───
    if (resultsData && resultsData.length > 0) {
      // السباق معتمد: نقرأ الأعمدة من results (تعكس التعديلات المعتمدة)
      // نُرتّب بحسب rank (DNF rank=NULL في الأسفل)
      const withRank = resultsData.filter(r => r.rank != null).sort((a, b) => a.rank - b.rank);
      // ملاحظة: الـ DNF (rank=NULL) لا تظهر في الجدول المرئي
      // لأنهم في قائمة "لم يكملوا" المنفصلة
      const tCol = withRank.map(r => r.finish_time_ms != null ? { ms: r.finish_time_ms, fromDb: true } : null);
      const dCol = withRank.map(r => r.athlete?.dossard_number != null
        ? { dossard: r.athlete.dossard_number, fromDb: true }
        : null);
      setTimingColumn(tCol);
      setDossardColumn(dCol);
    } else {
      // السباق غير معتمد بعد: نقرأ من الجداول الخام (للتعديل)
      setTimingColumn((timingsData || []).map(t => ({ ms: t.finish_time_ms, fromDb: true })));
      setDossardColumn((ordersData || []).map(o => ({ dossard: o.dossard_number, out_of_flow: o.out_of_flow_warning, fromDb: true })));
    }

    setLoading(false);
  }

  async function fetchAthleteByDossard(dossard) {
    if (athletesByDossard[dossard]) return athletesByDossard[dossard];
    const { data } = await supabase.from('athletes')
      .select('id, first_name, last_name, dossard_number, category, gender, institution:institutions(id, name, is_free_participants)')
      .eq('dossard_number', dossard).maybeSingle();
    if (data) setAthletesByDossard(prev => ({ ...prev, [dossard]: data }));
    return data;
  }

  function clearTiming(idx) { const c = [...timingColumn]; c[idx] = null; setTimingColumn(c); }
  function clearDossard(idx) { const c = [...dossardColumn]; c[idx] = null; setDossardColumn(c); }
  function pushTimingDown(idx) { const c = [...timingColumn]; c.splice(idx, 0, null); setTimingColumn(c); }
  function pushDossardDown(idx) { const c = [...dossardColumn]; c.splice(idx, 0, null); setDossardColumn(c); }
  function pullTimingUp(idx) { if (idx === 0) return; const c = [...timingColumn]; c.splice(idx, 1); setTimingColumn(c); }
  function pullDossardUp(idx) { if (idx === 0) return; const c = [...dossardColumn]; c.splice(idx, 1); setDossardColumn(c); }

  async function setDossard(idx, dossardNum) {
    const dossard = parseInt(dossardNum);
    if (isNaN(dossard) || dossard <= 0) return;
    await fetchAthleteByDossard(dossard);
    const c = [...dossardColumn];
    c[idx] = { dossard, fromDb: false };
    setDossardColumn(c);
  }

  function setTiming(idx, msString) {
    let ms = null;
    const trimmed = String(msString).trim();
    if (trimmed === '') { const c = [...timingColumn]; c[idx] = null; setTimingColumn(c); return; }
    const match = trimmed.match(/^(\d+):(\d{1,2})(?:\.(\d{1,2}))?$/);
    if (match) {
      const m = parseInt(match[1]); const s = parseInt(match[2]); const cs = parseInt(match[3] || '0');
      ms = (m * 60 + s) * 1000 + cs * 10;
    } else if (/^\d+$/.test(trimmed)) ms = parseInt(trimmed);
    if (ms === null || isNaN(ms)) return;
    const c = [...timingColumn];
    c[idx] = { ms, fromDb: false };
    setTimingColumn(c);
  }

  function appendEmptyRow() {
    setTimingColumn([...timingColumn, null]);
    setDossardColumn([...dossardColumn, null]);
  }

  function resetToDb() {
    if (!confirm('إعادة الكل لما هو محفوظ في قاعدة البيانات؟ ستضيع كل التعديلات.')) return;
    setTimingColumn(timingsRaw.map(t => ({ ms: t.finish_time_ms, fromDb: true })));
    setDossardColumn(ordersRaw.map(o => ({ dossard: o.dossard_number, out_of_flow: o.out_of_flow_warning, fromDb: true })));
  }

  function buildRows() {
    const len = Math.max(timingColumn.length, dossardColumn.length);
    const rows = [];
    for (let i = 0; i < len; i++) {
      const t = timingColumn[i] || null;
      const d = dossardColumn[i] || null;
      const athlete = d ? athletesByDossard[d.dossard] : null;
      rows.push({ position: i + 1, timing: t, dossard: d, athlete, warnings: collectWarnings(t, d, athlete) });
    }
    return rows;
  }

  function collectWarnings(t, d, athlete) {
    const w = [];
    if (!t && d) w.push('لا توقيت');
    if (t && !d) w.push('لا صدرية');
    if (d?.out_of_flow) w.push('تخطى التدفق');
    if (d && d.dossard && !athlete) w.push('صدرية غير معروفة');
    if (athlete && athlete.category !== race.category) w.push('فئة لا تطابق');
    if (athlete && athlete.gender !== race.gender) w.push('جنس لا يطابق');
    return w;
  }

  function getDnfList() {
    const arrivedDossards = new Set(dossardColumn.filter(Boolean).map(d => d.dossard).filter(Boolean));
    return attendance.filter(a => {
      const d = a.athlete?.dossard_number;
      return d && !arrivedDossards.has(d);
    });
  }

  async function handleApprove() {
    setError('');
    const rows = buildRows();
    const dnfList = getDnfList();
    const validRows = rows.filter(r => r.athlete);
    const incompleteCount = rows.length - validRows.length;

    if (incompleteCount > 0) {
      if (!confirm(`يوجد ${incompleteCount} صف ناقص (بدون رياضي معروف).\nسيتم تجاهلهم في النتائج النهائية.\nمتابعة الاعتماد؟`)) return;
    }
    if (!confirm(`اعتماد نتائج ${stageLabel} ${raceLabel}؟\n\n• ${validRows.length} رياضي بنتيجة\n• ${dnfList.length} رياضي لم يكمل\n\nهذا سيُحرك السباق إلى "معتمد".`)) return;

    setSaving(true);
    try {
      await supabase.from('results').delete().eq('race_id', race.id);
      const resultsToInsert = [];
      let rank = 1;
      for (const row of validRows) {
        resultsToInsert.push({
          athlete_id: row.athlete.id, race_id: race.id, rank,
          finish_time_ms: row.timing?.ms || null,
        });
        rank++;
      }
      for (const att of dnfList) {
        if (!att.athlete?.id) continue;
        resultsToInsert.push({ athlete_id: att.athlete.id, race_id: race.id, rank: null, finish_time_ms: null });
      }
      if (resultsToInsert.length > 0) {
        const { error: insertErr } = await supabase.from('results').insert(resultsToInsert);
        if (insertErr) throw insertErr;
      }
      const { error: updateErr } = await supabase.from('races').update({ status: 'approved', is_completed: true }).eq('id', race.id);
      if (updateErr) throw updateErr;
      setLocalStatus('approved');
      setSuccess('✅ تم الاعتماد بنجاح');
      setTimeout(() => onBack(), 1500);
    } catch (e) {
      setError('خطأ في الحفظ: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleReopen() {
    if (!confirm('إعادة فتح هذا السباق للتعديل؟\nسيتم تحميل النتائج المعتمدة كنقطة بداية للتعديل.')) return;
    setSaving(true);
    try {
      // 1. اقرأ النتائج المعتمدة (لاستخدامها كنقطة بداية للتعديل)
      const { data: resultsData } = await supabase.from('results')
        .select('*, athlete:athletes(id, first_name, last_name, dossard_number, category, gender, institution:institutions(id, name, is_free_participants))')
        .eq('race_id', race.id)
        .order('rank', { ascending: true, nullsFirst: false });

      // 2. حوّل النتائج لأعمدة قابلة للتعديل
      const withRank = (resultsData || []).filter(r => r.rank != null).sort((a, b) => a.rank - b.rank);
      const tCol = withRank.map(r => r.finish_time_ms != null ? { ms: r.finish_time_ms, fromDb: true } : null);
      const dCol = withRank.map(r => r.athlete?.dossard_number != null
        ? { dossard: r.athlete.dossard_number, fromDb: true }
        : null);

      // أضف خريطة الرياضيين من النتائج
      const athletesMap = { ...athletesByDossard };
      (resultsData || []).forEach(r => {
        if (r.athlete?.dossard_number != null) {
          athletesMap[r.athlete.dossard_number] = r.athlete;
        }
      });

      // 3. احذف من results وأعد السباق إلى finished
      await supabase.from('results').delete().eq('race_id', race.id);
      const { error: updateErr } = await supabase.from('races')
        .update({ status: 'finished', is_completed: false })
        .eq('id', race.id);
      if (updateErr) throw updateErr;

      // 4. حدّث الحالة المحلية مباشرة
      setTimingColumn(tCol);
      setDossardColumn(dCol);
      setAthletesByDossard(athletesMap);
      setLocalStatus('finished');
    } catch (e) {
      setError('خطأ: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  const rows = buildRows();
  const dnfList = getDnfList();
  const timingsCount = timingColumn.filter(Boolean).length;
  const ordersCount = dossardColumn.filter(Boolean).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="btn btn-outline" style={{ minHeight: 44 }}>→ الرجوع</button>
        <div style={{ textAlign: 'center', flex: 1, marginRight: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{raceLabel}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>
            {stageLabel} • {raceStatusLabel(localStatus)}
          </div>
        </div>
      </div>

      {error && <div className="card mb-3" style={{ padding: 12, background: '#fef2f2', borderColor: '#fca5a5' }}>
        <div style={{ color: '#991b1b', fontWeight: 700 }}>{error}</div>
      </div>}
      {success && <div className="card mb-3" style={{ padding: 12, background: '#d1fae5', borderColor: '#6ee7b7' }}>
        <div style={{ color: '#065f46', fontWeight: 700 }}>{success}</div>
      </div>}

      {isPending && (
        <div className="card text-center" style={{ padding: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>○</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>السباق لم يبدأ بعد</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>الميقاتي يحتاج بدء السباق من شاشته</div>
        </div>
      )}

      {isRunning && (
        <div className="card text-center" style={{ padding: 32, background: '#fef2f2', borderColor: '#fca5a5' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>●</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: '#991b1b' }}>السباق قيد التشغيل</div>
          <div style={{ fontSize: 13, color: '#7f1d1d' }}>
            ميقاتي: {timingsRaw.length} توقيت • خط الوصول: {ordersRaw.length} صدرية
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            انتظر إنهاء الميقاتي للسباق ثم عُد للاعتماد
          </div>
        </div>
      )}

      {(isFinished || isApproved) && (
        <>
          <div className="card mb-3" style={{ padding: 12 }}>
            <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: 'var(--text-muted)', fontWeight: 700 }}>ميقاتي</div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{timingsCount}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: 'var(--text-muted)', fontWeight: 700 }}>خط الوصول</div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>{ordersCount}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: 'var(--text-muted)', fontWeight: 700 }}>غير مكتملين</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: dnfList.length > 0 ? '#d97706' : 'inherit' }}>
                  {dnfList.length}
                </div>
              </div>
            </div>
          </div>

          {timingsCount !== ordersCount && !isApproved && (
            <div className="card mb-3" style={{ padding: 12, background: '#fef3c7', borderColor: '#fcd34d' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>
                ⚠ عدم تطابق: {timingsCount} توقيت مقابل {ordersCount} صدرية
              </div>
              <div style={{ fontSize: 12, color: '#78350f', marginTop: 4 }}>
                استخدم أزرار التعديل لمحاذاة الصفوف
              </div>
            </div>
          )}

          {rows.length === 0 ? (
            <div className="card text-center" style={{ padding: 32 }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>لا توجد بيانات للعرض</div>
            </div>
          ) : (
            <EditableTable
              rows={rows}
              isEditable={isAdmin && isFinished}
              actions={{
                clearTiming, clearDossard,
                pushTimingDown, pushDossardDown,
                pullTimingUp, pullDossardUp,
                setDossard, setTiming,
              }}
            />
          )}

          {isAdmin && isFinished && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={appendEmptyRow} className="btn btn-outline" style={{ flex: 1, minHeight: 44, fontWeight: 700 }}>
                + إضافة سطر فارغ
              </button>
              <button onClick={resetToDb} className="btn btn-outline" style={{ flex: 1, minHeight: 44, fontSize: 12 }}>
                ↺ استعادة من DB
              </button>
            </div>
          )}

          {dnfList.length > 0 && <DnfList list={dnfList} />}

          {isAdmin && isFinished && (
            <button onClick={handleApprove} disabled={saving} className="btn btn-accent"
              style={{ width: '100%', marginTop: 16, minHeight: 56, fontSize: 17, fontWeight: 900 }}>
              {saving ? '⏳ جارٍ الاعتماد...' : '✓ اعتماد النتائج'}
            </button>
          )}

          {isAdmin && isApproved && (
            <>
              <div className="card mb-3 mt-3" style={{ padding: 12, background: '#d1fae5' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#065f46' }}>
                  ✓ هذا السباق معتمد. النتائج محفوظة في الجدول الرسمي.
                </div>
              </div>
              <button onClick={handleReopen} disabled={saving} className="btn btn-outline"
                style={{ width: '100%', minHeight: 48, fontSize: 14, color: '#dc2626', borderColor: '#fca5a5' }}>
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

function EditableTable({ rows, isEditable, actions }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '40px 1fr 1.3fr',
        background: '#f8fafc', padding: '10px 8px', fontSize: 11, fontWeight: 700,
        color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', gap: 8,
      }}>
        <div>المركز</div>
        <div style={{ textAlign: 'center' }}>التوقيت</div>
        <div style={{ textAlign: 'center' }}>الصدرية / الرياضي</div>
      </div>
      {rows.map((row, idx) => (
        <EditableRow key={idx} row={row} idx={idx} isEditable={isEditable} actions={actions} />
      ))}
    </div>
  );
}

function EditableRow({ row, idx, isEditable, actions }) {
  const hasIssue = row.warnings.length > 0;
  const bg = hasIssue ? '#fef3c7' : (idx % 2 === 0 ? 'white' : '#fafafa');
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '40px 1fr 1.3fr',
      padding: '8px', background: bg, borderBottom: '1px solid #f1f5f9',
      alignItems: 'stretch', gap: 8,
    }}>
      <div style={{ fontSize: 16, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {row.position}
      </div>
      <TimingCell timing={row.timing} idx={idx} isEditable={isEditable} actions={actions} />
      <DossardCell row={row} idx={idx} isEditable={isEditable} actions={actions} />
    </div>
  );
}

function TimingCell({ timing, idx, isEditable, actions }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');

  function startEdit() {
    setVal(timing ? formatMs(timing.ms) : '');
    setEditing(true);
  }
  function commit() {
    if (val.trim()) actions.setTiming(idx, val);
    setEditing(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
      {editing ? (
        <input type="text" value={val} onChange={e => setVal(e.target.value)} onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          autoFocus placeholder="00:00.00"
          style={{
            fontFamily: 'monospace', fontSize: 14, textAlign: 'center',
            padding: 4, border: '2px solid var(--accent)', borderRadius: 4, direction: 'ltr',
          }} />
      ) : (
        <div style={{
          fontSize: 14, fontFamily: 'monospace', fontWeight: 700,
          direction: 'ltr', textAlign: 'center',
        }}>
          {timing ? formatMs(timing.ms) : <span style={{ color: '#cbd5e1' }}>—</span>}
        </div>
      )}

      {isEditable && !editing && (
        <div style={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          {timing ? (
            <>
              <MiniBtn onClick={startEdit} title="تعديل">✎</MiniBtn>
              <MiniBtn onClick={() => actions.clearTiming(idx)} title="حذف">✕</MiniBtn>
              <MiniBtn onClick={() => actions.pushTimingDown(idx)} title="إزاحة لأسفل">↓</MiniBtn>
              <MiniBtn onClick={() => actions.pullTimingUp(idx)} title="حذف هذه الفجوة" disabled={idx === 0}>↑</MiniBtn>
            </>
          ) : (
            <>
              <MiniBtn onClick={startEdit} title="إضافة توقيت">+ ت</MiniBtn>
              <MiniBtn onClick={() => actions.pullTimingUp(idx)} title="حذف الفجوة" disabled={idx === 0}>↑</MiniBtn>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DossardCell({ row, idx, isEditable, actions }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');

  function startEdit() {
    setVal(row.dossard?.dossard?.toString() || '');
    setEditing(true);
  }
  function commit() {
    if (val.trim()) actions.setDossard(idx, val);
    setEditing(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {editing ? (
        <input type="number" value={val} onChange={e => setVal(e.target.value)} onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          autoFocus placeholder="رقم الصدرية"
          style={{
            fontSize: 14, padding: 4, border: '2px solid var(--accent)', borderRadius: 4,
            direction: 'ltr', textAlign: 'center',
          }} />
      ) : row.athlete ? (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            <span style={{ color: 'var(--accent)', fontWeight: 900, marginLeft: 4 }}>
              #{row.athlete.dossard_number}
            </span>
            {row.athlete.first_name} {row.athlete.last_name}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {row.athlete.institution?.name || '—'}
          </div>
        </div>
      ) : row.dossard ? (
        <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>
          #{row.dossard.dossard} (غير معروف)
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#cbd5e1', fontStyle: 'italic', textAlign: 'center' }}>
          — بدون صدرية —
        </div>
      )}

      {row.warnings.length > 0 && (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {row.warnings.map((w, i) => (
            <span key={i} style={{
              fontSize: 9, background: '#fcd34d', color: '#78350f',
              padding: '1px 5px', borderRadius: 3, fontWeight: 700,
            }}>⚠ {w}</span>
          ))}
        </div>
      )}

      {isEditable && !editing && (
        <div style={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          {row.dossard ? (
            <>
              <MiniBtn onClick={startEdit} title="تعديل">✎</MiniBtn>
              <MiniBtn onClick={() => actions.clearDossard(idx)} title="حذف">✕</MiniBtn>
              <MiniBtn onClick={() => actions.pushDossardDown(idx)} title="إزاحة لأسفل">↓</MiniBtn>
              <MiniBtn onClick={() => actions.pullDossardUp(idx)} title="حذف الفجوة" disabled={idx === 0}>↑</MiniBtn>
            </>
          ) : (
            <>
              <MiniBtn onClick={startEdit} title="إضافة صدرية">+ ص</MiniBtn>
              <MiniBtn onClick={() => actions.pullDossardUp(idx)} title="حذف الفجوة" disabled={idx === 0}>↑</MiniBtn>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MiniBtn({ onClick, title, disabled, children }) {
  return (
    <button onClick={onClick} title={title} disabled={disabled}
      style={{
        fontSize: 11, padding: '3px 7px',
        background: disabled ? '#f1f5f9' : 'white',
        border: '1px solid #cbd5e1', borderRadius: 4,
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? '#cbd5e1' : '#475569',
        fontWeight: 700, minHeight: 26, fontFamily: 'inherit',
      }}>
      {children}
    </button>
  );
}

function DnfList({ list }) {
  return (
    <div className="card mt-3" style={{ padding: 0, background: '#fafafa' }}>
      <div style={{
        padding: '10px 12px', background: '#fef3c7', fontSize: 13, fontWeight: 700,
        color: '#92400e', borderBottom: '1px solid #fcd34d',
      }}>
        ⚠ لم يكملوا السباق ({list.length})
      </div>
      <div>
        {list.map((att) => (
          <div key={att.id} style={{
            padding: '8px 12px', fontSize: 13, borderBottom: '1px solid #f1f5f9',
            display: 'flex', justifyContent: 'space-between',
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