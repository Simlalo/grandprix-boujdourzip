import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const CATEGORY_LABELS = {
  katakit: { male: 'كتاكيت ذكور', female: 'كتاكيت إناث' },
  baraem: { male: 'براعم', female: 'برعمات' },
  sighar: { male: 'صغار', female: 'صغيرات' },
  fityan: { male: 'فتيان', female: 'فتيات' },
};

const EVENT_TITLE = 'الجائزة الكبرى للناشئين للعدو الريفي والسباق على الطريق';
const EVENT_SUBTITLE = 'بوجدور 2026 — الإقصائيات';

/**
 * DossardPrint
 * شاشة طباعة بطاقات الصدريات
 * - 4 بطاقات في ورقة A4 عمودي
 * - مرتبة بالصدرية تصاعدياً
 * - فلاتر اختيارية: مؤسسة، فئة
 */
export default function DossardPrint({ onBack }) {
  const [athletes, setAthletes] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterInstitution, setFilterInstitution] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [instResp, athResp] = await Promise.all([
      supabase.from('institutions').select('id, name').order('name'),
      supabase
        .from('athletes')
        .select('id, first_name, last_name, dossard_number, category, gender, institution:institutions(id, name)')
        .not('dossard_number', 'is', null)
        .order('dossard_number'),
    ]);
    setInstitutions(instResp.data || []);
    setAthletes(athResp.data || []);
    setLoading(false);
  }

  if (loading) {
    return <div className="loading"><div className="spinner"></div></div>;
  }

  // فلترة
  const filtered = athletes.filter((a) => {
    if (filterInstitution !== 'all' && a.institution?.id !== filterInstitution) return false;
    if (filterCategory !== 'all' && a.category !== filterCategory) return false;
    return true;
  });

  // تقسيم لصفحات 4 بطاقات
  const pages = [];
  for (let i = 0; i < filtered.length; i += 4) {
    pages.push(filtered.slice(i, i + 4));
  }

  return (
    <div>
      {/* CSS الطباعة */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }

        @media print {
          body, html {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .no-print { display: none !important; }
          .print-page {
            page-break-after: always;
            page-break-inside: avoid;
            margin: 0 !important;
          }
          .print-page:last-child {
            page-break-after: auto;
          }
        }

        .print-page {
          width: 210mm;
          height: 297mm;
          background: #d4d4d4;
          padding: 8mm;
          box-sizing: border-box;
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 0;
          position: relative;
          margin: 0 auto 20px auto;
          font-family: 'Cairo', 'Tajawal', system-ui, sans-serif;
        }

        .dossard-cell {
          position: relative;
          padding: 4mm;
          box-sizing: border-box;
          display: flex;
          align-items: stretch;
          justify-content: stretch;
        }

        .dossard-card {
          width: 100%;
          background: white;
          border: 1px solid #1f2937;
          padding: 6mm 5mm;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          text-align: center;
        }

        /* خطوط التقطيع المنقطة */
        .cut-line-h {
          position: absolute;
          left: 0;
          right: 0;
          top: 50%;
          border-top: 1px dashed #6b7280;
          pointer-events: none;
        }
        .cut-line-v {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 50%;
          border-left: 1px dashed #6b7280;
          pointer-events: none;
        }

        .dossard-header {
          font-size: 8pt;
          font-weight: 700;
          color: #1f2937;
          line-height: 1.4;
          padding-bottom: 3mm;
          border-bottom: 1px solid #9ca3af;
          margin-bottom: 0;
        }
        .dossard-subtitle {
          font-size: 7pt;
          color: #4b5563;
          margin-top: 1mm;
        }

        .dossard-number {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 130pt;
          font-weight: 900;
          color: #000;
          line-height: 0.9;
          letter-spacing: -3px;
          font-family: 'Inter', 'Arial Black', sans-serif;
          direction: ltr;
        }

        .dossard-category {
          font-size: 16pt;
          font-weight: 900;
          color: #1f2937;
          margin-bottom: 2mm;
          padding-top: 3mm;
          border-top: 1px solid #9ca3af;
        }

        .dossard-name {
          font-size: 12pt;
          font-weight: 700;
          color: #111827;
          margin-bottom: 1.5mm;
          line-height: 1.2;
        }

        .dossard-institution {
          font-size: 9pt;
          font-weight: 500;
          color: #4b5563;
          line-height: 1.2;
        }

        /* واجهة المعاينة */
        .preview-container {
          background: #e5e7eb;
          padding: 20px;
          min-height: 100vh;
        }

        .filters-bar {
          background: white;
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 16px;
          position: sticky;
          top: 0;
          z-index: 10;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
      `}</style>

      {/* شريط الفلاتر */}
      <div className="no-print filters-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          {onBack && (
            <button onClick={onBack} className="btn btn-outline" style={{ minHeight: 44 }}>
              → الرجوع
            </button>
          )}
          <div style={{ fontSize: 16, fontWeight: 900 }}>
            طباعة بطاقات الصدريات
          </div>
          <div style={{ marginRight: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>
            {filtered.length} بطاقة · {pages.length} ورقة A4
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>المؤسسة:</label>
          <select
            value={filterInstitution}
            onChange={(e) => setFilterInstitution(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}
          >
            <option value="all">الكل ({institutions.length})</option>
            {institutions.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>

          <label style={{ fontSize: 12, fontWeight: 700, marginRight: 8 }}>الفئة:</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13 }}
          >
            <option value="all">كل الفئات</option>
            <option value="katakit">كتاكيت</option>
            <option value="baraem">براعم</option>
            <option value="sighar">صغار</option>
            <option value="fityan">فتيان</option>
          </select>

          <button
            onClick={() => window.print()}
            className="btn btn-accent"
            style={{ marginRight: 'auto', minHeight: 44, fontWeight: 700 }}
            disabled={filtered.length === 0}
          >
            🖨 طباعة الكل ({pages.length} ورقة)
          </button>
        </div>
      </div>

      {/* المعاينة + الطباعة */}
      <div className="preview-container">
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, background: 'white', borderRadius: 8 }}>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              لا توجد بطاقات تطابق الفلاتر
            </div>
          </div>
        ) : (
          pages.map((pageAthletes, pageIdx) => (
            <DossardPage key={pageIdx} athletes={pageAthletes} />
          ))
        )}
      </div>
    </div>
  );
}

function DossardPage({ athletes }) {
  // ملء الخلايا بالـ4 بطاقات + خلايا فارغة إن لزم
  const cells = [...athletes];
  while (cells.length < 4) cells.push(null);

  return (
    <div className="print-page">
      {cells.map((athlete, idx) => (
        <div key={idx} className="dossard-cell">
          {athlete ? <DossardCard athlete={athlete} /> : <div className="dossard-card" style={{ background: '#f3f4f6' }}></div>}
        </div>
      ))}
      {/* خطوط التقطيع */}
      <div className="cut-line-h"></div>
      <div className="cut-line-v"></div>
    </div>
  );
}

function DossardCard({ athlete }) {
  const category = CATEGORY_LABELS[athlete.category]?.[athlete.gender] || '—';

  return (
    <div className="dossard-card">
      <div className="dossard-header">
        {EVENT_TITLE}
        <div className="dossard-subtitle">{EVENT_SUBTITLE}</div>
      </div>

      <div className="dossard-number">
        {athlete.dossard_number}
      </div>

      <div>
        <div className="dossard-category">
          {category}
        </div>
        <div className="dossard-name">
          {athlete.first_name} {athlete.last_name}
        </div>
        <div className="dossard-institution">
          {athlete.institution?.name || '—'}
        </div>
      </div>
    </div>
  );
}