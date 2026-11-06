"""Database layer: schema, helpers, college catalog, progress metrics."""
import datetime as dt
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
from pathlib import Path

ROOT = Path(__file__).parent
DB_PATH = Path(os.environ.get("CC_DB", ROOT / "data" / "college.db"))
ITERS = 200_000

SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY, email TEXT UNIQUE COLLATE NOCASE NOT NULL, name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('student','editor','counsellor')),
  pw_hash TEXT NOT NULL, salt TEXT NOT NULL, iters INTEGER NOT NULL, grad_year INTEGER, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires REAL NOT NULL);
CREATE TABLE IF NOT EXISTS assign(student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, staff_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(student_id, staff_id));
CREATE TABLE IF NOT EXISTS profile(student_id INTEGER NOT NULL, section TEXT NOT NULL, data TEXT NOT NULL, updated TEXT NOT NULL, updated_by INTEGER, PRIMARY KEY(student_id, section));
CREATE TABLE IF NOT EXISTS catalog(id INTEGER PRIMARY KEY, name TEXT UNIQUE, city TEXT, state TEXT, type TEXT, accept REAL, sat25 INTEGER, sat75 INTEGER, early TEXT, early_type TEXT, rd TEXT, url TEXT);
CREATE TABLE IF NOT EXISTS student_colleges(id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, catalog_id INTEGER, name TEXT NOT NULL, category TEXT, round TEXT, deadline TEXT, status TEXT DEFAULT 'Researching', notes TEXT DEFAULT '', added TEXT);
CREATE TABLE IF NOT EXISTS essays(id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, prompt TEXT DEFAULT '', word_limit INTEGER DEFAULT 650, college_id INTEGER, content TEXT DEFAULT '', status TEXT DEFAULT 'Not started', created TEXT, updated TEXT, updated_by INTEGER);
CREATE TABLE IF NOT EXISTS essay_versions(id INTEGER PRIMARY KEY, essay_id INTEGER NOT NULL REFERENCES essays(id) ON DELETE CASCADE, content TEXT, note TEXT, author_id INTEGER, words INTEGER, created TEXT);
CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY, essay_id INTEGER NOT NULL REFERENCES essays(id) ON DELETE CASCADE, parent_id INTEGER, author_id INTEGER, start INTEGER, "end" INTEGER, quote TEXT, body TEXT NOT NULL, resolved INTEGER DEFAULT 0, created TEXT);
CREATE TABLE IF NOT EXISTS suggestions(id INTEGER PRIMARY KEY, essay_id INTEGER NOT NULL REFERENCES essays(id) ON DELETE CASCADE, author_id INTEGER, start INTEGER, original TEXT, replacement TEXT, note TEXT DEFAULT '', status TEXT DEFAULT 'pending', created TEXT);
CREATE TABLE IF NOT EXISTS tasks(id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, title TEXT NOT NULL, due TEXT, category TEXT DEFAULT 'General', done INTEGER DEFAULT 0, college_id INTEGER, created_by INTEGER, created TEXT, done_at TEXT);
CREATE TABLE IF NOT EXISTS recs(id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, name TEXT NOT NULL, kind TEXT DEFAULT 'Teacher', subject TEXT DEFAULT '', email TEXT DEFAULT '', status TEXT DEFAULT 'Not asked', requested TEXT, due TEXT, colleges TEXT DEFAULT '', notes TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS sat_scores(id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, kind TEXT, date TEXT, total INTEGER, rw INTEGER, math INTEGER, note TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS kv(student_id INTEGER NOT NULL, key TEXT NOT NULL, value TEXT, PRIMARY KEY(student_id, key));
CREATE TABLE IF NOT EXISTS attempts(id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, section TEXT, date TEXT, correct INTEGER, total INTEGER, detail TEXT);
CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, channel TEXT NOT NULL, sender_id INTEGER NOT NULL, body TEXT NOT NULL, created TEXT);
CREATE TABLE IF NOT EXISTS reads(user_id INTEGER NOT NULL, student_id INTEGER NOT NULL, channel TEXT NOT NULL, last_id INTEGER DEFAULT 0, PRIMARY KEY(user_id, student_id, channel));
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, actor_id INTEGER, kind TEXT, text TEXT, created TEXT);
CREATE INDEX IF NOT EXISTS idx_events ON events(student_id, id);
CREATE INDEX IF NOT EXISTS idx_msgs ON messages(student_id, channel, id);
"""


def now():
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def today():
    return dt.date.today()


def connect():
    c = sqlite3.connect(DB_PATH, timeout=15)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys=ON")
    return c


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = connect()
    c.execute("PRAGMA journal_mode=WAL")
    c.executescript(SCHEMA)
    c.commit()
    c.close()


def hash_pw(pw, salt=None, iters=ITERS):
    salt = salt or secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(salt), iters).hex()
    return h, salt, iters


def check_pw(pw, row):
    h, _, _ = hash_pw(pw, row["salt"], row["iters"])
    return hmac.compare_digest(h, row["pw_hash"])


def log(db, sid, actor, kind, text):
    db.execute("INSERT INTO events(student_id,actor_id,kind,text,created) VALUES(?,?,?,?,?)", (sid, actor, kind, text, now()))


def words(text):
    return len((text or "").split())


# ---------------------------------------------------------------- profile
def get_profile(db, sid):
    out = {}
    for r in db.execute("SELECT section,data FROM profile WHERE student_id=?", (sid,)):
        out[r["section"]] = json.loads(r["data"])
    return out


def filled(v):
    return v is not None and str(v).strip() != ""


REQUIRED = {
    "profile": ["first", "last", "birthdate", "email", "phone", "address1", "city", "state", "zip", "country", "citizenship"],
    "family": ["household", "p1_name", "p1_occupation", "p1_education", "siblings_count"],
    "education": ["school_name", "school_city", "school_state", "grad_date", "gpa", "gpa_scale", "counselor_name", "counselor_email", "rank_type"],
}
SECTION_ORDER = ["profile", "family", "education", "testing", "activities", "honors", "writing", "additional", "courses"]


def section_progress(prof, personal_essay):
    """Return {section: fraction or None (None = optional and empty)}."""
    out = {}
    for sec, keys in REQUIRED.items():
        d = prof.get(sec, {})
        out[sec] = sum(1 for k in keys if filled(d.get(k))) / len(keys)
    t = prof.get("testing", {})
    has_score = filled(t.get("sat_total")) or filled(t.get("act_composite")) or filled(t.get("sat_ebrw"))
    out["testing"] = (0.4 if filled(t.get("test_plan")) else 0) + (0.6 if (has_score or t.get("test_plan") == "Test-optional: will not submit") else 0)
    acts = [a for a in prof.get("activities", {}).get("items", []) if filled(a.get("type")) and filled(a.get("org")) and filled(a.get("desc"))]
    out["activities"] = min(1.0, len(acts) / 8)
    hon = [a for a in prof.get("honors", {}).get("items", []) if filled(a.get("title"))]
    out["honors"] = min(1.0, len(hon) / 3)
    if personal_essay:
        w = words(personal_essay["content"])
        out["writing"] = 1.0 if personal_essay["status"] == "Final" and w >= 250 else min(0.9, w / 650 * 0.9)
    else:
        out["writing"] = 0.0
    add = prof.get("additional", {}).get("text", "")
    out["additional"] = 1.0 if filled(add) else None
    out["courses"] = min(1.0, len(prof.get("courses", {}).get("rows", [])) / 12)
    return out


# ---------------------------------------------------------------- SAT / colleges
def best_sat(db, sid, prof=None):
    r = db.execute("SELECT MAX(total) m FROM sat_scores WHERE student_id=? AND kind='official'", (sid,)).fetchone()
    if r and r["m"]:
        return r["m"]
    prof = prof if prof is not None else get_profile(db, sid)
    try:
        v = int(prof.get("testing", {}).get("sat_total") or 0)
        if v:
            return v
    except (TypeError, ValueError):
        pass
    r = db.execute("SELECT total FROM sat_scores WHERE student_id=? ORDER BY date DESC, id DESC LIMIT 1", (sid,)).fetchone()
    return r["total"] if r else None


def auto_category(sat, accept, sat25, sat75):
    if accept is None:
        return "Target"
    if accept <= 15:
        return "Reach"
    if sat and sat25 and sat75:
        if sat >= sat75:
            return "Safety" if accept >= 40 else "Target"
        if sat >= sat25:
            return "Target" if accept >= 20 or sat >= (sat25 + sat75) / 2 else "Reach"
        return "Reach"
    return "Reach" if accept < 25 else ("Target" if accept < 60 else "Safety")


def colleges_for(db, sid):
    sat = best_sat(db, sid)
    out = []
    for r in db.execute("""SELECT sc.*, c.city, c.state, c.type, c.accept, c.sat25, c.sat75, c.early, c.early_type, c.rd, c.url
                           FROM student_colleges sc LEFT JOIN catalog c ON c.id=sc.catalog_id
                           WHERE sc.student_id=? ORDER BY COALESCE(sc.deadline,'9999'), sc.name""", (sid,)):
        d = dict(r)
        d["auto_category"] = auto_category(sat, r["accept"], r["sat25"], r["sat75"])
        d["effective_category"] = r["category"] or d["auto_category"]
        out.append(d)
    return out


# ---------------------------------------------------------------- metrics
def student_metrics(db, sid):
    prof = get_profile(db, sid)
    pe = db.execute("SELECT * FROM essays WHERE student_id=? AND kind='personal' ORDER BY id LIMIT 1", (sid,)).fetchone()
    prog = section_progress(prof, pe)
    vals = [v for v in prog.values() if v is not None]
    overall = sum(vals) / len(vals) if vals else 0
    t = today().isoformat()
    tasks = db.execute("SELECT COUNT(*) n, SUM(done) d, SUM(CASE WHEN done=0 AND due<? THEN 1 ELSE 0 END) o FROM tasks WHERE student_id=?", (t, sid)).fetchone()
    ess = {r["status"]: r["n"] for r in db.execute("SELECT status, COUNT(*) n FROM essays WHERE student_id=? GROUP BY status", (sid,))}
    open_comments = db.execute("SELECT COUNT(*) FROM comments c JOIN essays e ON e.id=c.essay_id WHERE e.student_id=? AND c.resolved=0 AND c.parent_id IS NULL", (sid,)).fetchone()[0]
    pending_sugg = db.execute("SELECT COUNT(*) FROM suggestions s JOIN essays e ON e.id=s.essay_id WHERE e.student_id=? AND s.status='pending'", (sid,)).fetchone()[0]
    cols = colleges_for(db, sid)
    cats = {"Reach": 0, "Target": 0, "Safety": 0}
    for c in cols:
        cats[c["effective_category"]] += 1
    recs = {r["status"]: r["n"] for r in db.execute("SELECT status, COUNT(*) n FROM recs WHERE student_id=? GROUP BY status", (sid,))}
    target = db.execute("SELECT value FROM kv WHERE student_id=? AND key='sat_target'", (sid,)).fetchone()
    nxt = None
    for c in cols:
        if c["deadline"] and c["deadline"] >= t and c["status"] not in ("Submitted", "Admitted", "Waitlisted", "Denied", "Withdrawn"):
            nxt = {"college": c["name"], "date": c["deadline"], "round": c["round"]}
            break
    last = db.execute("SELECT MAX(created) m FROM events WHERE student_id=?", (sid,)).fetchone()["m"]
    flags = []
    if tasks["o"]:
        flags.append(f"{tasks['o']} overdue task{'s' if tasks['o'] != 1 else ''}")
    if cols and cats["Safety"] == 0:
        flags.append("No safety school on list")
    if len(cols) < 6:
        flags.append(f"Only {len(cols)} colleges on list")
    if nxt and (dt.date.fromisoformat(nxt["date"]) - today()).days <= 21 and overall < 0.8:
        flags.append(f"{nxt['college']} due in {(dt.date.fromisoformat(nxt['date']) - today()).days}d, application {round(overall * 100)}% ready")
    if recs and not recs.get("Submitted") and sum(recs.values()) and recs.get("Not asked"):
        flags.append("Recommenders not yet asked")
    if open_comments:
        flags.append(f"{open_comments} open essay comment{'s' if open_comments != 1 else ''}")
    return {
        "progress": prog, "overall": overall,
        "tasks": {"total": tasks["n"] or 0, "done": tasks["d"] or 0, "overdue": tasks["o"] or 0},
        "essays": ess, "essay_total": sum(ess.values()), "open_comments": open_comments, "pending_suggestions": pending_sugg,
        "colleges": len(cols), "categories": cats, "recs": recs,
        "sat_best": best_sat(db, sid, prof), "sat_target": int(target["value"]) if target and target["value"] else None,
        "next_deadline": nxt, "last_activity": last, "flags": flags,
    }


# ---------------------------------------------------------------- catalog
# (name, city, state, type, accept%, sat25, sat75, early deadline, early type, regular deadline)
# Figures are approximate, drawn from public Common Data Sets; deadlines are typical for the 2026-27 cycle.
CATALOG = [
    ("Harvard University", "Cambridge", "MA", "Private", 3.6, 1500, 1580, "2026-11-01", "REA", "2027-01-01"),
    ("Stanford University", "Stanford", "CA", "Private", 3.9, 1510, 1570, "2026-11-01", "REA", "2027-01-05"),
    ("Massachusetts Institute of Technology", "Cambridge", "MA", "Private", 4.5, 1520, 1580, "2026-11-01", "EA", "2027-01-04"),
    ("Yale University", "New Haven", "CT", "Private", 4.5, 1500, 1570, "2026-11-01", "REA", "2027-01-02"),
    ("Princeton University", "Princeton", "NJ", "Private", 4.6, 1510, 1580, "2026-11-01", "REA", "2027-01-01"),
    ("University of Chicago", "Chicago", "IL", "Private", 5.0, 1510, 1570, "2026-11-01", "EA", "2027-01-06"),
    ("Columbia University", "New York", "NY", "Private", 3.9, 1510, 1570, "2026-11-01", "ED", "2027-01-01"),
    ("University of Pennsylvania", "Philadelphia", "PA", "Private", 5.9, 1500, 1570, "2026-11-01", "ED", "2027-01-05"),
    ("Duke University", "Durham", "NC", "Private", 6.0, 1520, 1570, "2026-11-01", "ED", "2027-01-05"),
    ("Northwestern University", "Evanston", "IL", "Private", 7.0, 1500, 1560, "2026-11-01", "ED", "2027-01-03"),
    ("Brown University", "Providence", "RI", "Private", 5.0, 1510, 1570, "2026-11-01", "ED", "2027-01-05"),
    ("Cornell University", "Ithaca", "NY", "Private", 7.5, 1480, 1560, "2026-11-01", "ED", "2027-01-02"),
    ("Johns Hopkins University", "Baltimore", "MD", "Private", 6.5, 1530, 1570, "2026-11-01", "ED", "2027-01-03"),
    ("Rice University", "Houston", "TX", "Private", 8.0, 1520, 1570, "2026-11-01", "ED", "2027-01-04"),
    ("Vanderbilt University", "Nashville", "TN", "Private", 5.6, 1500, 1570, "2026-11-01", "ED", "2027-01-02"),
    ("Washington University in St. Louis", "St. Louis", "MO", "Private", 12.0, 1500, 1570, "2026-11-01", "ED", "2027-01-02"),
    ("Emory University", "Atlanta", "GA", "Private", 11.0, 1470, 1550, "2026-11-01", "ED", "2027-01-01"),
    ("Georgetown University", "Washington", "DC", "Private", 12.0, 1450, 1550, "2026-11-01", "EA", "2027-01-10"),
    ("Carnegie Mellon University", "Pittsburgh", "PA", "Private", 11.0, 1500, 1560, "2026-11-01", "ED", "2027-01-04"),
    ("Tufts University", "Medford", "MA", "Private", 10.0, 1500, 1560, "2026-11-01", "ED", "2027-01-04"),
    ("Boston University", "Boston", "MA", "Private", 11.0, 1420, 1540, "2026-11-01", "ED", "2027-01-04"),
    ("New York University", "New York", "NY", "Private", 12.0, 1470, 1550, "2026-11-01", "ED", "2027-01-05"),
    ("Northeastern University", "Boston", "MA", "Private", 7.0, 1500, 1560, "2026-11-01", "EA", "2027-01-01"),
    ("Case Western Reserve University", "Cleveland", "OH", "Private", 27.0, 1450, 1540, "2026-11-01", "ED", "2027-01-15"),
    ("Wake Forest University", "Winston-Salem", "NC", "Private", 21.0, 1390, 1510, "2026-11-15", "ED", "2027-01-01"),
    ("Pomona College", "Claremont", "CA", "Private", 7.0, 1500, 1560, "2026-11-15", "ED", "2027-01-05"),
    ("Williams College", "Williamstown", "MA", "Private", 8.0, 1480, 1560, "2026-11-15", "ED", "2027-01-05"),
    ("Amherst College", "Amherst", "MA", "Private", 7.0, 1490, 1560, "2026-11-15", "ED", "2027-01-05"),
    ("Swarthmore College", "Swarthmore", "PA", "Private", 7.0, 1480, 1560, "2026-11-15", "ED", "2027-01-04"),
    ("Georgia Institute of Technology", "Atlanta", "GA", "Public", 16.0, 1370, 1540, "2026-10-15", "EA", "2027-01-04"),
    ("University of Michigan", "Ann Arbor", "MI", "Public", 18.0, 1350, 1530, "2026-11-01", "EA", "2027-02-01"),
    ("University of Virginia", "Charlottesville", "VA", "Public", 16.0, 1360, 1530, "2026-11-01", "ED", "2027-01-05"),
    ("University of North Carolina at Chapel Hill", "Chapel Hill", "NC", "Public", 17.0, 1340, 1520, "2026-10-15", "EA", "2027-01-15"),
    ("University of Texas at Austin", "Austin", "TX", "Public", 29.0, 1230, 1500, None, None, "2026-12-01"),
    ("University of Wisconsin-Madison", "Madison", "WI", "Public", 43.0, 1370, 1500, "2026-11-01", "EA", "2027-02-01"),
    ("University of Illinois Urbana-Champaign", "Champaign", "IL", "Public", 45.0, 1340, 1500, "2026-11-01", "EA", "2027-01-05"),
    ("Ohio State University", "Columbus", "OH", "Public", 51.0, 1290, 1450, "2026-11-01", "EA", "2027-02-01"),
    ("Purdue University", "West Lafayette", "IN", "Public", 50.0, 1220, 1450, "2026-11-01", "EA", "2027-01-15"),
    ("University of Minnesota Twin Cities", "Minneapolis", "MN", "Public", 77.0, 1310, 1500, "2026-11-01", "EA", "2027-01-01"),
    ("Pennsylvania State University", "University Park", "PA", "Public", 55.0, 1230, 1420, None, None, "2026-11-30"),
    ("Michigan State University", "East Lansing", "MI", "Public", 88.0, 1190, 1360, None, None, "2027-02-01"),
    ("Arizona State University", "Tempe", "AZ", "Public", 90.0, 1120, 1360, None, None, "2027-05-01"),
]


def seed_catalog(db):
    for row in CATALOG:
        db.execute("INSERT OR IGNORE INTO catalog(name,city,state,type,accept,sat25,sat75,early,early_type,rd,url) VALUES(?,?,?,?,?,?,?,?,?,?,?)", row + ("",))
