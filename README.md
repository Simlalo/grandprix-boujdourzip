# 🏃 الجائزة الكبرى — بوجدور 2026

تطبيق تسجيل المشاركين في الجائزة الكبرى للعدو الريفي والسباق على الطريق.

## التشغيل

```bash
npm install
npm run dev
```

## التقنيات

- React + Vite
- Supabase (قاعدة البيانات والمصادقة)
- React Router

## البنية

- `src/App.jsx` — التوجيه والصلاحيات
- `src/pages/Login.jsx` — تسجيل الدخول
- `src/pages/InstitutionDashboard.jsx` — واجهة المؤسسات
- `src/pages/CommitteeDashboard.jsx` — لوحة اللجنة
- `src/supabase.js` — إعدادات Supabase
