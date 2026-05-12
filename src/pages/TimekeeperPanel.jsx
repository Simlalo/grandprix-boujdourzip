// src/pages/TimekeeperPanel.jsx
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import {
  enqueue,
  getAllForRace,
  getPending,
  markSynced,
  deleteRecord,
  generateClientId,
} from '../lib/offlineQueue';

const CATEGORY_LABELS = {
  katakit: { male: 'كتاكيت ذكور', female: 'كتاكيت إناث' },
  baraem: { male: 'براعم', female: 'برعمات' },
  sighar: { male: 'صغار', female: 'صغيرات' },
  fityan: { male: 'فتيان', female: 'فتيات' },
};

const STORE = 'timings';

function formatTime(ms) {
  if (ms == null || ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = Math.floor((ms % 1000) / 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(2, '0')}`;
}

export default function TimekeeperPanel({ user, committeeMember, onLogout }) {
  const [localStandby, setLocalStandby] = useState(false);
  const [currentRace, setCurrentRace] = useState(null);
  const [timings, setTimings] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [lastFlash, setLastFlash] = useState(null);
  const [buttonFlash, setButtonFlash] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const currentRaceRef = useRef(null);
  const tickIntervalRef = useRef(null);

  // الطور مشتق من status في DB
  const phase = !currentRace
    ? 'no_race'
    : currentRace.status === 'running'
    ? 'running'
    : currentRace.status === 'finished' || currentRace.status === 'approved'
    ? 'finished'
    : localStandby
    ? 'standby'
    : 'ready';

  async function loadTimingsForRace(raceId) {
    const local = await getAllForRace(STORE, raceId);

    if (navigator.onLine) {
      const { data: cloud } = await supabase
        .from('race_timings')
        .select('*')
        .eq('race_id', raceId)
        .order('position');

      if (cloud) {
        const cloudIds = new Set(cloud.map((c) => c.client_id));
        const pendingLocal = local
          .filter((l) => !cloudIds.has(l.client_id))
          .sort((a, b) => (a.recorded_at < b.recorded_at ? -1 : 1));

        const merged = [
          ...cloud.map((c) => ({ ...c, synced: 1 })),
          ...pendingLocal,
        ];
        setTimings(merged);
        return;
      }
    }
    setTimings(local.sort((a, b) => (a.recorded_at < b.recorded_at ? -1 : 1)));
  }

  // اكتشاف "السباق الحالي" = السباق النشط (running)، أو الأقدم في pending به نشاط
  async function detectCurrentRace() {
    // أولاً: ابحث عن سباق running
    const { data: running } = await supabase
      .from('races')
      .select('*')
      .eq('status', 'running')
      .limit(1);

    if (running && running.length > 0) {
      const race = running[0];
      const wasNewRace =
        !currentRaceRef.current || currentRaceRef.current.id !== race.id;
      setCurrentRace(race);
      currentRaceRef.current = race;
      if (wasNewRace) {
        await loadTimingsForRace(race.id);
        setLocalStandby(false);
      } else {
        // نفس السباق — حدّث القيم في case status تغيّر
        setCurrentRace(race);
      }
      setLoading(false);
      return;
    }

    // ثانياً: ابحث عن سباق pending به نشاط في start_line
    const { data: pending } = await supabase
      .from('attendance')
      .select('race_id, start_line_at, races!inner(*)')
      .not('start_line_at', 'is', null)
      .eq('races.status', 'pending')
      .order('start_line_at', { ascending: false })
      .limit(1);

    if (pending && pending.length > 0) {
      const race = pending[0].races;
      const wasNewRace =
        !currentRaceRef.current || currentRaceRef.current.id !== race.id;
      setCurrentRace(race);
      currentRaceRef.current = race;
      if (wasNewRace) {
        await loadTimingsForRace(race.id);
        setLocalStandby(false);
      }
      setLoading(false);
      return;
    }

    // لا سباق
    if (currentRaceRef.current !== null) {
      setCurrentRace(null);
      currentRaceRef.current = null;
      setTimings([]);
      setLocalStandby(false);
    }
    setLoading(false);
  }

  async function syncPendingRecords() {
    if (!navigator.onLine) return;
    const pending = await getPending(STORE);
    if (pending.length === 0) return;

    pending.sort((a, b) => (a.recorded_at < b.recorded_at ? -1 : 1));

    for (const record of pending) {
      const { data, error: rpcErr } = await supabase.rpc('record_arrival', {
        p_race_id: record.race_id,
        p_finish_time_ms: record.finish_time_ms,
        p_client_id: record.client_id,
        p_recorded_by: record.recorded_by,
      });

      if (!rpcErr && data && data[0]) {
        await markSynced(STORE, record.client_id);
      }
    }
    if (currentRaceRef.current) await loadTimingsForRace(currentRaceRef.current.id);
  }

  useEffect(() => {
    detectCurrentRace();

    const channel = supabase
      .channel('timekeeper_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        () => detectCurrentRace()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'races' },
        () => detectCurrentRace()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'race_timings' },
        () => {
          if (currentRaceRef.current) loadTimingsForRace(currentRaceRef.current.id);
        }
      )
      .subscribe();

    const handleOnline = () => {
      setOnline(true);
      syncPendingRecords();
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const syncInterval = setInterval(syncPendingRecords, 10000);
    // polling احتياطي كل 30 ثانية لو realtime فشل
    const pollInterval = setInterval(detectCurrentRace, 30000);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(syncInterval);
      clearInterval(pollInterval);
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPendingCount(timings.filter((t) => !t.synced).length);
  }, [timings]);

  useEffect(() => {
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }

    if (phase === 'running' && currentRace?.started_at) {
      const startMs = new Date(currentRace.started_at).getTime();
      const update = () => setElapsed(Date.now() - startMs);
      update();
      tickIntervalRef.current = setInterval(update, 50);
    } else {
      setElapsed(0);
    }

    return () => {
      if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    };
  }, [phase, currentRace?.started_at]);

  async function startRace() {
    if (!currentRace) return;
    setErrorMsg('');

    const { data, error: err } = await supabase.rpc('start_race', {
      p_race_id: currentRace.id,
    });

    if (err) {
      setErrorMsg('خطأ في بدء السباق: ' + err.message);
      setTimeout(() => setErrorMsg(''), 4000);
      return;
    }

    if (data && data[0]) {
      // إن كان السباق يعمل بالفعل (idempotent)، نقبل القيم المُرجَعة
      setCurrentRace((prev) =>
        prev ? { ...prev, status: data[0].status, started_at: data[0].started_at } : prev
      );
    }

    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    setLocalStandby(false);
    await detectCurrentRace();
  }

  async function handleArrival() {
    if (phase !== 'running' || !currentRace?.started_at) return;

    const startMs = new Date(currentRace.started_at).getTime();
    const finishTimeMs = Date.now() - startMs;
    const clientId = generateClientId();
    const recordedBy = committeeMember?.id || null;

    if (navigator.vibrate) navigator.vibrate(50);
    setButtonFlash(true);
    setTimeout(() => setButtonFlash(false), 150);

    const localRecord = {
      client_id: clientId,
      race_id: currentRace.id,
      position: null,
      finish_time_ms: finishTimeMs,
      recorded_by: recordedBy,
      recorded_at: new Date().toISOString(),
      synced: 0,
    };

    // 1) احفظ محلياً فوراً (حماية ضد الانقطاع)
    await enqueue(STORE, localRecord);
    setTimings((prev) => [...prev, localRecord]);

    // 2) اطلب من DB تعيين المرتبة
    if (navigator.onLine) {
      const { data, error: rpcErr } = await supabase.rpc('record_arrival', {
        p_race_id: currentRace.id,
        p_finish_time_ms: finishTimeMs,
        p_client_id: clientId,
        p_recorded_by: recordedBy,
      });

      if (!rpcErr && data && data[0]) {
        const assignedPos = data[0].assigned_position;

        setLastFlash({
          position: assignedPos,
          time: finishTimeMs,
          id: clientId,
        });
        setTimeout(() => {
          setLastFlash((prev) => (prev && prev.id === clientId ? null : prev));
        }, 1500);

        await markSynced(STORE, clientId);
        setTimings((prev) =>
          prev.map((t) =>
            t.client_id === clientId
              ? { ...t, position: assignedPos, synced: 1 }
              : t
          )
        );
      } else {
        // فشل — احتفظ محلياً، سيُعاد المحاولة
        setLastFlash({
          position: '?',
          time: finishTimeMs,
          id: clientId,
          pending: true,
        });
        setTimeout(() => {
          setLastFlash((prev) => (prev && prev.id === clientId ? null : prev));
        }, 1500);
      }
    } else {
      setLastFlash({
        position: '?',
        time: finishTimeMs,
        id: clientId,
        pending: true,
      });
      setTimeout(() => {
        setLastFlash((prev) => (prev && prev.id === clientId ? null : prev));
      }, 1500);
    }
  }

  async function handleUndoLast() {
    if (timings.length === 0) return;
    if (!confirm('حذف آخر توقيت؟')) return;

    const last = timings[timings.length - 1];
    if (last.synced) {
      await supabase.from('race_timings').delete().eq('client_id', last.client_id);
    }
    await deleteRecord(STORE, last.client_id);
    setTimings(timings.slice(0, -1));
  }

  async function handleReset() {
    setShowResetConfirm(false);
    if (!currentRace) return;

    // RPC ذرية: تمسح كل شيء + تعيد status
    const { error: rpcErr } = await supabase.rpc('reset_race', {
      p_race_id: currentRace.id,
    });

    if (rpcErr) {
      setErrorMsg('خطأ في إعادة الضبط: ' + rpcErr.message);
      setTimeout(() => setErrorMsg(''), 4000);
      return;
    }

    // امسح IndexedDB أيضاً
    try {
      const { clearRace } = await import('../lib/offlineQueue');
      await clearRace(STORE, currentRace.id);
    } catch (e) {
      console.error(e);
    }

    setTimings([]);
    setLocalStandby(false);
    setLastFlash(null);
    await detectCurrentRace();
  }

  async function handleFinishRace() {
    setShowFinishConfirm(false);
    if (!currentRace) return;

    await syncPendingRecords();

    const { error: rpcErr } = await supabase.rpc('finish_race', {
      p_race_id: currentRace.id,
    });

    if (rpcErr) {
      setErrorMsg('خطأ في إنهاء السباق: ' + rpcErr.message);
      setTimeout(() => setErrorMsg(''), 4000);
      return;
    }

    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    await detectCurrentRace();
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  const raceLabel = currentRace
    ? CATEGORY_LABELS[currentRace.category][currentRace.gender]
    : '';
  const stageLabel = currentRace?.stage === 'qualifying' ? 'التصفيات' : 'النهائيات';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: 40 }}>
      <div
        style={{
          background: online ? '#16a34a' : '#dc2626',
          color: 'white',
          padding: '6px 16px',
          fontSize: 12,
          fontWeight: 700,
          textAlign: 'center',
          letterSpacing: 0.3,
        }}
      >
        {online
          ? pendingCount > 0
            ? `⏳ ${pendingCount} في الانتظار للمزامنة`
            : '✓ متصل ومتزامن'
          : `⚠ غير متصل — ${pendingCount} محفوظ محلياً`}
      </div>

      <header
        style={{
          background: '#0f1419',
          color: 'white',
          padding: '14px 20px',
          borderBottom: '3px solid var(--accent)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 18 }}>⏱ الميقاتي</h1>
          <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 2 }}>
            {committeeMember?.full_name || user?.email}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {phase === 'running' && (
            <>
              <button
                onClick={() => setShowResetConfirm(true)}
                style={{
                  background: 'transparent',
                  color: '#fbbf24',
                  border: '1px solid #fbbf24',
                  borderRadius: 8,
                  padding: '6px 10px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
                title="إعادة ضبط"
              >
                ⟳ ضبط
              </button>
              <button
                onClick={() => setShowFinishConfirm(true)}
                style={{
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 14px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                🏁 إنهاء
              </button>
            </>
          )}
          <button onClick={onLogout} className="logout-btn">خروج</button>
        </div>
      </header>

      <div style={{ padding: 16, maxWidth: 600, margin: '0 auto' }}>
        {phase === 'no_race' && (
          <div
            style={{
              background: 'white',
              padding: 32,
              borderRadius: 'var(--radius)',
              textAlign: 'center',
              marginTop: 24,
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏸</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              في انتظار بدء سباق
            </div>
            <div style={{ fontSize: 13, color: '#666' }}>
              ستظهر هذه الصفحة تلقائياً بمجرد عبور أول رياضي خط الانطلاق
            </div>
          </div>
        )}

        {phase === 'finished' && currentRace && (
          <div
            style={{
              background: 'white',
              padding: 32,
              borderRadius: 'var(--radius)',
              textAlign: 'center',
              marginTop: 24,
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏁</div>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              السباق منتهٍ
            </div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
              {CATEGORY_LABELS[currentRace.category][currentRace.gender]} — {stageLabel}
            </div>
            <div style={{ fontSize: 13, color: '#92400e' }}>
              في انتظار اعتماد اللجنة
            </div>
          </div>
        )}

        {currentRace && phase !== 'finished' && (
          <>
            <div
              style={{
                background: 'var(--primary)',
                color: 'white',
                padding: 16,
                borderRadius: 'var(--radius)',
                textAlign: 'center',
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 900 }}>{raceLabel}</div>
              <div style={{ fontSize: 14, opacity: 0.9, marginTop: 4 }}>{stageLabel}</div>
            </div>

            {phase === 'ready' && (
              <div
                style={{
                  background: 'white',
                  padding: 24,
                  borderRadius: 'var(--radius)',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>
                  اضغط عند اقتراب موعد الانطلاق
                </div>
                <button
                  onClick={() => setLocalStandby(true)}
                  style={{
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius)',
                    padding: '20px 40px',
                    fontSize: 22,
                    fontWeight: 900,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    width: '100%',
                    minHeight: 80,
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                  }}
                >
                  ⏳ تأهب
                </button>
              </div>
            )}

            {phase === 'standby' && (
              <div
                style={{
                  background: 'white',
                  padding: 24,
                  borderRadius: 'var(--radius)',
                  textAlign: 'center',
                  border: '3px solid #f59e0b',
                }}
              >
                <div style={{ fontSize: 16, color: '#92400e', marginBottom: 6, fontWeight: 700 }}>
                  جاهز للبدء
                </div>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
                  اضغط بمجرد سماع الطلقة
                </div>

                <button
                  onClick={startRace}
                  style={{
                    background: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius)',
                    padding: '32px 40px',
                    fontSize: 28,
                    fontWeight: 900,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    width: '100%',
                    minHeight: 120,
                    boxShadow: '0 6px 20px rgba(220, 38, 38, 0.4)',
                  }}
                >
                  🚦 بدء السباق
                </button>

                {errorMsg && (
                  <div
                    style={{
                      background: '#fff3f3',
                      border: '2px solid #f44',
                      color: '#c00',
                      padding: 10,
                      borderRadius: 8,
                      marginTop: 12,
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {errorMsg}
                  </div>
                )}

                <button
                  onClick={() => setLocalStandby(false)}
                  style={{
                    background: 'transparent',
                    color: '#666',
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    padding: '10px 16px',
                    fontSize: 13,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    marginTop: 16,
                  }}
                >
                  إلغاء
                </button>
              </div>
            )}

            {phase === 'running' && (
              <>
                <div
                  style={{
                    background: '#0f1419',
                    color: 'white',
                    padding: 24,
                    borderRadius: 'var(--radius)',
                    textAlign: 'center',
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: '#94a3b8',
                      marginBottom: 8,
                      fontWeight: 700,
                      letterSpacing: 1,
                    }}
                  >
                    التوقيت
                  </div>
                  <div
                    style={{
                      fontSize: 56,
                      fontWeight: 900,
                      direction: 'ltr',
                      fontFamily: 'monospace',
                      letterSpacing: 2,
                      color: 'var(--accent)',
                    }}
                  >
                    {formatTime(elapsed)}
                  </div>
                </div>

                {errorMsg && (
                  <div
                    style={{
                      background: '#fff3f3',
                      border: '2px solid #f44',
                      color: '#c00',
                      padding: 10,
                      borderRadius: 8,
                      marginBottom: 12,
                      fontSize: 13,
                      fontWeight: 600,
                      textAlign: 'center',
                    }}
                  >
                    {errorMsg}
                  </div>
                )}

                <button
                  onClick={handleArrival}
                  style={{
                    background: buttonFlash ? '#16a34a' : '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius)',
                    padding: '40px 20px',
                    fontSize: 36,
                    fontWeight: 900,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    width: '100%',
                    minHeight: 200,
                    boxShadow: buttonFlash
                      ? '0 8px 24px rgba(22, 163, 74, 0.6)'
                      : '0 8px 24px rgba(245, 158, 11, 0.4)',
                    transition: 'background 0.1s ease, box-shadow 0.1s ease, transform 0.1s ease',
                    transform: buttonFlash ? 'scale(0.98)' : 'scale(1)',
                  }}
                >
                  🏃 وصول
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      marginTop: 8,
                      opacity: 0.95,
                    }}
                  >
                    {timings.length} مسجل
                  </div>
                </button>

                {timings.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 8,
                      }}
                    >
                      <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>
                        التواقيت ({timings.length})
                      </h3>
                      <button
                        onClick={handleUndoLast}
                        style={{
                          background: 'transparent',
                          color: '#c00',
                          border: '1px solid #fcc',
                          borderRadius: 8,
                          padding: '6px 10px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        ↶ تراجع آخر
                      </button>
                    </div>
                    <div style={{ display: 'grid', gap: 6 }}>
                      {[...timings]
                        .reverse()
                        .slice(0, 10)
                        .map((t) => (
                          <div
                            key={t.client_id}
                            style={{
                              background: 'white',
                              padding: 10,
                              borderRadius: 'var(--radius)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              border: t.synced ? '1px solid #eee' : '1px dashed #f59e0b',
                            }}
                          >
                            <div
                              style={{
                                minWidth: 36,
                                height: 36,
                                background:
                                  t.position && t.position <= 3 ? '#fef3c7' : '#f8fafc',
                                color:
                                  t.position && t.position <= 3 ? '#d97706' : '#444',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 900,
                                fontSize: 14,
                              }}
                            >
                              {t.position || '?'}
                            </div>
                            <div
                              style={{
                                flex: 1,
                                fontSize: 16,
                                fontWeight: 700,
                                direction: 'ltr',
                                fontFamily: 'monospace',
                              }}
                            >
                              {formatTime(t.finish_time_ms)}
                            </div>
                            {!t.synced && (
                              <div
                                style={{
                                  fontSize: 11,
                                  color: '#f59e0b',
                                  fontWeight: 700,
                                }}
                                title="في الانتظار"
                              >
                                ⏳
                              </div>
                            )}
                          </div>
                        ))}
                      {timings.length > 10 && (
                        <div
                          style={{
                            textAlign: 'center',
                            fontSize: 12,
                            color: '#888',
                            padding: 8,
                          }}
                        >
                          + {timings.length - 10} توقيت سابق
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {lastFlash && (
        <div
          style={{
            position: 'fixed',
            top: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            background: lastFlash.pending ? '#f59e0b' : '#16a34a',
            color: 'white',
            padding: '14px 22px',
            borderRadius: 16,
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
            zIndex: 50,
            textAlign: 'center',
            minWidth: 200,
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: 13, opacity: 0.95, marginBottom: 2 }}>
            {lastFlash.pending ? 'في انتظار التزامن' : 'تم تسجيل المرتبة'}
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, lineHeight: 1.1 }}>
            {lastFlash.position}
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              direction: 'ltr',
              fontFamily: 'monospace',
              marginTop: 2,
              opacity: 0.95,
            }}
          >
            {formatTime(lastFlash.time)}
          </div>
        </div>
      )}

      {showFinishConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
        >
          <div
            style={{
              background: 'white',
              padding: 24,
              borderRadius: 'var(--radius)',
              maxWidth: 400,
              width: '100%',
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 900, marginTop: 0 }}>
              تأكيد إنهاء السباق
            </h2>
            <p style={{ fontSize: 14, color: '#555', marginBottom: 20 }}>
              تم تسجيل {timings.length} توقيت. هل أنت متأكد من إنهاء السباق؟ لن يمكن إضافة تواقيت بعد ذلك.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowFinishConfirm(false)}
                className="btn btn-outline"
                style={{ flex: 1 }}
              >
                تراجع
              </button>
              <button
                onClick={handleFinishRace}
                className="btn"
                style={{ flex: 2, background: '#dc2626', color: 'white' }}
              >
                ✓ نعم، إنهاء
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 16,
          }}
        >
          <div
            style={{
              background: 'white',
              padding: 24,
              borderRadius: 'var(--radius)',
              maxWidth: 400,
              width: '100%',
              border: '3px solid #fbbf24',
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 900, marginTop: 0, color: '#92400e' }}>
              ⚠ إعادة ضبط السباق
            </h2>
            <p style={{ fontSize: 14, color: '#555', marginBottom: 8 }}>سيتم محو:</p>
            <ul style={{ fontSize: 13, color: '#666', marginBottom: 20, paddingRight: 20 }}>
              <li>وقت بدء السباق</li>
              <li>{timings.length} توقيت مسجل</li>
              <li>صدريات خط الوصول (إن وُجدت)</li>
            </ul>
            <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 700, marginBottom: 20 }}>
              هذه العملية لا يمكن التراجع عنها.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="btn btn-outline"
                style={{ flex: 1 }}
              >
                تراجع
              </button>
              <button
                onClick={handleReset}
                className="btn"
                style={{ flex: 2, background: '#fbbf24', color: '#78350f' }}
              >
                ✓ نعم، إعادة الضبط
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}