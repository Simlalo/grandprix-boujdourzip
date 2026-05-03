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
      <RaceResultsEntry
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
// شاشة اختيار السباق
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

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  const grouped = [];
  CATEGORY_ORDER.forEach(cat => {
    ['male', 'female'].forEach(gender => {
      const race = races.find(r => r.category === cat && r.gender === gender);
      if (race) {
        grouped.push({
          race,
          label: CATEGORY_LABELS[cat][gender],
        });
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
          <button
            key={race.id}
            onClick={() => onSelect(race)}
            className="card"
            style={{
              padding: 18,
              background: race.is_completed ? '#d1fae5' : 'white',
              borderColor: race.is_completed ? 'var(--success)' : 'var(--border)',
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
            <div style={{
              fontSize: 28,
              color: race.is_completed ? 'var(--success)' : 'var(--text-muted)',
            }}>
              {race.is_completed ? '✓' : '›'}
            </div>
            <div style={{ flex: 1, textAlign: 'right', marginRight: 12 }}>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{label}</div>
              {race.is_completed && (
                <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 700, marginTop: 2 }}>
                  مكتمل
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// شاشة إدخال النتائج (محسّنة للميدان)
// ═══════════════════════════════════════════════════════

function RaceResultsEntry({ race, isAdmin, onBack }) {
  const [athletes, setAthletes] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dossardInput, setDossardInput] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const raceLabel = CATEGORY_LABELS[race.category][race.gender];
  const stageLabel = race.stage === 'qualifying' ? 'التصفيات' : 'النهائيات';

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);

    let { data: ath } = await supabase
      .from('athletes')
      .select('*, institution:institutions(id, name, list_status)')
      .eq('category', race.category)
      .eq('gender', race.gender)
      .not('dossard_number', 'is', null);

    let filteredAthletes = (ath || []).filter(a => a.institution?.list_status === 'approved');

    if (race.stage === 'final') {
      const { data: qualifyingRace } = await supabase
        .from('races')
        .select('id')
        .eq('category', race.category)
        .eq('gender', race.gender)
        .eq('stage', 'qualifying')
        .single();

      if (qualifyingRace) {
        const { data: qualifiers } = await supabase
          .from('results')
          .select('athlete_id')
          .eq('race_id', qualifyingRace.id)
          .lte('rank', 40);

        const qualifierIds = (qualifiers || []).map(q => q.athlete_id);
        filteredAthletes = filteredAthletes.filter(a => qualifierIds.includes(a.id));
      }
    }

    setAthletes(filteredAthletes);

    const { data: existing } = await supabase
      .from('results')
      .select('*, athlete:athletes(*)')
      .eq('race_id', race.id)
      .order('rank');

    setResults(existing || []);
    setLoading(false);
  }

  async function handleAddDossard() {
    setError('');

    const dossard = parseInt(dossardInput);
    if (!dossard || isNaN(dossard)) {
      setError('أدخل رقماً صحيحاً');
      return;
    }

    const athlete = athletes.find(a => a.dossard_number === dossard);
    if (!athlete) {
      setError(`الرقم ${dossard} غير موجود في ${raceLabel}`);
      return;
    }

    if (results.some(r => r.athlete_id === athlete.id)) {
      const existingRank = results.find(r => r.athlete_id === athlete.id).rank;
      setError(`الرقم ${dossard} مُدخَل في المركز ${existingRank}`);
      return;
    }

    setSaving(true);
    const newRank = results.length + 1;
    const newPoints = newRank <= 10 ? 11 - newRank : 0;

    const { data: inserted, error: insertError } = await supabase
      .from('results')
      .insert({
        athlete_id: athlete.id,
        race_id: race.id,
        rank: newRank,
        points: newPoints,
      })
      .select('*, athlete:athletes(*)')
      .single();

    if (insertError) {
      setError('خطأ في الحفظ: ' + insertError.message);
      setSaving(false);
      return;
    }

    setResults([...results, inserted]);
    setDossardInput('');
    setSaving(false);
  }

  async function handleRemoveResult(resultId, rank) {
    if (!confirm(`حذف المركز ${rank}؟`)) return;

    setSaving(true);
    await supabase.from('results').delete().eq('id', resultId);

    const toUpdate = results.filter(r => r.rank > rank);
    for (const r of toUpdate) {
      const newRank = r.rank - 1;
      const newPoints = newRank <= 10 ? 11 - newRank : 0;
      await supabase
        .from('results')
        .update({ rank: newRank, points: newPoints })
        .eq('id', r.id);
    }

    setDossardInput('');
    await loadData();
    setSaving(false);
  }

  async function handleCompleteRace() {
    if (!confirm(`تأكيد إنهاء ${stageLabel} ${raceLabel}؟`)) return;

    await supabase
      .from('races')
      .update({ is_completed: true })
      .eq('id', race.id);

    onBack();
  }

  async function handleReopenRace() {
    if (!confirm('إعادة فتح هذا السباق للتعديل؟')) return;

    await supabase
      .from('races')
      .update({ is_completed: false })
      .eq('id', race.id);

    await loadData();
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  const presentAthletes = results.map(r => r.athlete_id);
  const absentAthletes = athletes.filter(a => !presentAthletes.includes(a.id));

  return (
    <div>
      <button onClick={onBack} className="btn btn-outline mb-4" style={{ fontSize: 14, minHeight: 48 }}>
        → الرجوع
      </button>

      <div className="card mb-4" style={{
        background: 'var(--primary)',
        color: 'white',
        textAlign: 'center',
        padding: 20,
      }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>{raceLabel}</div>
        <div style={{ fontSize: 16, opacity: 0.9, marginTop: 6 }}>
          {stageLabel}
        </div>
        <div style={{ fontSize: 13, opacity: 0.7, marginTop: 8 }}>
          {athletes.length} رياضي مسجل • {results.length} وصل
        </div>
      </div>

      {isAdmin && !race.is_completed && (
        <div className="card mb-4" style={{ padding: 20 }}>
          <div style={{
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 12,
            textAlign: 'center',
          }}>
            المركز التالي:{' '}
            <span style={{
              color: 'var(--accent)',
              fontSize: 28,
              fontWeight: 900,
            }}>
              {results.length + 1}
            </span>
          </div>

          {error && (
            <div className="alert alert-error" style={{
              marginBottom: 12,
              padding: 12,
              fontSize: 15,
              fontWeight: 600,
              textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          <input
            type="number"
            className="form-input"
            value={dossardInput}
            onChange={(e) => setDossardInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddDossard()}
            placeholder="رقم الصدرية"
            dir="ltr"
            style={{
              fontSize: 32,
              fontWeight: 900,
              textAlign: 'center',
              minHeight: 64,
              marginBottom: 12,
              letterSpacing: '2px',
            }}
            autoFocus
            disabled={saving}
          />

          <button
            className="btn btn-success btn-block"
            onClick={handleAddDossard}
            disabled={saving || !dossardInput}
            style={{
              minHeight: 64,
              fontSize: 18,
              fontWeight: 900,
            }}
          >
            {saving ? 'جاري الحفظ...' : '✓ إضافة'}
          </button>
        </div>
      )}

      <div className="mb-4">
        <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>
          الترتيب ({results.length})
        </h3>
        {results.length === 0 ? (
          <div className="card text-center text-muted" style={{ padding: 24 }}>
            لم تُدخَل أي نتيجة بعد
          </div>
        ) : (
          <div className="list">
            {results.map((r) => (
              <ResultRow
                key={r.id}
                result={r}
                isAdmin={isAdmin && !race.is_completed}
                onRemove={() => handleRemoveResult(r.id, r.rank)}
              />
            ))}
          </div>
        )}
      </div>

      {absentAthletes.length > 0 && (
        <details className="mb-4">
          <summary style={{
            cursor: 'pointer',
            fontSize: 16,
            fontWeight: 700,
            padding: 12,
            background: '#f8fafc',
            borderRadius: 'var(--radius)',
          }}>
            لم يُسجَّلوا ({absentAthletes.length}) ▾
          </summary>
          <div className="list mt-2">
            {absentAthletes.map((a) => (
              <div key={a.id} className="list-item" style={{ opacity: 0.7 }}>
                <div className="list-item-info">
                  <div style={{ fontSize: 14 }}>
                    <strong style={{ color: 'var(--text-muted)' }}>{a.dossard_number}</strong>
                    {' • '}
                    {a.first_name} {a.last_name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {a.institution?.name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {isAdmin && results.length > 0 && !race.is_completed && (
        <button
          className="btn btn-success btn-block"
          onClick={handleCompleteRace}
          style={{ minHeight: 56, fontSize: 16, fontWeight: 900 }}
        >
          ✓ إنهاء {stageLabel}
        </button>
      )}

      {isAdmin && race.is_completed && (
        <>
          <div className="alert alert-success">
            ✓ تم إنهاء هذا السباق
          </div>
          <button
            className="btn btn-outline btn-block"
            onClick={handleReopenRace}
            style={{ fontSize: 14 }}
          >
            ↻ إعادة الفتح للتعديل
          </button>
        </>
      )}
    </div>
  );
}

function ResultRow({ result, isAdmin, onRemove }) {
  const points = result.rank <= 10 ? 11 - result.rank : 0;
  const isPodium = result.rank <= 3;

  return (
    <div className="list-item" style={{
      background: isPodium ? '#fef3c7' : 'white',
      borderColor: isPodium ? '#f59e0b' : 'var(--border)',
      borderWidth: isPodium ? 2 : 1,
      padding: 14,
    }}>
      <div className="list-item-info" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          fontSize: 24,
          fontWeight: 900,
          color: isPodium ? '#92400e' : 'var(--primary)',
          minWidth: 40,
          textAlign: 'center',
        }}>
          {result.rank}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            <span style={{
              color: 'var(--accent)',
              fontWeight: 900,
              fontSize: 18,
            }}>
              #{result.athlete?.dossard_number}
            </span>
            {' '}
            {result.athlete?.first_name} {result.athlete?.last_name}
          </div>
          {points > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {points} نقطة
              {result.qualified_to_final && ' • ✓ متأهل'}
            </div>
          )}
        </div>
      </div>
      {isAdmin && (
        <button
          onClick={onRemove}
          style={{
            background: 'transparent',
            color: 'var(--danger)',
            fontSize: 22,
            padding: 8,
            minWidth: 40,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
