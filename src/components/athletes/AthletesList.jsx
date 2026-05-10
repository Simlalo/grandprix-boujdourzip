// src/components/athletes/AthletesList.jsx
import React, { useMemo, useState } from 'react';
import {
  CATEGORIES,
  GENDERS,
  CATEGORY_LABEL,
  GENDER_LABEL,
} from '../../lib/categories';

/**
 * Renders the athletes list with a search bar and category filter chips.
 * Pure presentational component: parent controls the data and provides callbacks.
 *
 * Props:
 *   athletes:    array of athlete records
 *   onDelete:    (athlete) => void              — called when delete is clicked
 *   onSetDossard: (athlete) => void             — called when "+ إضافة" (dossard) is clicked
 *   canEdit:     boolean                        — when false, hides delete/edit actions
 *
 * If you don't want the dossard action, omit `onSetDossard`.
 */
export default function AthletesList({
  athletes,
  onDelete,
  onSetDossard,
  canEdit = true,
}) {
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Counts per (category × gender) — used in chip labels
  const counts = useMemo(() => {
    const c = {};
    CATEGORIES.forEach((cat) => {
      GENDERS.forEach((g) => {
        c[`${cat.key}_${g.key}`] = 0;
      });
    });
    (athletes || []).forEach((a) => {
      const key = `${a.category}_${a.gender}`;
      if (c[key] !== undefined) c[key]++;
    });
    return c;
  }, [athletes]);

  const filteredAthletes = useMemo(() => {
    let filtered = athletes || [];

    if (filterCategory !== 'all') {
      const [cat, gen] = filterCategory.split('_');
      filtered = filtered.filter((a) => a.category === cat && a.gender === gen);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((a) => {
        const fullName = `${a.first_name || ''} ${a.last_name || ''}`.toLowerCase();
        const dossard = String(a.dossard_number || '');
        return fullName.includes(q) || dossard.includes(q);
      });
    }

    return filtered;
  }, [athletes, filterCategory, searchQuery]);

  // Empty state — no athletes registered at all
  if (!athletes || athletes.length === 0) {
    return (
      <div
        style={{
          background: 'white',
          padding: 32,
          borderRadius: 'var(--radius)',
          textAlign: 'center',
          color: '#666',
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>🏃</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>
          لم تُسجّل أي رياضي بعد
        </div>
        <div style={{ fontSize: 13, marginTop: 4 }}>ابدأ بإضافة أول رياضي</div>
      </div>
    );
  }

  return (
    <>
      {/* Search bar */}
      <div style={{ marginBottom: 12 }}>
        <input
          type="text"
          placeholder="🔍 بحث بالاسم أو رقم الصدرية..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: 12,
            fontSize: 15,
            borderRadius: 'var(--radius)',
            border: '2px solid #ddd',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Category filter chips */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          paddingBottom: 8,
          marginBottom: 12,
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <button
          onClick={() => setFilterCategory('all')}
          style={{
            padding: '8px 14px',
            border:
              filterCategory === 'all'
                ? '2px solid var(--accent)'
                : '2px solid #ddd',
            background: filterCategory === 'all' ? 'var(--accent)' : 'white',
            color: filterCategory === 'all' ? 'white' : '#333',
            fontWeight: 600,
            borderRadius: '999px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            fontFamily: 'inherit',
            fontSize: 13,
          }}
        >
          الكل ({athletes.length})
        </button>
        {CATEGORIES.map((cat) =>
          GENDERS.map((g) => {
            const key = `${cat.key}_${g.key}`;
            const count = counts[key];
            if (count === 0) return null;
            const active = filterCategory === key;
            return (
              <button
                key={key}
                onClick={() => setFilterCategory(key)}
                style={{
                  padding: '8px 14px',
                  border: active ? '2px solid var(--accent)' : '2px solid #ddd',
                  background: active ? 'var(--accent)' : 'white',
                  color: active ? 'white' : '#333',
                  fontWeight: 600,
                  borderRadius: '999px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontFamily: 'inherit',
                  fontSize: 13,
                }}
              >
                {cat.label} {g.label} ({count})
              </button>
            );
          })
        )}
      </div>

      {/* Filtered list */}
      {filteredAthletes.length === 0 ? (
        <div
          style={{
            background: 'white',
            padding: 24,
            borderRadius: 'var(--radius)',
            textAlign: 'center',
            color: '#666',
            fontSize: 14,
          }}
        >
          لا نتائج تطابق البحث
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {filteredAthletes.map((a) => (
            <div
              key={a.id}
              style={{
                background: 'white',
                padding: 12,
                borderRadius: 'var(--radius)',
                border: '1px solid #eee',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: a.dossard_number || onSetDossard ? 8 : 0,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                    {a.first_name} {a.last_name}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                      fontSize: 12,
                      color: '#666',
                    }}
                  >
                    <span
                      style={{
                        background: '#f0f0f0',
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontWeight: 600,
                      }}
                    >
                      {CATEGORY_LABEL[a.category]} {GENDER_LABEL[a.gender]}
                    </span>
                    {a.birth_date && (
                      <span>{new Date(a.birth_date).getFullYear()}</span>
                    )}
                  </div>
                </div>
                {canEdit && onDelete && (
                  <button
                    onClick={() => onDelete(a)}
                    className="btn btn-outline"
                    style={{
                      padding: '8px 12px',
                      fontSize: 12,
                      color: '#c00',
                      borderColor: '#fcc',
                      minHeight: 'auto',
                    }}
                    title="حذف"
                  >
                    🗑️
                  </button>
                )}
              </div>

              {/* Dossard row — keeps existing UI */}
              {(a.dossard_number || (canEdit && onSetDossard)) && (
                <div
                  style={{
                    borderTop: '1px dashed #eee',
                    paddingTop: 8,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 13,
                    color: '#666',
                  }}
                >
                  <span>
                    رقم الصدرية:{' '}
                    {a.dossard_number ? (
                      <span
                        style={{
                          background: 'var(--accent)',
                          color: 'white',
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontWeight: 700,
                        }}
                      >
                        #{a.dossard_number}
                      </span>
                    ) : (
                      <span style={{ color: '#999' }}>غير محدد</span>
                    )}
                  </span>
                  {canEdit && onSetDossard && (
                    <button
                      onClick={() => onSetDossard(a)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--accent)',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: 13,
                      }}
                    >
                      + إضافة
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}