// src/pages/FinishLinePanel.jsx
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

const STORE = 'finish_orders';

export default function FinishLinePanel({ user, committeeMember, onLogout }) {
  const [currentRace, setCurrentRace] = useState(null);
  const [orders, setOrders] = useState([]);
  const [dossardInput, setDossardInput] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const inputRef = useRef(null);
  const currentRaceRef = useRef(null);

  async function loadOrdersForRace(raceId) {
    const local = await getAllForRace(STORE, raceId);

    if (navigator.onLine) {
      const { data: cloud } = await supabase
        .from('race_finish_orders')
        .select('*')
        .eq('race_id', raceId)
        .order('position');

      if (cloud) {
        const cloudIds = new Set(cloud.map((c) => c.client_id));
        const merged = [
          ...cloud.map((c) => ({ ...c, synced: 1 })),
          ...local.filter((l) => !cloudIds.has(l.client_id)),
        ].sort((a, b) => a.position - b.position);
        setOrders(merged);
        return;
      }
    }
    setOrders(local.sort((a, b) => a.position - b.position));
  }

  async function detectCurrentRace() {
    const { data, error: err } = await supabase
      .from('attendance')
      .select('race_id, start_line_at, races!inner(id, category, gender, stage, is_completed)')
      .not('start_line_at', 'is', null)
      .eq('races.is_completed', false)
      .order('start_line_at', { ascending: false })
      .limit(1);

    if (err) {
      setError('خطأ في الاتصال: ' + err.message);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      if (currentRaceRef.current !== null) {
        setCurrentRace(null);
        currentRaceRef.current = null;
        setOrders([]);
      }
      setLoading(false);
      return;
    }

    const race = data[0].races;
    if (!currentRaceRef.current || currentRaceRef.current.id !== race.id) {
      setCurrentRace(race);
      currentRaceRef.current = race;
      await loadOrdersForRace(race.id);
    }
    setLoading(false);
  }

  async function syncPendingRecords() {
    if (!navigator.onLine) return;
    const pending = await getPending(STORE);
    if (pending.length === 0) return;

    for (const record of pending) {
      const { error: insertErr } = await supabase.from('race_finish_orders').insert({
        race_id: record.race_id,
        position: record.position,
        dossard_number: record.dossard_number,
        recorded_by: record.recorded_by,
        client_id: record.client_id,
        is_synced: true,
      });
      if (!insertErr) await markSynced(STORE, record.client_id);
    }
    if (currentRaceRef.current) await loadOrdersForRace(currentRaceRef.current.id);
  }

  useEffect(() => {
    detectCurrentRace();

    const channel = supabase
      .channel('finish_judge_realtime')
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
      .subscribe();

    const handleOnline = () => {
      setOnline(true);
      syncPendingRecords();
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const syncInterval = setInterval(syncPendingRecords, 10000);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(syncInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPendingCount(orders.filter((o) => !o.synced).length);
  }, [orders]);

  async function handleAddDossard() {
    setError('');
    setSuccess('');

    if (!currentRace) {
      setError('لا يوجد سباق نشط حالياً');
      return;
    }

    const dossard = parseInt(dossardInput, 10);
    if (!dossard || isNaN(dossard) || dossard < 1) {
      setError('أدخل رقم صدرية صحيح');
      return;
    }

    if (orders.some((o) => o.dossard_number === dossard)) {
      const existing = orders.find((o) => o.dossard_number === dossard);
      setError(`الصدرية ${dossard} مُسجَّلة في المركز ${existing.position}`);
      return;
    }

    setBusy(true);

    const { data: athlete } = await supabase
      .from('athletes')
      .select('id, first_name, last_name')
      .eq('dossard_number', dossard)
      .eq('category', currentRace.category)
      .eq('gender', currentRace.gender)
      .maybeSingle();

    if (!athlete) {
      setError(`الصدرية ${dossard} غير موجودة في ${CATEGORY_LABELS[currentRace.category][currentRace.gender]}`);
      setBusy(false);
      return;
    }

    const { data: att } = await supabase
      .from('attendance')
      .select('start_line_at')
      .eq('athlete_id', athlete.id)
      .eq('race_id', currentRace.id)
      .maybeSingle();

    if (!att || !att.start_line_at) {
      setError(`⚠️ ${athlete.first_name} ${athlete.last_name} لم يعبر خط الانطلاق — مرفوض`);
      setBusy(false);
      return;
    }

    const newPosition = orders.length + 1;
    const clientId = generateClientId();
    const recordedBy = committeeMember?.id || null;

    const localRecord = {
      client_id: clientId,
      race_id: currentRace.id,
      position: newPosition,
      dossard_number: dossard,
      recorded_by: recordedBy,
      recorded_at: new Date().toISOString(),
      synced: 0,
    };

    await enqueue(STORE, localRecord);
    setOrders([...orders, localRecord]);
    setDossardInput('');
    setSuccess(`✓ المركز ${newPosition}: ${athlete.first_name} ${athlete.last_name}`);
    setTimeout(() => setSuccess(''), 2000);
    setBusy(false);
    inputRef.current?.focus();

    if (navigator.onLine) {
      supabase
        .from('race_finish_orders')
        .insert({
          race_id: currentRace.id,
          position: newPosition,
          dossard_number: dossard,
          recorded_by: recordedBy,
          client_id: clientId,
          is_synced: true,
        })
        .then(({ error: insertErr }) => {
          if (!insertErr) {
            markSynced(STORE, clientId).then(() => {
              setOrders((prev) =>
                prev.map((o) => (o.client_id === clientId ? { ...o, synced: 1 } : o))
              );
            });
          }
        });
    }
  }

  async function handleUndoLast() {
    if (orders.length === 0) return;
    if (!confirm('حذف آخر إدخال؟')) return;

    const last = orders[orders.length - 1];
    if (last.synced) {
      await supabase.from('race_finish_orders').delete().eq('client_id', last.client_id);
    }
    await deleteRecord(STORE, last.client_id);
    setOrders(orders.slice(0, -1));
    setError('');
    setSuccess('تم الحذف');
    setTimeout(() => setSuccess(''), 1500);
  }

  async function handleFinishRace() {
    if (!currentRace) return;
    setShowFinishConfirm(false);
    setBusy(true);
    await syncPendingRecords();
    setSuccess('✓ تم إنهاء السباق — في انتظار اعتماد اللجنة');
    setTimeout(() => {
      setSuccess('');
      detectCurrentRace();
    }, 3000);
    setBusy(false);
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

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
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 18 }}>🏁 خط الوصول</h1>
          <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 2 }}>
            {committeeMember?.full_name || user?.email}
          </div>
        </div>
        <button onClick={onLogout} className="logout-btn">خروج</button>
      </header>

      <div style={{ padding: 16, maxWidth: 600, margin: '0 auto' }}>
        {!currentRace && (
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

        {currentRace && (
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
              <div style={{ fontSize: 22, fontWeight: 900 }}>
                {CATEGORY_LABELS[currentRace.category][currentRace.gender]}
              </div>
              <div style={{ fontSize: 14, opacity: 0.9, marginTop: 4 }}>
                {currentRace.stage === 'qualifying' ? 'التصفيات' : 'النهائيات'}
              </div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
                {orders.length} وصل
              </div>
            </div>

            <div
              style={{
                background: 'white',
                padding: 16,
                borderRadius: 'var(--radius)',
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  marginBottom: 10,
                  textAlign: 'center',
                  color: '#555',
                }}
              >
                المركز التالي:{' '}
                <span style={{ color: 'var(--accent)', fontSize: 28, fontWeight: 900 }}>
                  {orders.length + 1}
                </span>
              </div>

              <input
                ref={inputRef}
                type="number"
                inputMode="numeric"
                value={dossardInput}
                onChange={(e) => setDossardInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddDossard()}
                placeholder="رقم الصدرية"
                dir="ltr"
                autoFocus
                disabled={busy}
                style={{
                  width: '100%',
                  padding: 16,
                  fontSize: 32,
                  fontWeight: 900,
                  textAlign: 'center',
                  borderRadius: 'var(--radius)',
                  border: '2px solid #ddd',
                  fontFamily: 'inherit',
                  letterSpacing: '2px',
                  marginBottom: 12,
                }}
              />

              {error && (
                <div
                  style={{
                    background: '#fff3f3',
                    border: '2px solid #f44',
                    color: '#c00',
                    padding: 12,
                    borderRadius: 'var(--radius)',
                    marginBottom: 12,
                    fontWeight: 600,
                    fontSize: 14,
                    textAlign: 'center',
                  }}
                >
                  {error}
                </div>
              )}

              {success && (
                <div
                  style={{
                    background: '#f0fff4',
                    border: '2px solid #4c4',
                    color: '#070',
                    padding: 12,
                    borderRadius: 'var(--radius)',
                    marginBottom: 12,
                    fontWeight: 700,
                    fontSize: 14,
                    textAlign: 'center',
                  }}
                >
                  {success}
                </div>
              )}

              <button
                onClick={handleAddDossard}
                disabled={busy || !dossardInput}
                className="btn btn-success btn-block"
                style={{ minHeight: 60, fontSize: 18, fontWeight: 900 }}
              >
                {busy ? 'جاري الحفظ...' : '✓ تسجيل الوصول'}
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
                  الترتيب ({orders.length})
                </h3>
                {orders.length > 0 && (
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
                )}
              </div>

              {orders.length === 0 ? (
                <div
                  style={{
                    background: 'white',
                    padding: 20,
                    borderRadius: 'var(--radius)',
                    textAlign: 'center',
                    color: '#888',
                    fontSize: 14,
                  }}
                >
                  لم يصل أحد بعد
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 6 }}>
                  {[...orders].reverse().map((o) => (
                    <div
                      key={o.client_id}
                      style={{
                        background: 'white',
                        padding: 12,
                        borderRadius: 'var(--radius)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        border: o.synced ? '1px solid #eee' : '1px dashed #f59e0b',
                      }}
                    >
                      <div
                        style={{
                          minWidth: 40,
                          height: 40,
                          background: o.position <= 3 ? '#fef3c7' : '#f8fafc',
                          color: o.position <= 3 ? '#d97706' : '#444',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 900,
                          fontSize: 16,
                        }}
                      >
                        {o.position}
                      </div>
                      <div style={{ flex: 1, fontSize: 18, fontWeight: 800, direction: 'ltr' }}>
                        #{o.dossard_number}
                      </div>
                      {!o.synced && (
                        <div
                          style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}
                          title="لم يتزامن بعد"
                        >
                          ⏳
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {orders.length > 0 && (
              <button
                onClick={() => setShowFinishConfirm(true)}
                className="btn btn-block"
                style={{
                  background: '#dc2626',
                  color: 'white',
                  minHeight: 56,
                  fontSize: 16,
                  fontWeight: 900,
                  marginTop: 16,
                }}
              >
                🏁 إنهاء السباق
              </button>
            )}
          </>
        )}
      </div>

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
            <p style={{ fontSize: 14, color: '#555', marginBottom: 8 }}>
              هل أنت متأكد من أن جميع الرياضيين قد وصلوا؟
            </p>
            <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
              سيتم تسجيل {orders.length} وصول. الرياضيون الذين عبروا خط الانطلاق ولم يصلوا
              سيُصنّفون "لم يكمل" تلقائياً.
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
    </div>
  );
}