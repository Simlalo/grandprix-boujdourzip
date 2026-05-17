import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const CATEGORY_LABELS = {
  katakit: { male: 'كتاكيت ذكور', female: 'كتاكيت إناث' },
  baraem:  { male: 'براعم',       female: 'برعمات' },
  sighar:  { male: 'صغار',        female: 'صغيرات' },
  fityan:  { male: 'فتيان',       female: 'فتيات' },
};
const CATEGORY_ORDER = ['katakit', 'baraem', 'sighar', 'fityan'];

const FREE_INSTITUTION_DISPLAY = 'جمعية شباب الجنوب لألعاب القوى';

export default function FinalResultsPanel() {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('races'); // 'races' | 'grandprix'
  const [races, setRaces] = useState([]);
  const [selectedRace, setSelectedRace] = useState(null);
  const [allResults, setAllResults] = useState([]);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [racesResp, resultsResp] = await Promise.all([
      supabase.from('races').select('*').order('scheduled_at'),
      supabase.from('results').select(`
        id, rank, points, qualified_to_final, finish_time_ms,
        race:races(id, category, gender, stage),
        athlete:athletes(id, first_name, last_name, dossard_number,
          institution:institutions(id, name, is_free_participants))
      `),
    ]);
    setRaces(racesResp.data || []);
    setAllResults(resultsResp.data || []);
    setLoading(false);
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  if (selectedRace) {
    return (
      <RaceResultsView
        race={selectedRace}
        allResults={allResults}
        onBack={() => setSelectedRace(null)}
      />
    );
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setView('races')}
          className={view === 'races' ? 'btn btn-accent' : 'btn btn-outline'}
          style={{ flex: 1, minHeight: 48, fontWeight: 900 }}
        >
          📋 السباقات
        </button>
        <button
          onClick={() => setView('grandprix')}
          className={view === 'grandprix' ? 'btn btn-accent' : 'btn btn-outline'}
          style={{ flex: 1, minHeight: 48, fontWeight: 900 }}
        >
          🏆 الجائزة الكبرى
        </button>
      </div>

      {view === 'races' && (
        <RacesList races={races} allResults={allResults} onSelect={setSelectedRace} />
      )}
      {view === 'grandprix' && (
        <GrandPrixView allResults={allResults} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// قائمة السباقات
// ═══════════════════════════════════════════════════════
function RacesList({ races, allResults, onSelect }) {
  const qualifying = races.filter(r => r.stage === 'qualifying');
  const finals = races.filter(r => r.stage === 'final');

  return (
    <div>
      <Section title="🏁 التصفيات" races={qualifying} allResults={allResults} onSelect={onSelect} />
      {finals.length > 0 && (
        <Section title="🥇 النهائيات" races={finals} allResults={allResults} onSelect={onSelect} />
      )}
    </div>
  );
}

function Section({ title, races, allResults, onSelect }) {
  const sorted = [];
  CATEGORY_ORDER.forEach(cat => {
    ['male', 'female'].forEach(gender => {
      const r = races.find(x => x.category === cat && x.gender === gender);
      if (r) sorted.push(r);
    });
  });

  return (
    <div className="mb-4">
      <h3 style={{ fontSize: 16, fontWeight: 900, marginBottom: 8 }}>{title}</h3>
      <div className="flex flex-col gap-2">
        {sorted.map(race => (
          <RaceCard key={race.id} race={race} allResults={allResults} onSelect={() => onSelect(race)} />
        ))}
      </div>
    </div>
  );
}

function RaceCard({ race, allResults, onSelect }) {
  const finishers = allResults.filter(r => r.race?.id === race.id && r.rank != null).length;
  const dnf = allResults.filter(r => r.race?.id === race.id && r.rank == null).length;
  const isApproved = race.status === 'approved';
  const label = CATEGORY_LABELS[race.category][race.gender];

  return (
    <button
      onClick={onSelect}
      className="card"
      disabled={!isApproved}
      style={{
        padding: 14,
        background: isApproved ? '#d1fae5' : '#f8fafc',
        borderColor: isApproved ? '#15803d' : 'var(--border)',
        cursor: isApproved ? 'pointer' : 'not-allowed',
        textAlign: 'right',
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        opacity: isApproved ? 1 : 0.6,
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 900, color: isApproved ? '#15803d' : '#94a3b8' }}>
        {isApproved ? '✓' : '○'}
      </div>
      <div style={{ flex: 1, textAlign: 'right', marginRight: 10 }}>
        <div style={{ fontSize: 17, fontWeight: 900 }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
          {isApproved
            ? `${finishers} رياضي بنتيجة${dnf > 0 ? ` • ${dnf} لم يكملوا` : ''}`
            : 'لم يُعتمد بعد'
          }
        </div>
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════
// عرض نتائج سباق واحد (جدولان: فردي + جماعي)
// ═══════════════════════════════════════════════════════
function RaceResultsView({ race, allResults, onBack }) {
  const label = CATEGORY_LABELS[race.category][race.gender];
  const stageLabel = race.stage === 'qualifying' ? 'التصفيات' : 'النهائيات';

  const raceResults = allResults
    .filter(r => r.race?.id === race.id)
    .sort((a, b) => {
      if (a.rank == null) return 1;
      if (b.rank == null) return -1;
      return a.rank - b.rank;
    });

  const finishers = raceResults.filter(r => r.rank != null);
  const dnf = raceResults.filter(r => r.rank == null);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="btn btn-outline" style={{ minHeight: 44 }}>
          → الرجوع
        </button>
        <div style={{ textAlign: 'center', flex: 1, marginRight: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{label}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>
            {stageLabel}
          </div>
        </div>
      </div>

      <IndividualTable finishers={finishers} dnf={dnf} race={race} />

      {race.stage === 'qualifying' && finishers.length > 0 && (
        <div className="mt-4">
          <TeamStandings finishers={finishers} />
        </div>
      )}
    </div>
  );
}

// ─── الجدول 1: النتائج الفردية + المؤهلين ───
function IndividualTable({ finishers, dnf, race }) {
  const showQualified = race.stage === 'qualifying';

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{
        padding: '10px 12px', background: '#f8fafc', fontWeight: 900,
        fontSize: 14, borderBottom: '1px solid var(--border)',
      }}>
        النتائج الفردية ({finishers.length})
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: showQualified ? '40px 1fr 80px 50px 60px' : '40px 1fr 80px 50px',
        gap: 8, padding: '8px 12px', background: '#f1f5f9',
        fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
      }}>
        <div>المركز</div>
        <div>الرياضي / المؤسسة</div>
        <div style={{ textAlign: 'center', direction: 'ltr' }}>التوقيت</div>
        <div style={{ textAlign: 'center' }}>النقاط</div>
        {showQualified && <div style={{ textAlign: 'center' }}>تأهل</div>}
      </div>

      {finishers.map((r, idx) => (
        <div key={r.id} style={{
          display: 'grid',
          gridTemplateColumns: showQualified ? '40px 1fr 80px 50px 60px' : '40px 1fr 80px 50px',
          gap: 8, padding: '10px 12px',
          background: idx % 2 === 0 ? 'white' : '#fafafa',
          borderBottom: '1px solid #f1f5f9', alignItems: 'center', fontSize: 13,
        }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>
            {r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>
              <span style={{ color: 'var(--accent)', fontWeight: 900, marginLeft: 4 }}>
                #{r.athlete?.dossard_number}
              </span>
              {r.athlete?.first_name} {r.athlete?.last_name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {r.athlete?.institution?.is_free_participants
                ? FREE_INSTITUTION_DISPLAY
                : r.athlete?.institution?.name || '—'}
            </div>
          </div>
          <div style={{ fontFamily: 'monospace', fontWeight: 700, direction: 'ltr', textAlign: 'center', fontSize: 12 }}>
            {formatMs(r.finish_time_ms)}
          </div>
          <div style={{ textAlign: 'center', fontWeight: 900, color: r.points > 0 ? 'var(--accent)' : '#94a3b8' }}>
            {r.points || 0}
          </div>
          {showQualified && (
            <div style={{ textAlign: 'center' }}>
              {r.qualified_to_final ? (
                <span style={{
                  fontSize: 10, background: '#d1fae5', color: '#065f46',
                  padding: '2px 6px', borderRadius: 4, fontWeight: 700,
                }}>✓ مؤهل</span>
              ) : '—'}
            </div>
          )}
        </div>
      ))}

      {dnf.length > 0 && (
        <>
          <div style={{
            padding: '8px 12px', background: '#fef3c7', fontSize: 12,
            fontWeight: 700, color: '#92400e', borderTop: '2px solid #fcd34d',
          }}>
            ⚠ لم يكملوا السباق ({dnf.length})
          </div>
          {dnf.map(r => (
            <div key={r.id} style={{
              padding: '8px 12px', fontSize: 12,
              borderBottom: '1px solid #f1f5f9', background: '#fffbeb',
            }}>
              <span style={{ color: 'var(--accent)', fontWeight: 900, marginLeft: 6 }}>
                #{r.athlete?.dossard_number}
              </span>
              {r.athlete?.first_name} {r.athlete?.last_name}
              <span style={{ fontSize: 10, color: 'var(--text-muted)', marginRight: 8 }}>
                — {r.athlete?.institution?.is_free_participants
                  ? FREE_INSTITUTION_DISPLAY
                  : r.athlete?.institution?.name || '—'}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── الجدول 2: الترتيب الجماعي لكل فئة (تصفيات فقط، 20→1، شرط 4) ───
function TeamStandings({ finishers }) {
  const top20 = finishers.filter(r => r.rank >= 1 && r.rank <= 20);

  const instMap = {};
  top20.forEach(r => {
    const inst = r.athlete?.institution;
    if (!inst?.id) return;
    const isFree = inst.is_free_participants === true;
    const displayName = isFree ? FREE_INSTITUTION_DISPLAY : inst.name;
    const key = isFree ? '__free__' : inst.id;

    if (!instMap[key]) {
      instMap[key] = { id: key, name: displayName, count: 0, points: 0 };
    }
    instMap[key].count += 1;
    instMap[key].points += (21 - r.rank); // 20→1
  });

  const allInst = Object.values(instMap);
  const eligible = allInst.filter(i => i.count >= 4).sort((a, b) => b.points - a.points);
  const ineligible = allInst.filter(i => i.count < 4).sort((a, b) => b.points - a.points);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{
        padding: '10px 12px', background: '#f8fafc',
        fontWeight: 900, fontSize: 14, borderBottom: '1px solid var(--border)',
      }}>
        🏛 الترتيب الجماعي للفئة
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginTop: 2 }}>
          نقاط 20→1 • شرط: 4 رياضيين على الأقل في المراتب 1-20
        </div>
      </div>

      {eligible.length === 0 && (
        <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
          لا توجد مؤسسات مؤهلة بعد
        </div>
      )}

      {eligible.length > 0 && (
        <>
          <div style={{
            display: 'grid', gridTemplateColumns: '40px 1fr 70px 60px',
            gap: 8, padding: '8px 12px', background: '#f1f5f9',
            fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
          }}>
            <div>المركز</div>
            <div>المؤسسة</div>
            <div style={{ textAlign: 'center' }}>الرياضيون</div>
            <div style={{ textAlign: 'center' }}>النقاط</div>
          </div>

          {eligible.map((inst, idx) => (
            <div key={inst.id} style={{
              display: 'grid', gridTemplateColumns: '40px 1fr 70px 60px',
              gap: 8, padding: '10px 12px',
              background: idx === 0 ? '#fef9c3' : (idx % 2 === 0 ? 'white' : '#fafafa'),
              borderBottom: '1px solid #f1f5f9', alignItems: 'center', fontSize: 13,
            }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>
                {idx === 0 ? '🏆' : idx + 1}
              </div>
              <div style={{ fontWeight: 700 }}>{inst.name}</div>
              <div style={{ textAlign: 'center', fontSize: 12 }}>{inst.count}</div>
              <div style={{ textAlign: 'center', fontWeight: 900, color: 'var(--accent)' }}>
                {inst.points}
              </div>
            </div>
          ))}
        </>
      )}

      {ineligible.length > 0 && (
        <>
          <div style={{
            padding: '8px 12px', background: '#f3f4f6',
            fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
            borderTop: '1px solid var(--border)',
          }}>
            غير مؤهلة (أقل من 4 رياضيين في 1-20)
          </div>
          {ineligible.map(inst => (
            <div key={inst.id} style={{
              padding: '6px 12px', fontSize: 12, color: '#6b7280',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span>{inst.name}</span>
              <span style={{ fontSize: 10 }}>
                {inst.count} رياضي • {inst.points} نقطة
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// الجائزة الكبرى — جدول واحد لكل المؤسسات
// نقاط الفردي 10→1 من كل السباقات
// ═══════════════════════════════════════════════════════
function GrandPrixView({ allResults }) {
  // تجميع نقاط كل مؤسسة من points (المُولّد 10→1)
  const instMap = {};

  allResults.forEach(r => {
    if (!r.points || r.points <= 0) return; // فقط الـ10 الأوائل
    const inst = r.athlete?.institution;
    if (!inst?.id) return;

    const isFree = inst.is_free_participants === true;
    const displayName = isFree ? FREE_INSTITUTION_DISPLAY : inst.name;
    const key = isFree ? '__free__' : inst.id;

    if (!instMap[key]) {
      instMap[key] = {
        id: key,
        name: displayName,
        totalPoints: 0,
        athletesCount: new Set(),
      };
    }
    instMap[key].totalPoints += r.points;
    instMap[key].athletesCount.add(r.athlete?.id);
  });

  const standings = Object.values(instMap)
    .map(i => ({ ...i, athletesCount: i.athletesCount.size }))
    .sort((a, b) => b.totalPoints - a.totalPoints);

  return (
    <div>
      <div style={{
        padding: '12px 14px', background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
        color: 'white', borderRadius: 12, marginBottom: 16, textAlign: 'center',
      }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>🏆 الجائزة الكبرى</div>
        <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
          مجموع نقاط الفردي (10→1) من جميع السباقات
        </div>
      </div>

      {standings.length === 0 ? (
        <div className="card text-center" style={{ padding: 32 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            لا توجد نتائج معتمدة بعد
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '50px 1fr 60px 60px',
            gap: 8, padding: '10px 12px', background: '#f1f5f9',
            fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
          }}>
            <div>المركز</div>
            <div>المؤسسة</div>
            <div style={{ textAlign: 'center' }}>الرياضيون</div>
            <div style={{ textAlign: 'center' }}>النقاط</div>
          </div>

          {standings.map((inst, idx) => (
            <div key={inst.id} style={{
              display: 'grid', gridTemplateColumns: '50px 1fr 60px 60px',
              gap: 8, padding: '12px',
              background: idx === 0 ? '#fef9c3' : idx === 1 ? '#f1f5f9' : idx === 2 ? '#fed7aa' : (idx % 2 === 0 ? 'white' : '#fafafa'),
              borderBottom: '1px solid #f1f5f9', alignItems: 'center', fontSize: 14,
            }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>
                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
              </div>
              <div style={{ fontWeight: 700 }}>{inst.name}</div>
              <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                {inst.athletesCount}
              </div>
              <div style={{ textAlign: 'center', fontWeight: 900, fontSize: 16, color: 'var(--accent)' }}>
                {inst.totalPoints}
              </div>
            </div>
          ))}
        </div>
      )}
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