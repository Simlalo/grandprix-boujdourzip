import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

const CATEGORY_LABELS = {
  katakit: 'كتاكيت',
  baraem: 'براعم',
  sighar: 'صغار',
  fityan: 'فتيان',
};

const GENDER_LABELS = {
  male: 'ذكور',
  female: 'إناث',
};

export default function CallRoomPanel({ user, onLogout }) {
  const [mode, setMode] = useState('call_room'); // 'call_room' | 'start_line'
  const [races, setRaces] = useState([]);
  const [selectedRaceId, setSelectedRaceId] = useState('');
  const [dossard, setDossard] = useState('');
  const [pendingAthlete, setPendingAthlete] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [stats, setStats] = useState({ confirmed: 0, total: 0 });
  const [busy, setBusy] = useState(false);

  // Load races on mount
  useEffect(() => {
    loadRaces();
  }, []);

  // Reload stats when race or mode changes
  useEffect(() => {
    if (selectedRaceId) {
      loadStats();
    }
  }, [selectedRaceId, mode]);

  async function loadRaces() {
    const { data, error } = await supabase
      .from('races')
      .select('*')
      .order('scheduled_at');
    if (error) {
      setError('خطأ في جلب السباقات: ' + error.message);
      return;
    }
    setRaces(data || []);
  }

  async function loadStats() {
    if (!selectedRaceId) return;
    const race = races.find((r) => r.id === selectedRaceId);
    if (!race) return;

    // Total athletes eligible for this race
    const { count: totalCount } = await supabase
      .from('athletes')
      .select('*, institutions!inner(list_status)', { count: 'exact', head: true })
      .eq('category', race.category)
      .eq('gender', race.gender)
      .eq('institutions.list_status', 'approved');

    // Confirmed for current mode
    const column = mode === 'call_room' ? 'call_room_at' : 'start_line_at';
    const { count: confirmedCount } = await supabase
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('race_id', selectedRaceId)
      .not(column, 'is', null);

    setStats({
      confirmed: confirmedCount || 0,
      total: totalCount || 0,
    });
  }

  async function searchAthlete() {
    setError('');
    setSuccess('');
    setPendingAthlete(null);

    if (!selectedRaceId) {
      setError('اختر السباق أولاً');
      return;
    }
    if (!dossard.trim()) {
      setError('أدخل رقم الصدرية');
      return;
    }

    const race = races.find((r) => r.id === selectedRaceId);
    if (!race) {
      setError('السباق غير موجود');
      return;
    }

    setBusy(true);

    // Find athlete by dossard, matching the race's category and gender
    const { data: athletes, error: athErr } = await supabase
      .from('athletes')
      .select('*, institutions!inner(name, list_status)')
      .eq('dossard_number', parseInt(dossard, 10))
      .eq('category', race.category)
      .eq('gender', race.gender)
      .eq('institutions.list_status', 'approved');

    setBusy(false);

    if (athErr) {
      setError('خطأ في البحث: ' + athErr.message);
      return;
    }

    if (!athletes || athletes.length === 0) {
      setError(`لا يوجد رياضي بالصدرية ${dossard} في هذا السباق`);
      return;
    }

    if (athletes.length > 1) {
      setError(`صدرية مكررة! وُجد ${athletes.length} رياضيين بنفس الرقم — راجع الإدارة`);
      return;
    }

    const athlete = athletes[0];

    // Check existing attendance status
    const { data: existing } = await supabase
      .from('attendance')
      .select('*')
      .eq('athlete_id', athlete.id)
      .eq('race_id', selectedRaceId)
      .maybeSingle();

    // Mode-specific logic
    if (mode === 'call_room') {
      if (existing && existing.call_room_at) {
        setError(`الرياضي ${athlete.first_name} ${athlete.last_name} مسجَّل في غرفة النداء مسبقاً`);
        return;
      }
    } else {
      // start_line mode
      if (!existing || !existing.call_room_at) {
        setError(
          `⚠️ الرياضي ${athlete.first_name} ${athlete.last_name} لم يمر بغرفة النداء بعد. وجّهه إلى غرفة النداء أولاً.`
        );
        return;
      }
      if (existing.start_line_at) {
        setError(`الرياضي ${athlete.first_name} ${athlete.last_name} مسجَّل في خط الانطلاق مسبقاً`);
        return;
      }
    }

    setPendingAthlete({ athlete, existing });
  }

  async function confirmAttendance() {
    if (!pendingAthlete) return;
    setBusy(true);
    setError('');

    const { athlete, existing } = pendingAthlete;
    const now = new Date().toISOString();

    let result;
    if (mode === 'call_room') {
      // INSERT new row
      result = await supabase.from('attendance').insert({
        athlete_id: athlete.id,
        race_id: selectedRaceId,
        call_room_at: now,
        call_room_by: user.id,
      });
    } else {
      // UPDATE existing row
      result = await supabase
        .from('attendance')
        .update({
          start_line_at: now,
          start_line_by: user.id,
        })
        .eq('id', existing.id);
    }

    setBusy(false);

    if (result.error) {
      setError('خطأ في الحفظ: ' + result.error.message);
      return;
    }

    const modeLabel = mode === 'call_room' ? 'غرفة النداء' : 'خط الانطلاق';
    setSuccess(`✅ تم تسجيل ${athlete.first_name} ${athlete.last_name} في ${modeLabel}`);
    setPendingAthlete(null);
    setDossard('');
    loadStats();

    // Auto-clear success after 3 seconds
    setTimeout(() => setSuccess(''), 3000);
  }

  function cancelPending() {
    setPendingAthlete(null);
    setDossard('');
    setError('');
  }

  const selectedRace = races.find((r) => r.id === selectedRaceId);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 40 }}>
      {/* Header */}
      <header
        style={{
          background: 'var(--bg-card-dark, #0f1419)',
          color: 'white',
          padding: '16px 20px',
          borderBottom: '3px solid var(--accent)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 18, color: 'white' }}>غرفة النداء</h1>
          <div style={{ fontSize: 13, color: 'var(--accent)', marginTop: 4 }}>
            تأكيد حضور الرياضيين
          </div>
        </div>
        <button onClick={onLogout} className="logout-btn">
          خروج
        </button>
      </header>

      {/* Mode Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          background: 'white',
          borderBottom: '2px solid #eee',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <button
          onClick={() => {
            setMode('call_room');
            cancelPending();
          }}
          style={{
            flex: 1,
            padding: '16px 12px',
            border: 'none',
            background: mode === 'call_room' ? 'var(--accent)' : 'white',
            color: mode === 'call_room' ? 'white' : '#555',
            fontWeight: 700,
            fontSize: 15,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.2s',
          }}
        >
          🚪 غرفة النداء
        </button>
        <button
          onClick={() => {
            setMode('start_line');
            cancelPending();
          }}
          style={{
            flex: 1,
            padding: '16px 12px',
            border: 'none',
            background: mode === 'start_line' ? 'var(--accent)' : 'white',
            color: mode === 'start_line' ? 'white' : '#555',
            fontWeight: 700,
            fontSize: 15,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.2s',
          }}
        >
          🏁 خط الانطلاق
        </button>
      </div>

      {/* Main Content */}
      <div style={{ padding: 20, maxWidth: 600, margin: '0 auto' }}>
        {/* Race Selector */}
        <div style={{ marginBottom: 20 }}>
          <label
            style={{
              display: 'block',
              fontWeight: 700,
              marginBottom: 8,
              fontSize: 15,
            }}
          >
            اختر السباق
          </label>
          <select
            value={selectedRaceId}
            onChange={(e) => {
              setSelectedRaceId(e.target.value);
              cancelPending();
            }}
            style={{
              width: '100%',
              padding: 14,
              fontSize: 16,
              borderRadius: 'var(--radius)',
              border: '2px solid #ddd',
              fontFamily: 'inherit',
              background: 'white',
            }}
          >
            <option value="">-- اختر سباقاً --</option>
            {races.map((r) => {
              const stageLabel = r.stage === 'qualifying' ? 'تصفيات' : 'نهائي';
              const date = new Date(r.scheduled_at);
              const time = date.toLocaleTimeString('ar-MA', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Africa/Casablanca',
              });
              return (
                <option key={r.id} value={r.id}>
                  {stageLabel} — {CATEGORY_LABELS[r.category]} {GENDER_LABELS[r.gender]} ({time})
                </option>
              );
            })}
          </select>
        </div>

        {/* Stats Banner */}
        {selectedRace && (
          <div
            style={{
              background: 'white',
              padding: 16,
              borderRadius: 'var(--radius)',
              marginBottom: 20,
              border: '2px solid var(--accent)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
              {mode === 'call_room' ? 'حضور غرفة النداء' : 'حضور خط الانطلاق'}
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>
              {stats.confirmed} / {stats.total}
            </div>
          </div>
        )}

        {/* Dossard Input */}
        {selectedRaceId && !pendingAthlete && (
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'block',
                fontWeight: 700,
                marginBottom: 8,
                fontSize: 15,
              }}
            >
              رقم الصدرية
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={dossard}
              onChange={(e) => setDossard(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') searchAthlete();
              }}
              autoFocus
              style={{
                width: '100%',
                padding: 16,
                fontSize: 24,
                fontWeight: 700,
                textAlign: 'center',
                borderRadius: 'var(--radius)',
                border: '2px solid #ddd',
                fontFamily: 'inherit',
              }}
              placeholder="أدخل رقم الصدرية"
            />
            <button
              onClick={searchAthlete}
              disabled={busy}
              className="btn btn-primary"
              style={{
                width: '100%',
                marginTop: 12,
                padding: 16,
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              {busy ? 'جاري البحث...' : '🔍 بحث'}
            </button>
          </div>
        )}

        {/* Pending Athlete Confirmation */}
        {pendingAthlete && (
          <div
            style={{
              background: 'white',
              padding: 24,
              borderRadius: 'var(--radius)',
              border: '3px solid var(--accent)',
              marginBottom: 20,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
              صدرية رقم
            </div>
            <div
              style={{
                fontSize: 48,
                fontWeight: 800,
                color: 'var(--accent)',
                marginBottom: 16,
              }}
            >
              {pendingAthlete.athlete.dossard_number}
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                marginBottom: 8,
                color: '#222',
              }}
            >
              {pendingAthlete.athlete.first_name} {pendingAthlete.athlete.last_name}
            </div>
            <div style={{ fontSize: 15, color: '#666', marginBottom: 20 }}>
              {pendingAthlete.athlete.institutions?.name || '—'}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={cancelPending}
                disabled={busy}
                className="btn btn-outline"
                style={{ flex: 1, padding: 14 }}
              >
                ✗ خطأ
              </button>
              <button
                onClick={confirmAttendance}
                disabled={busy}
                className="btn btn-primary"
                style={{ flex: 2, padding: 14, fontWeight: 800 }}
              >
                {busy ? 'جاري الحفظ...' : '✓ تأكيد الحضور'}
              </button>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div
            style={{
              background: '#fff3f3',
              border: '2px solid #f44',
              color: '#c00',
              padding: 14,
              borderRadius: 'var(--radius)',
              marginBottom: 16,
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {/* Success message */}
        {success && (
          <div
            style={{
              background: '#f0fff4',
              border: '2px solid #4c4',
              color: '#070',
              padding: 14,
              borderRadius: 'var(--radius)',
              marginBottom: 16,
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            {success}
          </div>
        )}
      </div>
    </div>
  );
}
