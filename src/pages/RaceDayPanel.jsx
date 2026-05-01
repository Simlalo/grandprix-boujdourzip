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

  if (selectedRace) {
    return (
      <RaceResultsEntry
        race={selectedRace}
        isAdmin={isAdmin}
        onBack={() => setSelectedRace(null)}
      />
    );
  }

  return <RaceSelector onSelect={setSelectedRace} />;
}

function RaceSelector({ onSelect }) {
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRaces();
  }, []);

  async function loadRaces() {
    setLoading(true);
    const { data } = await supabase
      .from('races')
      .select('*');
    setRaces(data || []);
    setLoading(false);
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  const grouped = {};
  CATEGORY_ORDER.forEach(cat => {
    ['male', 'female'].forEach(gender => {
      const key = `${cat}_${gender}`;
      grouped[key] = {
        category: cat,
        gender,
        label: CATEGORY_LABELS[cat][gender],
        qualifying: races.find(r => r.category === cat && r.gender === gender && r.stage === 'qualifying'),
        final: races.find(r => r.category === cat && r.gender === gender && r.stage === 'final'),
      };
    });
  });

  return (
    <div>
      <p className="text-muted mb-4" style={{ fontSize: 13 }}>
        اختر الفئة والمرحلة لإدخال النتائج
      </p>

      <div className="flex flex-col gap-4">
        {Object.values(grouped).map((group) => (
          <div key={`${group.category}_${group.gender}`} className="card" style={{ padding: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10 }}>
              {group.label}
            </div>
            <div className="flex gap-2">
              <button
                className="btn btn-outline"
                style={{ flex: 1, fontSize: 13 }}
                onClick={() => onSelect(group.qualifying)}
                disabled={!group.qualifying}
              >
                {group.qualifying?.is_completed ? '✓ ' : ''}التصفيات
              </button>
              <button
                className="btn btn-outline"
                style={{ flex: 1, fontSize: 13 }}
                onClick={() => onSelect(group.final)}
                disabled={!group.final || !group.qualifying?.is_completed}
              >
                {group.final?.is_completed ? '✓ ' : ''}النهائيات
              </button>
            </div>
            {!group.qualifying?.is_completed && group.final && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                النهائيات تُفتح بعد إكمال التصفيات
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function RaceResultsEntry({ race, isAdmin, onBack }) {
  const [athletes, setAthletes] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dossardInput, setDossardInput] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const raceLabel = CATEGORY_LABELS[race.category][race.gender];
  const stageLabel = race.stage === 'qualifying' ? 'التصفيات' : 'النهائيات';

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    let query = supabase
      .from('athletes')
      .select('*, institution:institutions(id, name, list_status)')
      .eq('category', race.category)
      .eq('gender', race.gender)
      .not('dossard_number', 'is', null);

    const { data: ath } = await query;

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
      setError(`الرقم ${dossard} مُدخَل مسبقاً في المركز ${results.find(r => r.athlete_id === athlete.id).rank}`);
      return;
    }

    setSaving(true);
    const newRank = results.length + 1;

    const { data: inserted, error: insertError } = await supabase
      .from('results')
      .insert({
        athlete_id: athlete.id,
        race_id: race.id,
        rank: newRank,
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
    if (!confirm(`حذف المركز ${rank}؟ سيُعاد ترقيم المراكز التالية.`)) return;

    setSaving(true);

    await supabase.from('results').delete().eq('id', resultId);

    const toUpdate = results.filter(r => r.rank > rank);
    for (const r of toUpdate) {
      await supabase
        .from('results')
        .update({ rank: r.rank - 1 })
        .eq('id', r.id);
    }

    await loadData();
    setSaving(false);
  }

  async function handleCompleteRace() {
    if (!confirm(`تأكيد إنهاء ${stageLabel} ${raceLabel}؟ يمكنك العودة للتعديل لاحقاً.`)) return;

    await supabase
      .from('races')
      .update({ is_completed: true })
      .eq('id', race.id);

    alert('تم تسجيل النتائج. يمكنك الآن العودة وفتح ' + (race.stage === 'qualifying' ? 'النهائيات' : 'سباق آخر'));
    onBack();
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  const presentAthletes = results.map(r => r.athlete_id);
  const absentAthletes = athletes.filter(a => !presentAthletes.includes(a.id));

  return (
    <div>
      <button onClick={onBack} className="btn btn-outline mb-4" style={{ fontSize: 13 }}>
        → الرجوع لقائمة السباقات
      </button>

      <div className="card mb-4" style={{ background: 'var(--primary)', color: 'white' }}>
        <div style={{ fontSize: 18, fontWeight: 900 }}>{raceLabel}</div>
        <div style={{ fontSize: 14, opacity: 0.8, marginTop: 4 }}>
          {stageLabel} • {athletes.length} رياضي مسجل
        </div>
      </div>

      {isAdmin && (
        <div className="card mb-4">
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
            المركز التالي: <span style={{ color: 'var(--accent)' }}>{results.length + 1}</span>
          </div>
          {error && <div className="alert alert-error" style={{ marginBottom: 8, padding: 8, fontSize: 13 }}>{error}</div>}
          <div className="flex gap-2">
            <input
              type="number"
              className="form-input"
              value={dossardInput}
              onChange={(e) => setDossardInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddDossard()}
              placeholder="رقم الصدرية"
              dir="ltr"
              style={{ flex: 1, fontSize: 18, fontWeight: 700, textAlign: 'center' }}
              autoFocus
              disabled={saving}
            />
            <button
              className="btn btn-success"
              onClick={handleAddDossard}
              disabled={saving || !dossardInput}
              style={{ minWidth: 80 }}
            >
              {saving ? '...' : 'إضافة'}
            </button>
          </div>
        </div>
      )}

      <div className="mb-4">
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
          الترتيب ({results.length})
        </h3>
        {results.length === 0 ? (
          <div className="card text-center text-muted">
            لم تُدخَل أي نتيجة بعد
          </div>
        ) : (
          <div className="list">
            {results.map((r) => (
              <ResultRow
                key={r.id}
                result={r}
                isAdmin={isAdmin}
                onRemove={() => handleRemoveResult(r.id, r.rank)}
              />
            ))}
          </div>
        )}
      </div>

      {absentAthletes.length > 0 && (
        <div className="mb-4">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            لم يُسجَّلوا بعد ({absentAthletes.length})
          </h3>
          <div className="list">
            {absentAthletes.map((a) => (
              <div key={a.id} className="list-item" style={{ opacity: 0.6 }}>
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
        </div>
      )}

      {isAdmin && results.length > 0 && !race.is_completed && (
        <button
          className="btn btn-success btn-block"
          onClick={handleCompleteRace}
        >
          ✓ إنهاء {stageLabel}
        </button>
      )}

      {race.is_completed && (
        <div className="alert alert-success">
          ✓ تم إنهاء هذا السباق. يمكنك التعديل بإضافة/حذف النتائج.
        </div>
      )}
    </div>
  );
}

function ResultRow({ result, isAdmin, onRemove }) {
  const points = result.rank <= 20 ? 21 - result.rank : 0;
  return (
    <div className="list-item" style={{
      background: result.rank <= 3 ? '#fef3c7' : 'white',
      borderColor: result.rank <= 3 ? '#f59e0b' : 'var(--border)',
    }}>
      <div className="list-item-info" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          fontSize: 18,
          fontWeight: 900,
          color: result.rank <= 3 ? '#92400e' : 'var(--primary)',
          minWidth: 32,
          textAlign: 'center',
        }}>
          {result.rank}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            <span style={{ color: 'var(--accent)' }}>#{result.athlete?.dossard_number}</span>
            {' '}
            {result.athlete?.first_name} {result.athlete?.last_name}
          </div>
          {points > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {points} نقطة
              {result.qualified_to_final && ' • ✓ متأهل للنهائيات'}
            </div>
          )}
        </div>
      </div>
      {isAdmin && (
        <button
          onClick={onRemove}
          style={{ background: 'transparent', color: 'var(--danger)', fontSize: 18, padding: 6 }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
