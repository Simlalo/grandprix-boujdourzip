# 📦 ملف الانتقال — مشروع الجائزة الكبرى للعدو الريفي بوجدور 2026

> **تاريخ هذه الجلسة:** 12 ماي 2026  
> **حالة المشروع:** متقدم — نظام الميقاتي وخط الوصول مكتمل ومحكم  
> **التواريخ الحرجة:** التصفيات 17 ماي 2026 · النهائيات 24 ماي 2026

---

## 🎯 ما هذا المشروع؟

تطبيق ويب لإدارة سباق "الجائزة الكبرى للعدو الريفي والسباق على الطريق" في بوجدور، المغرب.

- **التواريخ:** التصفيات يوم 17 ماي 2026، النهائيات يوم 24 ماي 2026
- **المُستخدمون:** اللجنة المنظمة (الجمعية المغربية للجاكوار)، المؤسسات (مدارس، نوادي)، الجمهور (عرض النتائج)
- **التقنيات:** React + Vite + Supabase (PostgreSQL + Auth + Realtime + RLS)
- **العمل:** محلياً بـ VSCode (مع git إلى Replit للنشر)
- **اللغة:** عربية في الواجهة والنقاش، الكود بالإنجليزية، رسائل DB بالإنجليزية (لتجنب مشكلة BiDi في محرر Supabase SQL)

---

## 🧭 منهجية العمل المتفق عليها (التزم بها بدقة)

### قواعد الذاكرة المحفوظة (لا تنساها)

1. **بداية أي جلسة:** اسأل عن الغرض والسياق قبل التنفيذ. عند تطبيق منطق تجاري، اعرض الصيغة قبل البناء. عند تحديث الكود، أعطِ الملف كاملاً قابلاً للنسخ. العمل بـ VSCode محلياً.

2. **أخطاء tooling/linter/IDE:** اسأل أولاً "هل التطبيق يعمل ويُبنى بنجاح؟". صنّف (حرجة vs زخرفية). اقترح الأقصر (تعطيل/تجاهل) قبل إضافة dependencies.

3. **التموضع المكاني للمعلومة:** أي معلومة موجّهة للمستخدم (خطأ، تحذير، نجاح) توضع حيث سينظر لحظة ظهورها — قرب الفعل المرتبط. وضعها بعيداً = إخفاؤها.

4. **بناء ميزة على نظام قائم:** الخطوة الأولى دائماً قراءة البنية الموجودة (schema، config، الكود ذو الصلة) قبل أي سؤال تصميمي. **الاستكشاف قبل التصميم.**

5. **حلّ الواقع بالواقع:** قبل بناء حل برمجي لمشكلة في نظام يتفاعل مع العالم الحقيقي، اسأل كيف تُحلّ بدون تكنولوجيا. كثيراً ما الحل خارج التطبيق (إجراء ميداني، أداة فيزيائية، صلاحية بشرية موجودة) لا داخله.

6. **خمسة "لماذا":** لا تقفز للحل بعد أول "ماذا". لماذا نحتاج هذا، لماذا بهذه الطريقة، كيف يُحلّ في الواقع، ماذا لو فعلنا غير ذلك. كل سؤال يحفر طبقة.

7. **التعقيد المُتخيَّل أخطر من البساطة المرئية:** "هذا قد يحدث" ≠ "يجب أن أحلّه برمجياً". بعض الحالات الحدّية لا تحدث، بعضها يُحلّ خارج البرنامج، بعضها يُحلّ بصلاحيات بشرية موجودة.

8. **احذر الادعاء الزائف:** التنظيم البصري (جدول، قائمة) لا يثبت الصحة. قبل ادعاء "هذا يحلّ كل شيء"، قم بمحاكاة فعلية للسيناريو الواقعي خطوة بخطوة.

9. **التصحيحات المتعددة = خلل في الإطار:** إذا صحّحني المستخدم مرتين على نفس النقطة، الخلل في فهمي للإطار لا في صياغتي. توقّف، أعد سؤال الإطار من الصفر، لا تُعدّل الفروع.

### بروتوكول العمل التقني

- **DB أولاً:** كل تغيير معماري يبدأ من Supabase (SQL → اختبار → كود)
- **التحقق قبل البناء:** اقرأ schema الجداول والـ policies قبل أي كود يلمسها
- **محاكاة بشرية:** قبل ادعاء "هذا يحل المشكلة"، تخيّل السيناريو خطوة بخطوة
- **الأمن قبل السرعة:** RLS مفعّل دائماً، RPC functions بـ SECURITY DEFINER للعمليات الحساسة
- **رسائل DB بالإنجليزية:** محرر Supabase SQL يفشل أحياناً مع النصوص العربية بسبب BiDi markers

---

## 🗂️ بنية المشروع الحالية

```
grandprix-boujdour/
├── .vscode/
│   └── settings.json          ← { "eslint.enable": false } ← مهم
├── src/
│   ├── App.jsx                ← توجيه الأدوار
│   ├── main.jsx
│   ├── supabase.js
│   ├── hooks/
│   │   └── useUserType.js
│   ├── lib/
│   │   ├── categories.js      ← فئات + ENUMs ثوابت
│   │   └── offlineQueue.js    ← IndexedDB wrapper (للميقاتي + خط الوصول)
│   ├── components/
│   │   ├── athletes/
│   │   │   ├── AthletesList.jsx
│   │   │   └── CategoryCounters.jsx
│   │   └── ...
│   └── pages/
│       ├── Login.jsx
│       ├── InstitutionDashboard.jsx        ← + منع السقف 10
│       ├── CommitteeDashboard.jsx
│       ├── CallRoomPanel.jsx               ← لـ call_room (نداء + خط انطلاق)
│       ├── FinishLinePanel.jsx             ← لـ finish_judge (إدخال + تحقق)
│       ├── TimekeeperPanel.jsx             ← لـ timekeeper (عداد + وصول)
│       ├── RaceDayPanel.jsx                ← قديم — يحتاج إعادة هيكلة للاعتماد
│       ├── FinalResultsPanel.jsx           ← قديم — يحتاج إصلاح نقاط الترتيب
│       └── PublicResults.jsx               ← أولي — يحتاج اكتمال
```

---

## 💾 بنية قاعدة البيانات (Supabase)

### الجداول الرئيسية

**`institutions`** — المؤسسات المسجَّلة
- `id`, `name`, `responsible_name`, `phone`, `email`
- `predefined_id` (يربط بـ `predefined_educational_institutions`)
- `is_free_participants` — معسكر "مشاركون أحرار" (لا سقف 10)
- `list_status` ENUM: `draft | submitted | approved | rejected`
- `rejection_reason`, `submitted_at`

**`predefined_educational_institutions`** — المؤسسات التعليمية المعرَّفة مسبقاً

**`athletes`** — الرياضيون
- `institution_id`, `first_name`, `last_name`, `gender`, `birth_date`
- `category` ENUM (محسوبة من birth_date)
- `dossard_number` (رقم الصدرية، فريد لكل category × gender)
- `massar_code`, `school_level`

**`races`** — السباقات (16 سباقاً)
- `category`, `gender`, `stage` ('qualifying' | 'final')
- `distance_meters`, `scheduled_at`
- **`status`** ENUM: `pending | running | finished | approved` ← **مفتاح كل النظام**
- `started_at` (timestamp عند البدء)
- `is_completed` (قديم — يبقى للتوافق مع views)

**`attendance`** — حضور الرياضيين (يديره call_room)
- `athlete_id`, `race_id`
- `call_room_at`, `call_room_by` (تسجيل في غرفة النداء)
- `start_line_at`, `start_line_by` (عبور خط الانطلاق)

**`race_timings`** — تواقيت الميقاتي
- `race_id`, `position`, `finish_time_ms`
- `client_id` (text، فريد عالمياً — للـ idempotency)
- `recorded_by`, `is_synced`

**`race_finish_orders`** — صدريات حكم خط الوصول
- `race_id`, `position`, `dossard_number`
- `client_id`, `is_synced`
- `issues` (text[]) — قائمة المشاكل المكتشفة آلياً
- `last_modified_by`, `last_modified_at` (للتعديلات في وضع التحقق)

**`results`** — النتائج المعتمدة (الحالية لكن منطقها يحتاج إعادة)
- `athlete_id`, `race_id`, `rank`, `points`, `qualified_to_final`
- `finish_time_ms` (مُضاف حديثاً)
- `recorded_at`, `recorded_by`

**`committee_members`** — أعضاء اللجنة
- `auth_user_id`, `full_name`, `role`

**Views:**
- `race_rankings` — VIEW محسوبة من `results`
- `institution_standings` — VIEW محسوبة لترتيب المؤسسات

### ENUMs

- `race_stage`: `qualifying | final`
- `race_status`: `pending | running | finished | approved` ← **جديد في هذه الجلسة**
- `gender`: `male | female`
- `category`: `katakit | baraem | sighar | fityan`
- `list_status`: `draft | submitted | approved | rejected`
- `institution_type`: ...
- `committee_role`: `super_admin | admin | data_entry | viewer | call_room | finish_judge | timekeeper`

### RPC Functions الحاسمة (جميعها `SECURITY DEFINER`)

```
start_race(p_race_id) → (started_at, status)
  - idempotent: لو السباق running أصلاً، يُرجع البيانات الموجودة
  - يرفض لو finished/approved
  - يضع status = 'running' + started_at = now()

record_arrival(p_race_id, p_finish_time_ms, p_client_id, p_recorded_by)
                → (assigned_position, is_new)
  - idempotent عبر client_id: ضغطة مكررة تُرجع نفس المرتبة
  - يتحقق أن status = 'running'
  - يستخدم LOCK لمنع التعارض المتزامن
  - يحسب MAX(position)+1 ذرياً

finish_race(p_race_id) → (status)
  - idempotent
  - يضع status = 'finished'
  - يرفض إن كان pending (لم يبدأ)

reset_race(p_race_id) → (status)
  - ذري كلياً في transaction واحدة
  - يمسح race_timings + race_finish_orders + يعيد status = 'pending'
  - يرفض إن كان approved
```

### RLS Policies (المهمة)

**`races`:**
- `admin_manage_races` — admin/super_admin: ALL
- `everyone_read_races` — الجميع: SELECT

**`race_timings`:**
- `everyone_read_timings` — الجميع: SELECT
- `timekeeper_write_timings` — timekeeper/admin/super_admin: ALL

**`race_finish_orders`:**
- `everyone_read_finish_orders` — الجميع: SELECT
- `finish_judge_write_orders` — finish_judge/admin/super_admin: ALL

### السباقات (التوقيتات بـ UTC، +1 = توقيت المغرب)

16 سباقاً جاهزاً (8 تصفيات + 8 نهائي). كل سباق له:
- category × gender × stage
- distance_meters (بحسب الفئة والمسافة)
- scheduled_at

---

## 👥 الحسابات الإنتاجية الحالية

**super_admin:** `simlalo` (المستخدم)

**الأدوار التشغيلية ميدانياً** — تظهر شاشاتها المخصصة:
- `call_room` → `CallRoomPanel` (نداء + خط انطلاق)
- `finish_judge` → `FinishLinePanel` (إدخال + تحقق صدريات الوصول)
- `timekeeper` → `TimekeeperPanel` (عداد + تسجيل تواقيت الوصول)

**حسابات اختبار موجودة:**
- `results1@grandprix.com` — حُوّل إلى `finish_judge` (كان `data_entry`)
- `timekeeper1@grandprix.com` — `timekeeper`

---

## ✅ ما أُنجز في هذه الجلسة (12 ماي 2026)

### في DB

**حقول جديدة:**
- `races.status` (race_status ENUM) — أساس النظام الجديد
- `races.started_at` (timestamptz) — مرجع التواقيت
- `race_timings.finish_time_ms` (مُضاف في بداية الجلسة)
- `race_timings.client_id` + `is_synced`
- `race_finish_orders` (جدول جديد كامل)
- `race_finish_orders.issues` (text[])
- `race_finish_orders.last_modified_by` + `last_modified_at`

**ENUMs جديدة:**
- `race_status`
- `finish_judge` + `timekeeper` أضيفا إلى `committee_role`

**RPC Functions:**
- `start_race`، `record_arrival`، `finish_race`، `reset_race` — كلها idempotent، آمنة، ذرية

**RLS Policies جديدة:**
- لـ `race_timings`: قراءة عامة + كتابة timekeeper
- لـ `race_finish_orders`: قراءة عامة + كتابة finish_judge

### في الكود

**ملفات جديدة:**
- `src/lib/offlineQueue.js` — IndexedDB wrapper نظيف بدون dependencies
- `src/pages/FinishLinePanel.jsx` — واجهة حكم خط الوصول (إدخال + تحقق)
- `src/pages/TimekeeperPanel.jsx` — واجهة الميقاتي (عداد + وصول)

**ملفات معدّلة:**
- `src/App.jsx` — توجيه `finish_judge` و `timekeeper` لشاشتيهما
- `src/pages/InstitutionDashboard.jsx`:
  - استخدام `<CategoryCounters>` و `<AthletesList>`
  - **منع تجاوز سقف 10 رياضيين/فئة** (لغير `is_free_participants`)
  - رسالة الخطأ نُقلت قرب زر "إضافة الرياضي" (لا في أعلى الـ form)

**إعدادات:**
- `.vscode/settings.json` — `{ "eslint.enable": false }` (تجنب ضوضاء ESLint)

### قرارات معمارية حاسمة

1. **حالة السباق صريحة في DB** (`status` ENUM) — لا استنتاجات من تفرّع حقول
2. **`client_id` idempotency** — إعادة المحاولة بسبب الشبكة لا تخلق تكراراً
3. **RPC functions ذرية** — كل عملية حرجة تُنجَز كاملةً أو لا تُنجَز
4. **DB مصدر الحقيقة الوحيد** — الواجهة مرآة، realtime + polling احتياطي
5. **IndexedDB للحماية اللحظية فقط** (انقطاع ثوانٍ) — لا للمزامنة المعقدة
6. **الاحتياط للميقاتي = ساعة فيزيائية + ميقاتي ثانٍ بشري** (ليس جهازاً رقمياً ثانياً). اللجنة تدخل تواقيت الاحتياط يدوياً لاحقاً إن فشل التطبيق

### اختبارات ناجحة في هذه الجلسة

- ✓ منع سقف 10 يعمل في `InstitutionDashboard`
- ✓ `FinishLinePanel`: التعرف على الصدريات، رفض من لم يعبر خط الانطلاق
- ✓ `TimekeeperPanel`: العداد يعمل، الإشعار العائم، الاهتزاز، التحديث يستأنف
- ✓ تعطيل ESLint extension حلّ ضوضاء التحرير

### اختبارات لم تكتمل بعد

- ⏭ سيناريو إعادة الضبط الكامل بعد التحديثات الأخيرة
- ⏭ idempotency في `record_arrival` بإعادة محاولة فعلية
- ⏭ `finish_race` ثم محاولة إدخال تواقيت جديدة (يجب أن يفشل)
- ⏭ خط الوصول + الميقاتي على جهازين متزامنين

---

## 🎯 المهمة الحالية (آخر ما عملنا عليه)

**نظام الميقاتي وخط الوصول الإصدار النهائي** — مكتمل في الكود لكن **لم يُختبر شاملاً بعد**.

التغييرات الأخيرة لم تُختبر فعلياً:
- نظام `status` الجديد في الواجهتين
- idempotency في record_arrival
- reset_race الذرية الجديدة
- finish_race + شاشة "السباق منتهٍ"

**أول مهمة في الجلسة الجديدة: اختبار شامل لهذه السيناريوهات.**

---

## 📋 المهام المتبقية بترتيب الأولوية

### 🔴 الآن (الجلسة الجديدة)

1. **اختبار سيناريوهات Timekeeper + Finish Line الشاملة:**
   - تدفق طبيعي: بدء → وصول × 5 → تحديث → استئناف ✓
   - إعادة ضبط: تمسح كل شيء فعلاً ولا تترك تواقيت قديمة
   - إنهاء: status = 'finished' يمنع إدخالات جديدة في الواجهتين
   - idempotency: انقطاع وعودة → لا تكرار
   - تطابق الجهازين (timekeeper مفتوح في جهازين)

2. **إعادة هيكلة `RaceDayPanel`** ليصبح **شاشة اعتماد اللجنة** (لا إدخال نتائج):
   - يعرض جدولاً مزدوجاً: تواقيت الميقاتي + صدريات خط الوصول، جنباً إلى جنب
   - الربط الآلي بالمرتبة: المرتبة N من خط الوصول + التوقيت N من الميقاتي + الرياضي صاحب الصدرية
   - DNF تلقائي = `attendance.start_line_at` ناقص الواصلين
   - صلاحيات اللجنة الكاملة: إضافة منسي، إعادة ترتيب، تعديل، حذف
   - زر "اعتماد" → ينقل البيانات إلى `results` + يضع `status = 'approved'`

3. **اكتمال شاشة `PublicResults`:**
   - متاحة للجميع بدون تسجيل دخول
   - تعرض حسب حالة السباقات:
     - بعد التصفيات (17 ماي): 8 ترتيبات فردية + 8 ترتيبات جماعية
     - بعد النهائيات (24 ماي): + 8 ترتيبات النهائي + الجائزة الكبرى
   - مشاركة بـ QR في `CommitteeDashboard`

### 🟠 قريباً (قبل 17 ماي)

4. **تصحيح نظام النقاط:**
   - الترتيب الفردي (الجائزة الكبرى): 10→1، **التصفيات + النهائي**
   - الترتيب الجماعي: 20→1، **التصفيات فقط**، شرط 4 رياضيين على الأقل في المراتب 1-20
   - التأهل للنهائي: **30** من كل تصفيات (ليس 40 — `FinalResultsPanel` فيها خطأ حالياً يستخدم 40)

5. **PDF export** للنتائج الرسمية

6. **واجهة super_admin لإضافة timekeeper/finish_judge** (حالياً يدوياً عبر SQL)

### 🟡 لاحقاً (إن أمكن)

7. **اختبار صلاحيات RLS فعلياً** بإجراء DELETE من حساب timekeeper
8. **مراقبة سجلات `recorded_by` و `last_modified_by`** للتدقيق
9. **زر "نسخ احتياطي" للأدمن** قبل السباق

### 🔵 مؤجل (ما بعد السباق)

- التداخل بين سباقين متزامنين (افترضنا عدم التداخل لتبسيط)
- ميقاتيان رقميان متوازيان (نستخدم ساعة فيزيائية حالياً)
- شاشة "إدخال يدوي للتواقيت" في لوحة اللجنة (لو فشل الميقاتي الرقمي يوم السباق)

---

## 🚨 قرارات حاسمة ثبتت في هذه الجلسة

### القرار 1: حالة السباق صريحة في DB

`status` ENUM في `races` هو المصدر الوحيد للحقيقة. لا تستنتج من `started_at` أو `is_completed` — اقرأ `status` مباشرة.

### القرار 2: RPC ذرية لكل عملية حرجة

- `start_race`، `record_arrival`، `finish_race`، `reset_race`
- كل واحدة `SECURITY DEFINER` + idempotent + تتحقق من الصلاحية
- **رسائل الخطأ بالإنجليزية** (محرر Supabase SQL يفشل مع العربية بسبب BiDi)

### القرار 3: الاحتياط للسباق غير رقمي

ميقاتي 2 لديه ساعة سباقات فيزيائية. لا يستخدم التطبيق. لو فشل التطبيق، اللجنة تدخل تواقيته يدوياً بعد السباق. **هذا قرار معماري لا برمجي** — يبسّط كل شيء.

### القرار 4: التداخل بين السباقات مُؤجَّل

قرار للتبسيط فقط. في الواقع قد يحدث تداخل (سباق قصير ينتهي بينما التالي يبدأ). إن ظهرت المشكلة يوم 17 ماي، نعالجها بسرعة. الحل المرجّح: تبويبان "السباق الحالي" + "متأخرون".

### القرار 5: IndexedDB للحماية اللحظية فقط

ليس للمزامنة طويلة الأمد. الانقطاعات المتوقعة ثوانٍ، لا دقائق. كل ضغطة تُحفظ محلياً فوراً ثم تحاول الـ RPC. `client_id` يمنع التكرار.

### القرار 6: الجهازان (لو فُتح نفس الحساب على جهازين)

كل جهاز يقرأ DB عبر realtime. كل ضغطة تستدعي RPC مستقلة. `record_arrival` تستخدم LOCK لمنع التعارض. الجهازان يكملان بعضهما بسلاسة.

---

## ⚠️ تحذيرات تقنية مهمة

### 1. محرر Supabase SQL يفشل مع النصوص العربية

عند نسخ SQL يحتوي عربية، تدخل أحياناً حروف خفية (BiDi markers) تُفسد `$$` الـ dollar-quoted. **الحل:** كل رسائل الخطأ في RPC بالإنجليزية. الواجهة تعرض رسائلها العربية بنفسها.

### 2. ESLint extension معطّل في `.vscode/settings.json`

```json
{ "eslint.enable": false }
```

لا تُفعّله إلا إن قرر المستخدم تثبيت ESLint بشكل جدي (غير مثبت حالياً).

### 3. RLS مفعّل على كل الجداول الحساسة

- `races` — admin/super_admin يكتب، الجميع يقرأ
- `race_timings` — timekeeper/admin/super_admin يكتب
- `race_finish_orders` — finish_judge/admin/super_admin يكتب

العمليات الحرجة تمر عبر RPC `SECURITY DEFINER` لتجاوز RLS بأمان.

### 4. `is_completed` لم يُحذف من `races`

يبقى للتوافق مع `race_rankings` view و `institution_standings` view. لكن **`status` هو الذي يحدد سلوك الواجهات الجديدة**.

### 5. التواقيت بـ UTC

كل `timestamptz` في DB بـ UTC. في المغرب +1 (أو +0 في بعض المواسم — UTC مرجع آمن).

### 6. Realtime listeners + polling احتياطي

`TimekeeperPanel` و `FinishLinePanel` يستخدمان realtime على `races`, `attendance`, `race_timings/race_finish_orders`. **+ polling كل 30 ثانية** كحماية لو فشل realtime.

### 7. التذكير الذي قد ينساه Claude

- لا تقترح "حلول برمجية" قبل التحقق من schema موجود
- إذا صحّحه المستخدم مرتين على نفس النقطة، أعد سؤال الإطار من الصفر
- استخدم محاكاة فعلية للسيناريوهات قبل ادعاء "هذا يحل المشكلة"

---

## 📞 للجلسة الجديدة — البدء

### إذا تابعتَ من هذه النقطة:

**أول رسالة من المستخدم محتملة:**
- "أكمل من حيث توقفنا" → اقرأ هذا الملف، اسأل عن نتائج اختبار TimekeeperPanel + FinishLinePanel
- "هناك مشكلة في X" → اطلب screenshot/تفاصيل، استخدم القاعدة 4 (الاستكشاف قبل التصميم)
- "ابدأ المهمة التالية" → اقترح RaceDayPanel ← شاشة الاعتماد

### ملفات لازمة في الجلسة الجديدة (قد يحتاج المستخدم رفعها)

- `App.jsx` — للتأكد من توجيه الأدوار
- `TimekeeperPanel.jsx` — النسخة الحالية
- `FinishLinePanel.jsx` — النسخة الحالية  
- `RaceDayPanel.jsx` — للهيكلة (إعادة بناء)
- `FinalResultsPanel.jsx` — لتصحيح نقاط 20→1 + التأهل 30
- `useUserType.js` — للتأكد من قراءة الدور
- `offlineQueue.js` — للمرجع

### أسلوب التعامل

- العربية في النقاش والشرح
- الكود بالإنجليزية، رسائل المستخدم النهائية بالعربية
- ملف md لكل ميزة كبيرة قبل البناء
- اعرض الصيغة قبل البناء، الملف كاملاً عند التحديث
- لا تتعجّل: استكشف، اسأل، تأكد، ثم نفّذ
- استخدم قواعد الذاكرة المحفوظة — هي خلاصة جلسات

---

## 🎓 دروس مستفادة من هذه الجلسة (مهم لتجنّب التكرار)

### درس 1: التعقيد المتخيّل خدعة

استثمرت ساعات في بناء IndexedDB + مزامنة معقدة + معالجة تعارض جهازين رقميين، **والحل كان "ساعة فيزيائية بيد ميقاتي ثانٍ"**. كان يجب أن أسأل أولاً: "كيف تُحلّ هذه المشكلة في السباقات بدون تكنولوجيا؟". القاعدة 5 تعالج هذا.

### درس 2: استكشف schema قبل التصميم

سألت "كيف تُسجَّل النتائج؟" قبل أن أرى أن `results` و `race_rankings` موجودان كـ VIEW محسوبة. لو بدأت بـ `SELECT * FROM information_schema.tables` لاختصرت 6-7 رسائل. القاعدة 4.

### درس 3: التصحيحات المتعددة = إعادة فهم الإطار

صحّحني المستخدم 3 مرات في موضوع اللجنة والتواقيت قبل أن أفهم أن "اللجنة لا تربط التواقيت، النظام يربطها آلياً". كان يجب التوقف بعد التصحيح الثاني وإعادة سؤال الإطار من الصفر. القاعدة 9.

### درس 4: محرر Supabase + العربية = مشاكل خفية

نص عربي داخل `RAISE EXCEPTION` يُفسد `$$` في PostgreSQL function. الأعراض غير واضحة (`unterminated dollar-quoted string`). الحل: رسائل الـ RPC بالإنجليزية. الواجهة تترجم.

### درس 5: الادعاء الزائف بحل كل المشاكل

عرضت "جدولاً جميلاً" يبيّن كيف يحلّ التصميم 10 مشاكل، ثم بمحاكاة بسيطة لـ 5 دقائق اكتشفنا أنه لا يحلّ معظمها. التنظيم البصري ≠ الصحة المنطقية. القاعدة 8.

### درس 6: الحلول البسيطة لا تأتي من الحلول البرمجية المعقدة

"عاد التطبيق إلى الصفر بعد التحديث" — حلّيتُها أولاً بـ localStorage، ثم أعمق بـ DB column. لكن الحل الجذري كان: **`status` ENUM صريح يمثل الحقيقة الوحيدة**. كل ما عداه ينبثق منه.

### درس 7: RLS مفعّل بدون policies = فشل صامت

عند إنشاء جدول مع `ENABLE ROW LEVEL SECURITY` بدون policies، كل INSERT/UPDATE/DELETE يفشل **بصمت**. لا خطأ ظاهر، البيانات لا تُحفظ. **دائماً اختبر فعلياً (SELECT count بعد INSERT)**، لا تثق بـ "نجح" في الواجهة.

---

## 📌 ملاحظة أخيرة للمستخدم

**simlalo** عمل أساسي على الميتد التحليلي العميق:
- يميّز جيداً بين "حل سطحي" و"حل جذري"
- يسأل "فكر في التفكير" بانتظام — استجب بصدق، اعترف بالأخطاء
- يكره الادعاءات الزائفة — لا تقل "هذا يحلّ كل شيء" دون محاكاة فعلية
- يقدّر التوقف وإعادة التقييم — لا تتعجّل
- يتعلم من كل جلسة ويبني قواعد عامة — احفظ القواعد المستخلصة

**التوقيت الحرج:** 17 ماي = 5 أيام فقط. الأولوية المطلقة:
1. اختبار شامل لـ Timekeeper + Finish Line
2. شاشة اعتماد اللجنة (RaceDayPanel reborn)
3. PublicResults كاملة + نقاط صحيحة

كل شيء آخر يمكن أن يأتي بعد السباق.

**انتهى ملف الانتقال. بالتوفيق في الجلسة القادمة.**
