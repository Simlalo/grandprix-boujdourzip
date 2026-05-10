// src/lib/categories.js
// Shared constants and utilities for categories and genders

export const CATEGORIES = [
  { key: 'katakit', label: 'كتاكيت', years: '2015-2016' },
  { key: 'baraem', label: 'براعم', years: '2013-2014' },
  { key: 'sighar', label: 'صغار', years: '2011-2012' },
  { key: 'fityan', label: 'فتيان', years: '2009-2010' },
];

export const GENDERS = [
  { key: 'male', label: 'ذكور' },
  { key: 'female', label: 'إناث' },
];

export const CATEGORY_LABEL = {
  katakit: 'كتاكيت',
  baraem: 'براعم',
  sighar: 'صغار',
  fityan: 'فتيان',
};

export const GENDER_LABEL = {
  male: 'ذكور',
  female: 'إناث',
};

// Maximum athletes per (category, gender) per institution.
// Excluded for institutions with is_free_participants = true.
export const MAX_PER_CATEGORY = 10;

/**
 * Compute category from a birth date.
 * @param {string|Date} birthDate
 * @returns {'katakit'|'baraem'|'sighar'|'fityan'|null}
 */
export function computeCategory(birthDate) {
  if (!birthDate) return null;
  const year = new Date(birthDate).getFullYear();
  if (year === 2015 || year === 2016) return 'katakit';
  if (year === 2013 || year === 2014) return 'baraem';
  if (year === 2011 || year === 2012) return 'sighar';
  if (year === 2009 || year === 2010) return 'fityan';
  return null;
}

/**
 * Get a readable label for a (category, gender) pair.
 * Example: getCategoryGenderLabel('baraem', 'male') → 'براعم ذكور'
 */
export function getCategoryGenderLabel(category, gender) {
  const cat = CATEGORY_LABEL[category] || category;
  const gen = GENDER_LABEL[gender] || gender;
  return `${cat} ${gen}`;
}
