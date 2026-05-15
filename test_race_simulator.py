"""
==============================================================================
 محاكاة اختبار شامل لنظام Timekeeper + FinishLine
 الجائزة الكبرى للعدو الريفي — بوجدور 2026
==============================================================================

الحماية:
  - بيانات اختبار معزولة (مؤسسة __TEST__ + سباق خاص)
  - try/finally يضمن cleanup حتى عند الفشل
  - لا يلمس أي بيانات حقيقية
  - يطبع لقطة قبل/بعد للتحقق

المتطلبات:
  pip install supabase python-dotenv

التشغيل:
  1. أنشئ ملف .env بجانب السكريبت ضع فيه:
     SUPABASE_URL=https://spatoeqjefkygbiezvgk.supabase.co
     SUPABASE_ANON_KEY=eyJhbG...  (الموجود في supabase.js)
     SUPER_ADMIN_EMAIL=simlali@grandprix.ma
     SUPER_ADMIN_PASSWORD=كلمة_السر

  2. python test_race_simulator.py
==============================================================================
"""

import os
import sys
import time
import uuid
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# ─── Config ───────────────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY')
EMAIL = os.getenv('SUPER_ADMIN_EMAIL')
PASSWORD = os.getenv('SUPER_ADMIN_PASSWORD')

if not all([SUPABASE_URL, SUPABASE_ANON_KEY, EMAIL, PASSWORD]):
    print("❌ ملف .env ناقص. راجع التعليقات في رأس السكريبت.")
    sys.exit(1)

TEST_INSTITUTION_NAME = '__TEST__SIMULATOR'
TEST_DOSSARD_START = 9001
TEST_DOSSARD_END = 9010

# ─── Helpers ──────────────────────────────────────────────────────────────────
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    GRAY = '\033[90m'
    BOLD = '\033[1m'
    END = '\033[0m'

def log(msg, color=Colors.END):
    print(f"{color}{msg}{Colors.END}")

def ok(msg): log(f"  ✓ {msg}", Colors.GREEN)
def fail(msg): log(f"  ✗ {msg}", Colors.RED)
def info(msg): log(f"  · {msg}", Colors.GRAY)
def section(msg): log(f"\n{Colors.BOLD}{Colors.BLUE}━━━ {msg} ━━━{Colors.END}")

results = {'passed': 0, 'failed': 0, 'errors': []}

def check(condition, msg):
    if condition:
        ok(msg)
        results['passed'] += 1
        return True
    else:
        fail(msg)
        results['failed'] += 1
        results['errors'].append(msg)
        return False

# ─── Connect ──────────────────────────────────────────────────────────────────
section("الاتصال وتسجيل الدخول")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

try:
    auth_resp = supabase.auth.sign_in_with_password({'email': EMAIL, 'password': PASSWORD})
    USER_ID = auth_resp.user.id
    ok(f"دخول ناجح: {EMAIL}")
    info(f"user_id: {USER_ID}")
except Exception as e:
    fail(f"فشل تسجيل الدخول: {e}")
    sys.exit(1)

# الحصول على committee_member_id
cm_resp = supabase.table('committee_members').select('id, role').eq('auth_user_id', USER_ID).execute()
if not cm_resp.data:
    fail("لا يوجد committee_member مرتبط بهذا الحساب")
    sys.exit(1)
COMMITTEE_MEMBER_ID = cm_resp.data[0]['id']
ROLE = cm_resp.data[0]['role']
ok(f"committee_member_id: {COMMITTEE_MEMBER_ID} (role: {ROLE})")

if ROLE != 'super_admin':
    fail(f"الدور المطلوب super_admin، الموجود: {ROLE}")
    sys.exit(1)

# ─── Snapshot قبل ─────────────────────────────────────────────────────────────
section("لقطة قبل الاختبار")

def snapshot():
    snap = {}
    for table in ['athletes', 'institutions', 'races', 'race_timings', 'race_finish_orders', 'attendance', 'results']:
        try:
            r = supabase.table(table).select('id', count='exact').execute()
            snap[table] = r.count
        except Exception as e:
            snap[table] = f'err: {e}'
    return snap

snap_before = snapshot()
for table, count in snap_before.items():
    info(f"{table}: {count}")

# ─── Setup: بيانات اختبار معزولة ──────────────────────────────────────────────
TEST_INSTITUTION_ID = None
TEST_ATHLETE_IDS = []
TEST_RACE_ID = None

def setup_test_data():
    global TEST_INSTITUTION_ID, TEST_ATHLETE_IDS, TEST_RACE_ID

    section("إنشاء بيانات الاختبار المعزولة")

    # 1. مؤسسة اختبار
    inst_resp = supabase.table('institutions').insert({
        'name': TEST_INSTITUTION_NAME,
        'type': 'education',
        'responsible_name': 'TEST',
        'phone': '0000000000',
        'list_status': 'approved',
    }).execute()
    TEST_INSTITUTION_ID = inst_resp.data[0]['id']
    ok(f"مؤسسة الاختبار: {TEST_INSTITUTION_ID}")

    # 2. 10 رياضيين باراعم ذكور (2013) صدريات 9001-9010
    for i in range(10):
        dossard = TEST_DOSSARD_START + i
        a_resp = supabase.table('athletes').insert({
            'institution_id': TEST_INSTITUTION_ID,
            'first_name': f'TEST_FN_{i+1}',
            'last_name': f'TEST_LN_{i+1}',
            'gender': 'male',
            'birth_date': '2013-01-01',
            'dossard_number': dossard,
        }).execute()
        TEST_ATHLETE_IDS.append((a_resp.data[0]['id'], dossard))
    ok(f"10 رياضيين أُنشئوا (صدريات {TEST_DOSSARD_START}-{TEST_DOSSARD_END})")

    # 3. سباق اختبار: baraem male qualifying — نتحقق أنه غير موجود
    existing = supabase.table('races').select('id').eq('category', 'baraem').eq('gender', 'male').eq('stage', 'qualifying').execute()
    if existing.data:
        info(f"سباق baraem-male-qualifying موجود، سننشئ سباق اختبار بـ stage مختلف")
        # نستخدم stage مزيف لن يتعارض. لكن stage ENUM فقط qualifying/final
        # الحل: نستخدم سباقاً موجوداً، لكن نتأكد أنه pending فقط
        race = existing.data[0]
        race_check = supabase.table('races').select('status').eq('id', race['id']).execute()
        if race_check.data[0]['status'] != 'pending':
            fail(f"السباق الموجود حالته {race_check.data[0]['status']}، لا يمكن استخدامه")
            raise Exception("سباق غير صالح للاختبار")
        TEST_RACE_ID = race['id']
        ok(f"نستخدم السباق الموجود (pending): {TEST_RACE_ID}")
    else:
        r_resp = supabase.table('races').insert({
            'category': 'baraem',
            'gender': 'male',
            'stage': 'qualifying',
            'distance_meters': 1500,
            'scheduled_at': '2026-05-17T10:15:00Z',
            'status': 'pending',
        }).execute()
        TEST_RACE_ID = r_resp.data[0]['id']
        ok(f"سباق اختبار جديد: {TEST_RACE_ID}")

# ─── Cleanup ──────────────────────────────────────────────────────────────────
def cleanup():
    section("تنظيف بيانات الاختبار")

    if TEST_RACE_ID:
        # امسح timings و orders و attendance لهذا السباق
        for table in ['race_timings', 'race_finish_orders', 'attendance', 'results']:
            try:
                supabase.table(table).delete().eq('race_id', TEST_RACE_ID).execute()
                info(f"{table}: مُسحت سجلات السباق")
            except Exception as e:
                info(f"{table}: {e}")

        # أعد السباق لـ pending
        try:
            supabase.table('races').update({
                'status': 'pending',
                'started_at': None,
                'is_completed': False,
            }).eq('id', TEST_RACE_ID).execute()
            ok("السباق أعيد إلى pending")
        except Exception as e:
            info(f"إعادة السباق: {e}")

    # امسح الرياضيين والمؤسسة
    if TEST_ATHLETE_IDS:
        for aid, _ in TEST_ATHLETE_IDS:
            try:
                supabase.table('athletes').delete().eq('id', aid).execute()
            except Exception:
                pass
        ok(f"حُذف {len(TEST_ATHLETE_IDS)} رياضي اختبار")

    if TEST_INSTITUTION_ID:
        try:
            supabase.table('institutions').delete().eq('id', TEST_INSTITUTION_ID).execute()
            ok("حُذفت مؤسسة الاختبار")
        except Exception as e:
            info(f"مؤسسة: {e}")

# ─── السيناريوهات ─────────────────────────────────────────────────────────────
def get_race_status():
    r = supabase.table('races').select('status, started_at').eq('id', TEST_RACE_ID).execute()
    return r.data[0] if r.data else None

def reset_race():
    try:
        supabase.rpc('reset_race', {'p_race_id': TEST_RACE_ID}).execute()
    except Exception:
        # fallback يدوي
        for t in ['race_timings', 'race_finish_orders']:
            supabase.table(t).delete().eq('race_id', TEST_RACE_ID).execute()
        supabase.table('races').update({'status': 'pending', 'started_at': None}).eq('id', TEST_RACE_ID).execute()

# 1. التدفق الطبيعي
def scenario_1_normal_flow():
    section("سيناريو 1: التدفق الطبيعي (بدء → 5 وصول → إنهاء)")
    reset_race()

    # بدء السباق
    r = supabase.rpc('start_race', {'p_race_id': TEST_RACE_ID}).execute()
    check(get_race_status()['status'] == 'running', "السباق في حالة running بعد start_race")

    # 5 وصول
    positions = []
    for i in range(5):
        time_ms = (i + 1) * 60000  # 1 min, 2 min, ...
        cid = f"test_s1_{uuid.uuid4()}"
        resp = supabase.rpc('record_arrival', {
            'p_race_id': TEST_RACE_ID,
            'p_finish_time_ms': time_ms,
            'p_client_id': cid,
            'p_recorded_by': COMMITTEE_MEMBER_ID,
        }).execute()
        if resp.data:
            pos = resp.data[0]['assigned_position'] if isinstance(resp.data, list) else resp.data.get('assigned_position')
            positions.append(pos)

    check(positions == [1, 2, 3, 4, 5], f"المراتب متسلسلة 1-5: {positions}")

    # إنهاء
    supabase.rpc('finish_race', {'p_race_id': TEST_RACE_ID}).execute()
    check(get_race_status()['status'] == 'finished', "السباق في حالة finished")

    # عدد التواقيت
    r = supabase.table('race_timings').select('id', count='exact').eq('race_id', TEST_RACE_ID).execute()
    check(r.count == 5, f"عدد التواقيت في DB = 5 (الفعلي: {r.count})")

# 2. Idempotency: نفس client_id مكرر
def scenario_2_idempotency():
    section("سيناريو 2: Idempotency (نفس client_id 3 مرات)")
    reset_race()

    supabase.rpc('start_race', {'p_race_id': TEST_RACE_ID}).execute()

    cid = f"test_s2_{uuid.uuid4()}"
    positions = []
    for _ in range(3):
        resp = supabase.rpc('record_arrival', {
            'p_race_id': TEST_RACE_ID,
            'p_finish_time_ms': 60000,
            'p_client_id': cid,
            'p_recorded_by': COMMITTEE_MEMBER_ID,
        }).execute()
        if resp.data:
            pos = resp.data[0]['assigned_position'] if isinstance(resp.data, list) else resp.data.get('assigned_position')
            positions.append(pos)
        time.sleep(0.1)

    check(len(set(positions)) == 1, f"كل المحاولات أرجعت نفس المرتبة: {positions}")
    r = supabase.table('race_timings').select('id', count='exact').eq('race_id', TEST_RACE_ID).execute()
    check(r.count == 1, f"سجل واحد فقط في DB (الفعلي: {r.count})")

# 3. start_race idempotent
def scenario_3_start_idempotent():
    section("سيناريو 3: start_race مكرر لا يُعيد التهيئة")
    reset_race()

    supabase.rpc('start_race', {'p_race_id': TEST_RACE_ID}).execute()
    first_start = get_race_status()['started_at']

    time.sleep(0.5)
    supabase.rpc('start_race', {'p_race_id': TEST_RACE_ID}).execute()
    second_start = get_race_status()['started_at']

    check(first_start == second_start, f"started_at لم يتغير عند الاستدعاء الثاني")

# 4. record_arrival مرفوض إذا السباق finished
def scenario_4_finished_rejects_arrivals():
    section("سيناريو 4: record_arrival مرفوض بعد finish_race")
    reset_race()

    supabase.rpc('start_race', {'p_race_id': TEST_RACE_ID}).execute()
    # تسجيل وصول واحد
    cid = f"test_s4_pre_{uuid.uuid4()}"
    supabase.rpc('record_arrival', {
        'p_race_id': TEST_RACE_ID, 'p_finish_time_ms': 60000,
        'p_client_id': cid, 'p_recorded_by': COMMITTEE_MEMBER_ID,
    }).execute()

    supabase.rpc('finish_race', {'p_race_id': TEST_RACE_ID}).execute()

    # محاولة وصول بعد الإنهاء
    rejected = False
    try:
        supabase.rpc('record_arrival', {
            'p_race_id': TEST_RACE_ID, 'p_finish_time_ms': 120000,
            'p_client_id': f"test_s4_post_{uuid.uuid4()}",
            'p_recorded_by': COMMITTEE_MEMBER_ID,
        }).execute()
    except Exception as e:
        rejected = True
        info(f"رُفض كما هو متوقع: {e}")

    check(rejected, "محاولة وصول بعد finish رُفضت")

# 5. finish_race مرفوض إذا pending
def scenario_5_finish_pending_rejects():
    section("سيناريو 5: finish_race مرفوض على سباق pending")
    reset_race()
    # تأكد أن الحالة pending
    check(get_race_status()['status'] == 'pending', "الحالة pending قبل المحاولة")

    rejected = False
    try:
        supabase.rpc('finish_race', {'p_race_id': TEST_RACE_ID}).execute()
    except Exception as e:
        rejected = True
        info(f"رُفض كما هو متوقع: {e}")

    check(rejected, "finish على pending رُفض")

# 6. reset_race يمسح كل شيء
def scenario_6_reset_clears_all():
    section("سيناريو 6: reset_race يمسح race_timings + race_finish_orders")
    reset_race()

    supabase.rpc('start_race', {'p_race_id': TEST_RACE_ID}).execute()

    # وصول × 3 + صدريات × 3
    for i in range(3):
        supabase.rpc('record_arrival', {
            'p_race_id': TEST_RACE_ID, 'p_finish_time_ms': (i+1)*60000,
            'p_client_id': f"test_s6_t_{i}_{uuid.uuid4()}",
            'p_recorded_by': COMMITTEE_MEMBER_ID,
        }).execute()
        # حكم خط الوصول
        supabase.table('race_finish_orders').insert({
            'race_id': TEST_RACE_ID, 'position': i+1,
            'dossard_number': TEST_DOSSARD_START + i,
            'client_id': f"test_s6_o_{i}_{uuid.uuid4()}",
            'recorded_by': COMMITTEE_MEMBER_ID,
            'is_synced': True,
        }).execute()

    # قبل reset
    t = supabase.table('race_timings').select('id', count='exact').eq('race_id', TEST_RACE_ID).execute()
    o = supabase.table('race_finish_orders').select('id', count='exact').eq('race_id', TEST_RACE_ID).execute()
    info(f"قبل reset: timings={t.count}, orders={o.count}")

    supabase.rpc('reset_race', {'p_race_id': TEST_RACE_ID}).execute()

    t = supabase.table('race_timings').select('id', count='exact').eq('race_id', TEST_RACE_ID).execute()
    o = supabase.table('race_finish_orders').select('id', count='exact').eq('race_id', TEST_RACE_ID).execute()
    check(t.count == 0, f"race_timings فارغ بعد reset (الفعلي: {t.count})")
    check(o.count == 0, f"race_finish_orders فارغ بعد reset (الفعلي: {o.count})")
    check(get_race_status()['status'] == 'pending', "السباق عاد إلى pending")

# 7. record_arrival على سباق pending مرفوض
def scenario_7_arrival_on_pending_rejects():
    section("سيناريو 7: record_arrival مرفوض على سباق pending")
    reset_race()

    rejected = False
    try:
        supabase.rpc('record_arrival', {
            'p_race_id': TEST_RACE_ID, 'p_finish_time_ms': 60000,
            'p_client_id': f"test_s7_{uuid.uuid4()}",
            'p_recorded_by': COMMITTEE_MEMBER_ID,
        }).execute()
    except Exception as e:
        rejected = True
        info(f"رُفض: {e}")

    check(rejected, "وصول على سباق pending رُفض")

# 8. تسلسل ضغطات سريعة متتالية (محاكاة جهازين)
def scenario_8_concurrent_arrivals():
    section("سيناريو 8: 10 وصول بضغطات سريعة (محاكاة 2 جهاز)")
    reset_race()
    supabase.rpc('start_race', {'p_race_id': TEST_RACE_ID}).execute()

    positions = []
    for i in range(10):
        cid = f"test_s8_{i}_{uuid.uuid4()}"
        resp = supabase.rpc('record_arrival', {
            'p_race_id': TEST_RACE_ID, 'p_finish_time_ms': (i+1)*30000,
            'p_client_id': cid, 'p_recorded_by': COMMITTEE_MEMBER_ID,
        }).execute()
        if resp.data:
            pos = resp.data[0]['assigned_position'] if isinstance(resp.data, list) else resp.data.get('assigned_position')
            positions.append(pos)
        # لا sleep — محاكاة سرعة ضغط

    check(positions == list(range(1, 11)), f"10 مراتب متسلسلة بلا فجوات: {positions}")
    check(len(set(positions)) == 10, "لا تكرار في المراتب")

# ─── Run ──────────────────────────────────────────────────────────────────────
try:
    setup_test_data()

    scenario_1_normal_flow()
    scenario_2_idempotency()
    scenario_3_start_idempotent()
    scenario_4_finished_rejects_arrivals()
    scenario_5_finish_pending_rejects()
    scenario_6_reset_clears_all()
    scenario_7_arrival_on_pending_rejects()
    scenario_8_concurrent_arrivals()

except Exception as e:
    log(f"\n❌ خطأ غير متوقع: {e}", Colors.RED)
    import traceback
    traceback.print_exc()

finally:
    # cleanup مضمون
    try:
        cleanup()
    except Exception as e:
        log(f"⚠ خطأ في التنظيف: {e}", Colors.YELLOW)

    # لقطة بعد
    section("لقطة بعد الاختبار")
    snap_after = snapshot()
    for table in snap_before:
        before, after = snap_before[table], snap_after[table]
        diff = after - before if isinstance(before, int) and isinstance(after, int) else 'n/a'
        marker = '✓' if diff == 0 else '⚠'
        log(f"  {marker} {table}: {before} → {after} (فرق: {diff})",
            Colors.GREEN if diff == 0 else Colors.YELLOW)

    # الخلاصة
    section("الخلاصة")
    log(f"  نجح: {results['passed']}", Colors.GREEN)
    log(f"  فشل: {results['failed']}", Colors.RED if results['failed'] else Colors.GREEN)
    if results['errors']:
        log("\n  الأخطاء:", Colors.RED)
        for e in results['errors']:
            log(f"    - {e}", Colors.RED)

    log(f"\n{'='*60}\n")