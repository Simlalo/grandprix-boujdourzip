import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const CATEGORY_LABELS = {
  katakit: { male: 'كتاكيت ذكور', female: 'كتاكيت إناث' },
  baraem: { male: 'براعم', female: 'برعمات' },
  sighar: { male: 'صغار', female: 'صغيرات' },
  fityan: { male: 'فتيان', female: 'فتيات' },
};

const CATEGORY_ORDER = ['katakit', 'baraem', 'sighar', 'fityan'];

const MEDALS = ['🥇', '🥈', '🥉'];

export default function FinalResultsPanel() {
  const [tab, setTab] = useState('standings'); // standings | categories
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [institutionStandings, setInstitutionStandings] = useState([]);
  const [categoryResults, setCategoryResults] = useState({});
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);

    // جلب كل السباقات
    const { data: racesData } = await supabase
      .from('races')
      .select('*');
    setRaces(racesData || []);

    // جلب كل النتائج مع بيانات الرياضي والمؤسسة
    const { data: resultsData } = await supabase
      .from('results')
      .select(`
        id, rank, points, qualified_to_final,
        race:races(id, category, gender, stage),
        athlete:athletes(id, first_name, last_name, dossard_number, institution:institutions(id, name))
      `);

    const results = resultsData || [];

    // ── حساب الترتيب الجماعي للمؤسسات ──
    const instMap = {};
    results.forEach(r => {
      const instId = r.athlete?.institution?.id;
      const instName = r.athlete?.institution?.name;
      if (!instId) return;
      if (!instMap[instId]) instMap[instId] = { id: instId, name: instName, points: 0 };
      instMap[instId].points += (r.points || 0);
    });

    const standings = Object.values(instMap)
      .sort((a, b) => b.points - a.points);
    setInstitutionStandings(standings);

    // ── حساب نتائج كل فئة ──
    const catMap = {};
    CATEGORY_ORDER.forEach(cat => {
      ['male', 'female'].forEach(gender => {
        const key = `${cat}_${gender}`;
        const qualRace = (racesData || []).find(r => r.category === cat && r.gender === gender && r.stage === 'qualifying');
        const finRace = (racesData || []).find(r => r.category === cat && r.gender === gender && r.stage === 'final');

        // نتائج التصفيات
        const qualResults = results.filter(r => r.race?.id === qualRace?.id);
        // نتائج النهائيات
        const finResults = results.filter(r => r.race?.id === finRace?.id);

        // دمج النتائج لكل رياضي
        const athleteMap = {};

        qualResults.forEach(r => {
          const aid = r.athlete?.id;
          if (!aid) return;
          if (!athleteMap[aid]) athleteMap[aid] = {
            id: aid,
            name: `${r.athlete.first_name} ${r.athlete.last_name}`,
            dossard: r.athlete.dossard_number,
            institution: r.athlete.institution?.name,
            qualPoints: 0, qualRank: null,
            finPoints: 0, finRank: null,
            total: 0,
          };
          athleteMap[aid].qualPoints = r.points || 0;
          athleteMap[aid].qualRank = r.rank;
        });

        finResults.forEach(r => {
          const aid = r.athlete?.id;
          if (!aid) return;
          if (!athleteMap[aid]) athleteMap[aid] = {
            id: aid,
            name: `${r.athlete.first_name} ${r.athlete.last_name}`,
            dossard: r.athlete.dossard_number,
            institution: r.athlete.institution?.name,
            qualPoints: 0, qualRank: null,
            finPoints: 0, finRank: null,
            total: 0,
          };
          athleteMap[aid].finPoints = r.points || 0;
          athleteMap[aid].finRank = r.rank;
        });

        // حساب المجموع والترتيب
        const athletes = Object.values(athleteMap)
          .map(a => ({ ...a, total: a.qualPoints + a.finPoints }))
          .sort((a, b) => b.total - a.total || b.qualPoints - a.qualPoints);

        catMap[key] = {
          label: CATEGORY_LABELS[cat][gender],
          hasQual: qualResults.length > 0,
          hasFin: finResults.length > 0,
          athletes,
        };
      });
    });

    setCategoryResults(catMap);
    setLoading(false);
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  const hasAnyResults = institutionStandings.length > 0;

  if (!hasAnyResults) {
    return (
      <div className="card text-center" style={{ padding: 40, marginTop: 16 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🏁</div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>لم تُسجَّل أي نتائج بعد</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          ابدأ بإدخال نتائج السباقات من قسم "يوم السباق"
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* تبويبات */}
      <div className="flex gap-2 mb-4">
        <button
          className={tab === 'standings' ? 'btn btn-accent' : 'btn btn-outline'}
          style={{ flex: 1, minHeight: 48, fontWeight: 900, fontSize: 15 }}
          onClick={() => setTab('standings')}
        >
          🏆 الترتيب العام
        </button>
        <button
          className={tab === 'categories' ? 'btn btn-accent' : 'btn btn-outline'}
          style={{ flex: 1, minHeight: 48, fontWeight: 900, fontSize: 15 }}
          onClick={() => setTab('categories')}
        >
          📋 الفئات
        </button>
      </div>

      {/* ── الترتيب العام ── */}
      {tab === 'standings' && (
        <InstitutionStandings standings={institutionStandings} />
      )}

      {/* ── الفئات ── */}
      {tab === 'categories' && (
        <CategoriesView
          categoryResults={categoryResults}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
        />
      )}
    </div>
  );
}

// ── الترتيب الجماعي للمؤسسات ──
function InstitutionStandings({ standings }) {
  if (standings.length === 0) {
    return (
      <div className="card text-center text-muted" style={{ padding: 32 }}>
        لا توجد نتائج بعد
      </div>
    );
  }

  const winner = standings[0];

  return (
    <div>
      {/* الجائزة الكبرى */}
      <div className="card mb-4" style={{
        background: 'linear-gradient(135deg, #92400e, #d97706, #fbbf24)',
        color: 'white',
        textAlign: 'center',
        padding: 24,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ fontSize: 48, marginBottom: 4 }}>🏆</div>
        <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.85, marginBottom: 4 }}>
          الجائزة الكبرى
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, marginBottom: 6 }}>
          {winner.name}
        </div>
        <div style={{ fontSize: 20, fontWeight: 900, opacity: 0.9 }}>
          {winner.points} نقطة
        </div>
      </div>

      {/* قائمة المؤسسات */}
      <div className="list">
        {standings.map((inst, idx) => (
          <div key={inst.id} className="card" style={{
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            background: idx === 0 ? '#fef3c7' : idx === 1 ? '#f1f5f9' : idx === 2 ? '#fff7ed' : 'white',
            borderColor: idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : idx === 2 ? '#fb923c' : 'var(--border)',
            borderWidth: idx < 3 ? 2 : 1,
          }}>
            <div style={{ fontSize: 28, minWidth: 40, textAlign: 'center' }}>
              {idx < 3 ? MEDALS[idx] : <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-muted)' }}>{idx + 1}</span>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 900 }}>{inst.name}</div>
            </div>
            <div style={{
              fontSize: 22, fontWeight: 900,
              color: idx === 0 ? '#92400e' : idx === 1 ? '#475569' : idx === 2 ? '#c2410c' : 'var(--primary)',
            }}>
              {inst.points}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── عرض الفئات ──
function CategoriesView({ categoryResults, selected, onSelect }) {
  const keys = CATEGORY_ORDER.flatMap(cat => ['male', 'female'].map(g => `${cat}_${g}`));
  const activeKeys = keys.filter(k => categoryResults[k]?.athletes?.length > 0);

  if (activeKeys.length === 0) {
    return (
      <div className="card text-center text-muted" style={{ padding: 32 }}>
        لا توجد نتائج فئات بعد
      </div>
    );
  }

  if (selected && categoryResults[selected]) {
    return (
      <CategoryDetail
        data={categoryResults[selected]}
        onBack={() => onSelect(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {activeKeys.map(key => {
        const cat = categoryResults[key];
        const top3 = cat.athletes.slice(0, 3);
        return (
          <div
            key={key}
            className="card"
            onClick={() => onSelect(key)}
            style={{ padding: 16, cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 17, fontWeight: 900 }}>{cat.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {cat.athletes.length} رياضي ‹
              </div>
            </div>
            {/* أفضل 3 */}
            <div className="flex flex-col gap-1">
              {top3.map((a, i) => (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 13,
                }}>
                  <span>{MEDALS[i]}</span>
                  <span style={{ flex: 1 }}>#{a.dossard} {a.name}</span>
                  <span style={{ fontWeight: 900, color: 'var(--primary)' }}>{a.total} نقطة</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {cat.hasQual && (
                <span style={{ fontSize: 11, background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>
                  التصفيات ✓
                </span>
              )}
              {cat.hasFin && (
                <span style={{ fontSize: 11, background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>
                  النهائيات ✓
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── تفاصيل فئة واحدة ──
function CategoryDetail({ data, onBack }) {
  return (
    <div>
      <button onClick={onBack} className="btn btn-outline mb-4" style={{ fontSize: 14, minHeight: 48 }}>
        → الرجوع
      </button>

      <div className="card mb-4" style={{
        background: 'var(--primary)', color: 'white',
        textAlign: 'center', padding: 16,
      }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>{data.label}</div>
        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
          {data.athletes.length} رياضي
        </div>
      </div>

      {/* رأس الجدول */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '40px 1fr 60px 60px 70px',
        gap: 4,
        padding: '6px 12px',
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--text-muted)',
        textAlign: 'center',
      }}>
        <div>#</div>
        <div style={{ textAlign: 'right' }}>الرياضي</div>
        <div>تصفيات</div>
        <div>نهائيات</div>
        <div>المجموع</div>
      </div>

      <div className="list">
        {data.athletes.map((a, idx) => {
          const isPodium = idx < 3;
          return (
            <div key={a.id} style={{
              display: 'grid',
              gridTemplateColumns: '40px 1fr 60px 60px 70px',
              gap: 4,
              padding: '12px',
              background: isPodium ? '#fef3c7' : idx % 2 === 0 ? 'white' : '#fafafa',
              borderBottom: '1px solid var(--border)',
              alignItems: 'center',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: isPodium ? 22 : 16, fontWeight: 900 }}>
                {isPodium ? MEDALS[idx] : idx + 1}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 900 }}>#{a.dossard}</span>
                  {' '}{a.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.institution}</div>
              </div>
              <div style={{ fontSize: 14, color: a.qualPoints > 0 ? 'var(--primary)' : 'var(--text-muted)', fontWeight: a.qualPoints > 0 ? 700 : 400 }}>
                {a.qualPoints > 0 ? a.qualPoints : '—'}
              </div>
              <div style={{ fontSize: 14, color: a.finPoints > 0 ? 'var(--primary)' : 'var(--text-muted)', fontWeight: a.finPoints > 0 ? 700 : 400 }}>
                {a.finPoints > 0 ? a.finPoints : '—'}
              </div>
              <div style={{ fontSize: 16, fontWeight: 900, color: isPodium ? '#92400e' : 'var(--primary)' }}>
                {a.total}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
