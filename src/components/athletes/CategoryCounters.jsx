// src/components/athletes/CategoryCounters.jsx
import React, { useMemo } from 'react';
import { CATEGORIES, GENDERS, MAX_PER_CATEGORY } from '../../lib/categories';

/**
 * Displays an 8-cell grid showing athlete counts per (category × gender).
 * Color-coded:
 *   - green:  count < 8
 *   - amber:  count >= 8 and < MAX
 *   - red:    count >= MAX (full)
 *
 * Hidden when isFreeParticipants is true (no cap applies).
 *
 * Props:
 *   athletes: array of athlete records with .category and .gender
 *   isFreeParticipants: boolean
 */
export default function CategoryCounters({ athletes, isFreeParticipants }) {
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

  if (isFreeParticipants) return null;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 8,
        marginBottom: 16,
      }}
    >
      {CATEGORIES.map((cat) =>
        GENDERS.map((g) => {
          const key = `${cat.key}_${g.key}`;
          const count = counts[key];
          let bg = '#e8f5e9';
          let color = '#2e7d32';
          if (count >= MAX_PER_CATEGORY) {
            bg = '#ffebee';
            color = '#c62828';
          } else if (count >= 8) {
            bg = '#fff8e1';
            color = '#f57c00';
          }
          return (
            <div
              key={key}
              style={{
                background: bg,
                color,
                padding: '10px 8px',
                borderRadius: 'var(--radius)',
                textAlign: 'center',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <div>
                {cat.label} {g.label}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>
                {count}/{MAX_PER_CATEGORY}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
