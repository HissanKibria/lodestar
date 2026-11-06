#!/usr/bin/env python3
"""Common App college counselling server. Stdlib only: http.server + sqlite3.

Run:  python3 server.py [port]      (default 8200)
"""
import json
import mimetypes
import re
import secrets
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import db as D
import satdata
from seed import seed, DEMO_PASSWORD

STATIC = Path(__file__).parent / "static"
ROUTES = []
FAILS = {}  # email -> (count, first_ts)
SECTIONS = {"profile", "family", "education", "testing", "activities", "honors", "additional", "courses"}
ACT_LIMITS = {"position": 50, "org": 100, "desc": 150}


class ApiError(Exception):
    def __init__(self, status, msg):
        self.status, self.msg = status, msg


class Ctx:
    def __init__(self, conn, user, body, params, query):
        self.db, self.user, self.body, self.params, self.query = conn, user, body, params, query


def route(method, pattern, auth=True):
    rx = re.compile("^" + re.sub(r":(\w+)", r"(?P<\1>[^/]+)", pattern) + "$")

    def deco(fn):
        ROUTES.append((method, rx, fn, auth))
        return fn
    return deco


# ------------------------------------------------------------------ helpers
def need(cond, msg="Bad request", status=400):
    if not cond:
        raise ApiError(status, msg)


def text(v, n=2000, req=False, name="field"):
    v = "" if v is None else str(v).strip()
    need(len(v) <= n, f"{name} is too long (max {n})")
    need(not req or v, f"{name} is required")
    return v


def date_or_none(v):
    v = (v or "").strip() if isinstance(v, str) else v
    if not v:
        return None
    need(re.fullmatch(r"\d{4}-\d{2}-\d{2}", v), "Dates must be YYYY-MM-DD")
    return v


def intval(v, lo=None, hi=None, name="value"):
    try:
        v = int(v)
    except (TypeError, ValueError):
        raise ApiError(400, f"{name} must be a number")
    need(lo is None or v >= lo, f"{name} too small")
    need(hi is None or v <= hi, f"{name} too large")
    return v


def access(ctx, sid, roles=None):
    sid = int(sid)
    u = ctx.user
    st = ctx.db.execute("SELECT * FROM users WHERE id=? AND role='student'", (sid,)).fetchone()
    need(st, "Student not found", 404)
    if u["role"] == "student":
        need(u["id"] == sid, "No access to this student", 403)
    else:
        need(ctx.db.execute("SELECT 1 FROM assign WHERE student_id=? AND staff_id=?", (sid, u["id"])).fetchone(), "No access to this student", 403)
    need(roles is None or u["role"] in roles, f"Your role ({u['role']}) cannot do this", 403)
    return st


def row(ctx, table, id_, name="Item"):
    r = ctx.db.execute(f"SELECT * FROM {table} WHERE id=?", (int(id_),)).fetchone()
    need(r, f"{name} not found", 404)
    return r


def essay_access(ctx, eid, roles=None):
    e = row(ctx, "essays", eid, "Essay")
    access(ctx, e["student_id"], roles)
    return e


def public_user(u):
    return {"id": u["id"], "name": u["name"], "email": u["email"], "role": u["role"], "grad_year": u["grad_year"]}


def update(ctx, table, id_, body, fields):
    sets, vals = [], []
    for f, fn in fields.items():
        if f in body:
            sets.append(f"{f}=?")
            vals.append(fn(body[f]))
    if sets:
        ctx.db.execute(f"UPDATE {table} SET {', '.join(sets)} WHERE id=?", vals + [id_])


def snapshot(ctx, e, note, author=None):
    ctx.db.execute("INSERT INTO essay_versions(essay_id,content,note,author_id,words,created) VALUES(?,?,?,?,?,?)",
                   (e["id"], e["content"], note, author or ctx.user["id"], D.words(e["content"]), D.now()))


# ------------------------------------------------------------------ auth
@route("POST", "/api/login", auth=False)
def login(ctx):
    email = text(ctx.body.get("email"), 200, True, "Email").lower()
    pw = str(ctx.body.get("password") or "")
    c, t0 = FAILS.get(email, (0, time.time()))
    if time.time() - t0 > 300:
        c, t0 = 0, time.time()
    need(c < 8, "Too many attempts. Try again in a few minutes.", 429)
    u = ctx.db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    if not u or not D.check_pw(pw, u):
        FAILS[email] = (c + 1, t0)
        raise ApiError(401, "Incorrect email or password")
    FAILS.pop(email, None)
    tok = secrets.token_urlsafe(32)
    ctx.db.execute("INSERT INTO sessions VALUES(?,?,?)", (tok, u["id"], time.time() + 14 * 86400))
    ctx.db.execute("DELETE FROM sessions WHERE expires<?", (time.time(),))
    return {"token": tok, "user": public_user(u)}


@route("POST", "/api/logout")
def logout(ctx):
    ctx.db.execute("DELETE FROM sessions WHERE user_id=? AND token=?", (ctx.user["id"], ctx.query.get("_token", "")))
    return {"ok": True}


@route("GET", "/api/me")
def me(ctx):
    return {"user": public_user(ctx.user)}


@route("POST", "/api/password")
def change_pw(ctx):
    need(D.check_pw(str(ctx.body.get("old") or ""), ctx.user), "Current password is incorrect", 403)
    new = str(ctx.body.get("new") or "")
    need(len(new) >= 8, "New password must be at least 8 characters")
    h, s, i = D.hash_pw(new)
    ctx.db.execute("UPDATE users SET pw_hash=?,salt=?,iters=? WHERE id=?", (h, s, i, ctx.user["id"]))
    return {"ok": True}


# ------------------------------------------------------------------ people
@route("GET", "/api/caseload")
def caseload(ctx):
    u = ctx.user
    if u["role"] == "student":
        rows = [u]
    else:
        rows = ctx.db.execute("SELECT u.* FROM users u JOIN assign a ON a.student_id=u.id WHERE a.staff_id=? ORDER BY u.name", (u["id"],)).fetchall()
    out = []
    for s in rows:
        d = public_user(s)
        d["metrics"] = D.student_metrics(ctx.db, s["id"])
        d["team"] = [public_user(x) for x in ctx.db.execute("SELECT u.* FROM users u JOIN assign a ON a.staff_id=u.id WHERE a.student_id=?", (s["id"],))]
        out.append(d)
    return {"students": out}


@route("POST", "/api/students")
def create_student(ctx):
    need(ctx.user["role"] == "counsellor", "Only counsellors can add students", 403)
    b = ctx.body
    name = text(b.get("name"), 100, True, "Name")
    email = text(b.get("email"), 200, True, "Email").lower()
    need(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email), "Enter a valid email")
    pw = str(b.get("password") or "")
    need(len(pw) >= 8, "Password must be at least 8 characters")
    need(not ctx.db.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone(), "That email is already registered", 409)
    h, s, i = D.hash_pw(pw)
    sid = ctx.db.execute("INSERT INTO users(email,name,role,pw_hash,salt,iters,grad_year,created) VALUES(?,?,?,?,?,?,?,?)",
                         (email, name, "student", h, s, i, intval(b.get("grad_year") or 2027, 2024, 2040, "Graduation year"), D.now())).lastrowid
    ctx.db.execute("INSERT INTO assign VALUES(?,?)", (sid, ctx.user["id"]))
    if b.get("editor_id"):
        ed = row(ctx, "users", b["editor_id"], "Editor")
        need(ed["role"] == "editor", "Not an editor")
        ctx.db.execute("INSERT OR IGNORE INTO assign VALUES(?,?)", (sid, ed["id"]))
    first, _, last = name.partition(" ")
    ctx.db.execute("INSERT INTO profile VALUES(?,?,?,?,?)", (sid, "profile", json.dumps({"first": first, "last": last, "email": email}), D.now(), ctx.user["id"]))
    ctx.db.execute("INSERT INTO essays(student_id,kind,title,prompt,word_limit,content,status,created,updated,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?)",
                   (sid, "personal", "Common App Personal Essay", "", 650, "", "Not started", D.now(), D.now(), ctx.user["id"]))
    D.log(ctx.db, sid, ctx.user["id"], "account", "created the student account")
    return {"id": sid}


@route("POST", "/api/editors")
def create_editor(ctx):
    need(ctx.user["role"] == "counsellor", "Only counsellors can add editors", 403)
    b = ctx.body
    name = text(b.get("name"), 100, True, "Name")
    email = text(b.get("email"), 200, True, "Email").lower()
    need(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email), "Enter a valid email")
    pw = str(b.get("password") or "")
    need(len(pw) >= 8, "Password must be at least 8 characters")
    need(not ctx.db.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone(), "That email is already registered", 409)
    h, s, i = D.hash_pw(pw)
    eid = ctx.db.execute("INSERT INTO users(email,name,role,pw_hash,salt,iters,created) VALUES(?,?,?,?,?,?,?)", (email, name, "editor", h, s, i, D.now())).lastrowid
    mine = [r[0] for r in ctx.db.execute("SELECT student_id FROM assign WHERE staff_id=?", (ctx.user["id"],))]
    for sid in b.get("student_ids") or []:
        need(int(sid) in mine, "You can only assign your own students", 403)
        ctx.db.execute("INSERT OR IGNORE INTO assign VALUES(?,?)", (int(sid), eid))
    return {"id": eid}


@route("GET", "/api/staff")
def staff(ctx):
    need(ctx.user["role"] != "student", "Staff only", 403)
    return {"staff": [public_user(u) for u in ctx.db.execute("SELECT * FROM users WHERE role!='student' ORDER BY name")]}


@route("GET", "/api/s/:sid/people")
def people(ctx):
    access(ctx, ctx.params["sid"])
    sid = int(ctx.params["sid"])
    rows = ctx.db.execute("SELECT * FROM users WHERE id=? OR id IN (SELECT staff_id FROM assign WHERE student_id=?)", (sid, sid)).fetchall()
    return {"people": {r["id"]: public_user(r) for r in rows}}


# ------------------------------------------------------------------ dashboard
@route("GET", "/api/s/:sid/summary")
def summary(ctx):
    st = access(ctx, ctx.params["sid"])
    sid = st["id"]
    m = D.student_metrics(ctx.db, sid)
    t = D.today().isoformat()
    tasks = [dict(r) for r in ctx.db.execute("SELECT * FROM tasks WHERE student_id=? AND done=0 ORDER BY COALESCE(due,'9999') LIMIT 6", (sid,))]
    events = [dict(r) for r in ctx.db.execute("SELECT e.*, u.name actor FROM events e LEFT JOIN users u ON u.id=e.actor_id WHERE student_id=? ORDER BY e.id DESC LIMIT 12", (sid,))]
    deadlines = [{"id": c["id"], "name": c["name"], "date": c["deadline"], "round": c["round"], "status": c["status"], "category": c["effective_category"]}
                 for c in D.colleges_for(ctx.db, sid) if c["deadline"] and c["deadline"] >= t][:6]
    essays = [dict(r, words=D.words(r["content"])) for r in ctx.db.execute("SELECT id,title,kind,status,word_limit,content,updated FROM essays WHERE student_id=? ORDER BY kind DESC, id", (sid,))]
    for e in essays:
        e.pop("content")
    return {"student": public_user(st), "metrics": m, "tasks": tasks, "events": events, "deadlines": deadlines, "essays": essays, "today": t}


# ------------------------------------------------------------------ profile
def validate_section(sec, data):
    need(isinstance(data, dict), "Invalid data")
    need(len(json.dumps(data)) < 300_000, "Section too large")
    if sec == "activities":
        items = data.get("items", [])
        need(isinstance(items, list) and len(items) <= 10, "Activities has 10 slots")
        for i, a in enumerate(items, 1):
            for k, lim in ACT_LIMITS.items():
                need(len(str(a.get(k) or "")) <= lim, f"Activity {i}: {k} exceeds {lim} characters")
            for k, hi in (("hours", 168), ("weeks", 52)):
                if str(a.get(k) or "").strip():
                    intval(a[k], 0, hi, f"Activity {i} {k}")
    elif sec == "honors":
        items = data.get("items", [])
        need(isinstance(items, list) and len(items) <= 5, "Honors has 5 slots")
        for i, a in enumerate(items, 1):
            need(len(str(a.get("title") or "")) <= 100, f"Honor {i}: title exceeds 100 characters")
    elif sec == "additional":
        need(D.words(data.get("text", "")) <= 650, "Additional information is limited to 650 words")
    elif sec == "courses":
        need(len(data.get("rows", [])) <= 80, "Too many course rows")
    return data


@route("GET", "/api/s/:sid/profile")
def get_profile(ctx):
    access(ctx, ctx.params["sid"])
    return {"profile": D.get_profile(ctx.db, int(ctx.params["sid"]))}


@route("PUT", "/api/s/:sid/profile/:section")
def put_profile(ctx):
    access(ctx, ctx.params["sid"], ("student", "counsellor"))
    sec = ctx.params["section"]
    need(sec in SECTIONS, "Unknown section", 404)
    data = validate_section(sec, ctx.body.get("data"))
    sid = int(ctx.params["sid"])
    ctx.db.execute("INSERT OR REPLACE INTO profile VALUES(?,?,?,?,?)", (sid, sec, json.dumps(data), D.now(), ctx.user["id"]))
    return {"ok": True, "metrics": D.student_metrics(ctx.db, sid)}


# ------------------------------------------------------------------ essays
@route("GET", "/api/s/:sid/essays")
def list_essays(ctx):
    access(ctx, ctx.params["sid"])
    out = []
    for r in ctx.db.execute("""SELECT e.*, (SELECT COUNT(*) FROM comments c WHERE c.essay_id=e.id AND c.resolved=0 AND c.parent_id IS NULL) open_comments,
                               (SELECT COUNT(*) FROM suggestions s WHERE s.essay_id=e.id AND s.status='pending') pending,
                               (SELECT name FROM student_colleges WHERE id=e.college_id) college
                               FROM essays e WHERE student_id=? ORDER BY kind DESC, id""", (ctx.params["sid"],)):
        d = dict(r)
        d["words"] = D.words(d.pop("content"))
        out.append(d)
    return {"essays": out}


@route("POST", "/api/s/:sid/essays")
def create_essay(ctx):
    access(ctx, ctx.params["sid"], ("student", "counsellor"))
    b = ctx.body
    kind = b.get("kind", "supplemental")
    need(kind in ("personal", "supplemental", "other"), "Bad kind")
    cid = b.get("college_id") or None
    if cid:
        need(row(ctx, "student_colleges", cid)["student_id"] == int(ctx.params["sid"]), "Bad college")
    e = ctx.db.execute("INSERT INTO essays(student_id,kind,title,prompt,word_limit,college_id,content,status,created,updated,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                       (ctx.params["sid"], kind, text(b.get("title"), 200, True, "Title"), text(b.get("prompt"), 2000), intval(b.get("word_limit") or 650, 1, 5000, "Word limit"),
                        cid, "", "Not started", D.now(), D.now(), ctx.user["id"])).lastrowid
    D.log(ctx.db, ctx.params["sid"], ctx.user["id"], "essay", f"created essay '{text(b.get('title'))}'")
    return {"id": e}


@route("GET", "/api/essays/:id")
def get_essay(ctx):
    e = essay_access(ctx, ctx.params["id"])
    eid = e["id"]
    com = [dict(r) for r in ctx.db.execute("SELECT * FROM comments WHERE essay_id=? ORDER BY id", (eid,))]
    sug = [dict(r) for r in ctx.db.execute("SELECT * FROM suggestions WHERE essay_id=? ORDER BY id", (eid,))]
    ver = [dict(r) for r in ctx.db.execute("SELECT id,note,author_id,words,created FROM essay_versions WHERE essay_id=? ORDER BY id DESC", (eid,))]
    return {"essay": dict(e), "comments": com, "suggestions": sug, "versions": ver}


@route("PUT", "/api/essays/:id")
def put_essay(ctx):
    e = essay_access(ctx, ctx.params["id"])
    b = ctx.body
    role = ctx.user["role"]
    if "content" in b:
        need(role == "student", "Only the student can edit essay text. Editors and counsellors can comment and suggest.", 403)
        need(len(b["content"]) < 100_000, "Essay too long")
        # If the student's client was stale (someone accepted a suggestion), refuse the overwrite.
        if b.get("base_updated") and b["base_updated"] != e["updated"] and b.get("base_content") not in (None, e["content"]):
            raise ApiError(409, "This essay changed elsewhere. Reload to see the latest text.")
        if b["content"] != e["content"]:
            last = ctx.db.execute("SELECT created FROM essay_versions WHERE essay_id=? ORDER BY id DESC LIMIT 1", (e["id"],)).fetchone()
            ctx.db.execute("UPDATE essays SET content=?, updated=?, updated_by=? WHERE id=?", (b["content"], D.now(), ctx.user["id"], e["id"]))
            if not last or (time.time() - time.mktime(time.strptime(last["created"], "%Y-%m-%dT%H:%M:%SZ")) + time.timezone) > 600:
                snapshot(ctx, dict(e, content=b["content"]), "Autosnapshot")
    if "status" in b:
        need(b["status"] in ("Not started", "Drafting", "In review", "Revising", "Final"), "Bad status")
        ctx.db.execute("UPDATE essays SET status=?, updated=? WHERE id=?", (b["status"], D.now(), e["id"]))
        D.log(ctx.db, e["student_id"], ctx.user["id"], "essay", f"marked '{e['title']}' as {b['status']}")
    meta = {"title": lambda v: text(v, 200, True, "Title"), "prompt": lambda v: text(v, 2000), "word_limit": lambda v: intval(v, 1, 5000, "Word limit")}
    if any(k in b for k in meta):
        need(role in ("student", "counsellor"), "Cannot edit essay details", 403)
        update(ctx, "essays", e["id"], b, meta)
    return get_essay(ctx)


@route("DELETE", "/api/essays/:id")
def del_essay(ctx):
    e = essay_access(ctx, ctx.params["id"], ("student", "counsellor"))
    need(e["kind"] != "personal", "The personal essay cannot be deleted")
    ctx.db.execute("DELETE FROM essays WHERE id=?", (e["id"],))
    return {"ok": True}


@route("POST", "/api/essays/:id/versions")
def new_version(ctx):
    e = essay_access(ctx, ctx.params["id"])
    snapshot(ctx, e, text(ctx.body.get("note"), 200) or "Saved version")
    D.log(ctx.db, e["student_id"], ctx.user["id"], "essay", f"saved a new version of '{e['title']}'")
    return get_essay(ctx)


@route("GET", "/api/essays/:id/versions/:vid")
def get_version(ctx):
    e = essay_access(ctx, ctx.params["id"])
    v = row(ctx, "essay_versions", ctx.params["vid"], "Version")
    need(v["essay_id"] == e["id"], "Version not found", 404)
    return {"version": dict(v)}


@route("POST", "/api/essays/:id/restore/:vid")
def restore(ctx):
    e = essay_access(ctx, ctx.params["id"], ("student",))
    v = row(ctx, "essay_versions", ctx.params["vid"], "Version")
    need(v["essay_id"] == e["id"], "Version not found", 404)
    snapshot(ctx, e, "Before restore")
    ctx.db.execute("UPDATE essays SET content=?, updated=?, updated_by=? WHERE id=?", (v["content"], D.now(), ctx.user["id"], e["id"]))
    snapshot(ctx, dict(e, content=v["content"]), f"Restored version from {v['created'][:10]}")
    return get_essay(ctx)


@route("POST", "/api/essays/:id/comments")
def add_comment(ctx):
    e = essay_access(ctx, ctx.params["id"])
    b = ctx.body
    body = text(b.get("body"), 3000, True, "Comment")
    parent = b.get("parent_id")
    start = end = quote = None
    if parent:
        need(row(ctx, "comments", parent)["essay_id"] == e["id"], "Bad parent")
    else:
        quote = text(b.get("quote"), 2000)
        start, end = b.get("start"), b.get("end")
        if quote:
            start = intval(start, 0, name="start")
            end = intval(end, start, name="end")
    ctx.db.execute('INSERT INTO comments(essay_id,parent_id,author_id,start,"end",quote,body,resolved,created) VALUES(?,?,?,?,?,?,?,?,?)',
                   (e["id"], parent, ctx.user["id"], start, end, quote, body, 0, D.now()))
    D.log(ctx.db, e["student_id"], ctx.user["id"], "comment", f"commented on '{e['title']}'")
    return get_essay(ctx)


@route("PATCH", "/api/comments/:id")
def patch_comment(ctx):
    c = row(ctx, "comments", ctx.params["id"], "Comment")
    e = essay_access(ctx, c["essay_id"])
    if "resolved" in ctx.body:
        ctx.db.execute("UPDATE comments SET resolved=? WHERE id=? OR parent_id=?", (1 if ctx.body["resolved"] else 0, c["id"], c["id"]))
    if "body" in ctx.body:
        need(c["author_id"] == ctx.user["id"], "You can only edit your own comments", 403)
        ctx.db.execute("UPDATE comments SET body=? WHERE id=?", (text(ctx.body["body"], 3000, True, "Comment"), c["id"]))
    ctx.params["id"] = e["id"]
    return get_essay(ctx)


@route("DELETE", "/api/comments/:id")
def del_comment(ctx):
    c = row(ctx, "comments", ctx.params["id"], "Comment")
    e = essay_access(ctx, c["essay_id"])
    need(c["author_id"] == ctx.user["id"] or ctx.user["role"] == "counsellor", "You can only delete your own comments", 403)
    ctx.db.execute("DELETE FROM comments WHERE id=? OR parent_id=?", (c["id"], c["id"]))
    ctx.params["id"] = e["id"]
    return get_essay(ctx)


@route("POST", "/api/essays/:id/suggestions")
def add_suggestion(ctx):
    e = essay_access(ctx, ctx.params["id"], ("editor", "counsellor"))
    b = ctx.body
    orig = text(b.get("original"), 5000, True, "Original text")
    rep = text(b.get("replacement"), 5000)
    start = e["content"].find(orig, max(0, intval(b.get("start") or 0, 0, name="start") - 5))
    if start < 0:
        start = e["content"].find(orig)
    need(start >= 0, "That text is no longer in the essay. Reload and try again.", 409)
    ctx.db.execute("INSERT INTO suggestions(essay_id,author_id,start,original,replacement,note,status,created) VALUES(?,?,?,?,?,?,?,?)",
                   (e["id"], ctx.user["id"], start, orig, rep, text(b.get("note"), 500), "pending", D.now()))
    D.log(ctx.db, e["student_id"], ctx.user["id"], "suggestion", f"suggested an edit on '{e['title']}'")
    return get_essay(ctx)


@route("POST", "/api/suggestions/:id/:action")
def resolve_suggestion(ctx):
    s = row(ctx, "suggestions", ctx.params["id"], "Suggestion")
    act = ctx.params["action"]
    need(act in ("accept", "reject", "withdraw"), "Bad action", 404)
    e = essay_access(ctx, s["essay_id"])
    need(s["status"] == "pending", "Suggestion already resolved", 409)
    if act == "withdraw":
        need(s["author_id"] == ctx.user["id"], "Only the author can withdraw", 403)
        ctx.db.execute("DELETE FROM suggestions WHERE id=?", (s["id"],))
    else:
        need(ctx.user["role"] == "student", "Only the student can accept or reject suggestions", 403)
        if act == "accept":
            c = e["content"]
            i = c.find(s["original"], max(0, s["start"] - 20))
            if i < 0:
                i = c.find(s["original"])
            need(i >= 0, "The text this edit refers to has changed, so it can no longer be applied. Reject it and ask for a new suggestion.", 409)
            snapshot(ctx, e, "Before accepting a suggestion")
            new = c[:i] + s["replacement"] + c[i + len(s["original"]):]
            ctx.db.execute("UPDATE essays SET content=?, updated=?, updated_by=? WHERE id=?", (new, D.now(), ctx.user["id"], e["id"]))
            snapshot(ctx, dict(e, content=new), "Accepted a suggestion")
            ctx.db.execute("UPDATE suggestions SET status='accepted' WHERE id=?", (s["id"],))
        else:
            ctx.db.execute("UPDATE suggestions SET status='rejected' WHERE id=?", (s["id"],))
    ctx.params["id"] = e["id"]
    return get_essay(ctx)


# ------------------------------------------------------------------ colleges
@route("GET", "/api/catalog")
def catalog(ctx):
    q = "%" + ctx.query.get("q", "").strip() + "%"
    return {"colleges": [dict(r) for r in ctx.db.execute("SELECT * FROM catalog WHERE name LIKE ? OR state LIKE ? OR city LIKE ? ORDER BY accept", (q, q, q))]}


@route("GET", "/api/s/:sid/colleges")
def list_colleges(ctx):
    access(ctx, ctx.params["sid"])
    return {"colleges": D.colleges_for(ctx.db, int(ctx.params["sid"])), "sat": D.best_sat(ctx.db, int(ctx.params["sid"]))}


ROUNDS = ("ED", "ED II", "EA", "REA", "RD", "Rolling")
STATUSES = ("Researching", "Planned", "In progress", "Submitted", "Admitted", "Waitlisted", "Denied", "Withdrawn")


@route("POST", "/api/s/:sid/colleges")
def add_college(ctx):
    access(ctx, ctx.params["sid"], ("student", "counsellor"))
    sid = int(ctx.params["sid"])
    b = ctx.body
    cat = None
    if b.get("catalog_id"):
        cat = row(ctx, "catalog", b["catalog_id"], "College")
        need(not ctx.db.execute("SELECT 1 FROM student_colleges WHERE student_id=? AND catalog_id=?", (sid, cat["id"])).fetchone(), "Already on the list", 409)
        name = cat["name"]
    else:
        name = text(b.get("name"), 150, True, "College name")
    rnd = b.get("round") or ("EA" if cat and cat["early_type"] == "EA" else "RD")
    need(rnd in ROUNDS, "Bad round")
    dl = date_or_none(b.get("deadline")) or (cat["early"] if cat and rnd in ("ED", "EA", "REA") and cat["early"] else (cat["rd"] if cat else None))
    cid = ctx.db.execute("INSERT INTO student_colleges(student_id,catalog_id,name,category,round,deadline,status,notes,added) VALUES(?,?,?,?,?,?,?,?,?)",
                         (sid, cat["id"] if cat else None, name, None, rnd, dl, "Researching", "", D.now())).lastrowid
    if dl:
        ctx.db.execute("INSERT INTO tasks(student_id,title,due,category,college_id,created_by,created) VALUES(?,?,?,?,?,?,?)",
                       (sid, f"Submit {name} application ({rnd})", dl, "Application", cid, ctx.user["id"], D.now()))
    D.log(ctx.db, sid, ctx.user["id"], "college", f"added {name} to the college list")
    return {"id": cid}


@route("PUT", "/api/colleges/:id")
def put_college(ctx):
    c = row(ctx, "student_colleges", ctx.params["id"], "College")
    access(ctx, c["student_id"], ("student", "counsellor"))
    b = ctx.body
    f = {"category": lambda v: v if v in ("Reach", "Target", "Safety") else None,
         "round": lambda v: v if v in ROUNDS else (_ for _ in ()).throw(ApiError(400, "Bad round")),
         "deadline": date_or_none,
         "status": lambda v: v if v in STATUSES else (_ for _ in ()).throw(ApiError(400, "Bad status")),
         "notes": lambda v: text(v, 3000)}
    update(ctx, "student_colleges", c["id"], b, f)
    if "deadline" in b or "round" in b:
        nd = date_or_none(b.get("deadline")) if "deadline" in b else c["deadline"]
        ctx.db.execute("UPDATE tasks SET due=? WHERE college_id=? AND category='Application' AND done=0", (nd, c["id"]))
    if b.get("status") == "Submitted":
        ctx.db.execute("UPDATE tasks SET done=1, done_at=? WHERE college_id=? AND category='Application' AND done=0", (D.now(), c["id"]))
        D.log(ctx.db, c["student_id"], ctx.user["id"], "college", f"submitted the application to {c['name']}")
    return {"ok": True}


@route("DELETE", "/api/colleges/:id")
def del_college(ctx):
    c = row(ctx, "student_colleges", ctx.params["id"], "College")
    access(ctx, c["student_id"], ("student", "counsellor"))
    ctx.db.execute("DELETE FROM tasks WHERE college_id=? AND done=0", (c["id"],))
    ctx.db.execute("UPDATE tasks SET college_id=NULL WHERE college_id=?", (c["id"],))
    ctx.db.execute("UPDATE essays SET college_id=NULL WHERE college_id=?", (c["id"],))
    ctx.db.execute("DELETE FROM student_colleges WHERE id=?", (c["id"],))
    return {"ok": True}


# ------------------------------------------------------------------ tasks
TASK_CATS = ("General", "Application", "Essay", "Profile", "Testing", "Recommendations", "College list", "Financial aid")


@route("GET", "/api/s/:sid/tasks")
def list_tasks(ctx):
    access(ctx, ctx.params["sid"])
    rows = ctx.db.execute("SELECT t.*, (SELECT name FROM student_colleges WHERE id=t.college_id) college, (SELECT name FROM users WHERE id=t.created_by) creator FROM tasks t WHERE student_id=? ORDER BY done, COALESCE(due,'9999'), id", (ctx.params["sid"],))
    return {"tasks": [dict(r) for r in rows]}


@route("POST", "/api/s/:sid/tasks")
def add_task(ctx):
    access(ctx, ctx.params["sid"])
    b = ctx.body
    cat = b.get("category") or "General"
    need(cat in TASK_CATS, "Bad category")
    cid = b.get("college_id") or None
    cur = ctx.db.execute("INSERT INTO tasks(student_id,title,due,category,college_id,created_by,created) VALUES(?,?,?,?,?,?,?)",
                         (ctx.params["sid"], text(b.get("title"), 200, True, "Title"), date_or_none(b.get("due")), cat, cid, ctx.user["id"], D.now()))
    D.log(ctx.db, ctx.params["sid"], ctx.user["id"], "task", f"added task '{text(b.get('title'))}'")
    return {"id": cur.lastrowid}


@route("PUT", "/api/tasks/:id")
def put_task(ctx):
    t = row(ctx, "tasks", ctx.params["id"], "Task")
    access(ctx, t["student_id"])
    b = ctx.body
    update(ctx, "tasks", t["id"], b, {"title": lambda v: text(v, 200, True, "Title"), "due": date_or_none,
                                      "category": lambda v: v if v in TASK_CATS else (_ for _ in ()).throw(ApiError(400, "Bad category"))})
    if "done" in b:
        ctx.db.execute("UPDATE tasks SET done=?, done_at=? WHERE id=?", (1 if b["done"] else 0, D.now() if b["done"] else None, t["id"]))
        if b["done"]:
            D.log(ctx.db, t["student_id"], ctx.user["id"], "task", f"completed '{t['title']}'")
    return {"ok": True}


@route("DELETE", "/api/tasks/:id")
def del_task(ctx):
    t = row(ctx, "tasks", ctx.params["id"], "Task")
    access(ctx, t["student_id"])
    ctx.db.execute("DELETE FROM tasks WHERE id=?", (t["id"],))
    return {"ok": True}


# ------------------------------------------------------------------ recommendations
REC_STATUS = ("Not asked", "Requested", "In progress", "Submitted", "Declined")


@route("GET", "/api/s/:sid/recs")
def list_recs(ctx):
    access(ctx, ctx.params["sid"])
    return {"recs": [dict(r) for r in ctx.db.execute("SELECT * FROM recs WHERE student_id=? ORDER BY id", (ctx.params["sid"],))]}


def rec_fields():
    return {"name": lambda v: text(v, 120, True, "Name"), "kind": lambda v: text(v, 40), "subject": lambda v: text(v, 120), "email": lambda v: text(v, 200),
            "status": lambda v: v if v in REC_STATUS else (_ for _ in ()).throw(ApiError(400, "Bad status")),
            "requested": date_or_none, "due": date_or_none, "colleges": lambda v: text(v, 500), "notes": lambda v: text(v, 2000)}


@route("POST", "/api/s/:sid/recs")
def add_rec(ctx):
    access(ctx, ctx.params["sid"], ("student", "counsellor"))
    b = ctx.body
    text(b.get("name"), 120, True, "Name")
    cur = ctx.db.execute("INSERT INTO recs(student_id,name) VALUES(?,?)", (ctx.params["sid"], b["name"].strip()))
    update(ctx, "recs", cur.lastrowid, b, rec_fields())
    D.log(ctx.db, ctx.params["sid"], ctx.user["id"], "rec", f"added recommender {b['name'].strip()}")
    return {"id": cur.lastrowid}


@route("PUT", "/api/recs/:id")
def put_rec(ctx):
    r = row(ctx, "recs", ctx.params["id"], "Recommender")
    access(ctx, r["student_id"], ("student", "counsellor"))
    update(ctx, "recs", r["id"], ctx.body, rec_fields())
    if ctx.body.get("status") == "Requested" and not r["requested"] and "requested" not in ctx.body:
        ctx.db.execute("UPDATE recs SET requested=? WHERE id=?", (D.today().isoformat(), r["id"]))
    if ctx.body.get("status") and ctx.body["status"] != r["status"]:
        D.log(ctx.db, r["student_id"], ctx.user["id"], "rec", f"{r['name']}: recommendation {ctx.body['status'].lower()}")
    return {"ok": True}


@route("DELETE", "/api/recs/:id")
def del_rec(ctx):
    r = row(ctx, "recs", ctx.params["id"], "Recommender")
    access(ctx, r["student_id"], ("student", "counsellor"))
    ctx.db.execute("DELETE FROM recs WHERE id=?", (r["id"],))
    return {"ok": True}


# ------------------------------------------------------------------ SAT
@route("GET", "/api/sat/static")
def sat_static(ctx):
    secs = {k: {"title": v["title"], "minutes": v["minutes"],
                "questions": [{kk: vv for kk, vv in q.items() if kk not in ("answer", "why")} for q in v["questions"]]} for k, v in satdata.SECTIONS.items()}
    return {"plans": satdata.PLANS, "resources": satdata.RESOURCES, "dates": satdata.TEST_DATES, "sections": secs}


def kvget(ctx, sid, key, default=None):
    r = ctx.db.execute("SELECT value FROM kv WHERE student_id=? AND key=?", (sid, key)).fetchone()
    return r["value"] if r else default


@route("GET", "/api/s/:sid/sat")
def sat_state(ctx):
    access(ctx, ctx.params["sid"])
    sid = int(ctx.params["sid"])
    scores = [dict(r) for r in ctx.db.execute("SELECT * FROM sat_scores WHERE student_id=? ORDER BY date, id", (sid,))]
    att = [dict(r) for r in ctx.db.execute("SELECT id,section,date,correct,total FROM attempts WHERE student_id=? ORDER BY id DESC LIMIT 20", (sid,))]
    return {"scores": scores, "attempts": att, "target": kvget(ctx, sid, "sat_target"), "plan": kvget(ctx, sid, "sat_plan"),
            "progress": json.loads(kvget(ctx, sid, "sat_progress", "{}")), "test_date": kvget(ctx, sid, "sat_test_date")}


@route("PUT", "/api/s/:sid/sat/state")
def sat_put_state(ctx):
    access(ctx, ctx.params["sid"], ("student", "counsellor"))
    sid, b = int(ctx.params["sid"]), ctx.body
    def put(k, v):
        ctx.db.execute("INSERT OR REPLACE INTO kv VALUES(?,?,?)", (sid, k, v))
    if "target" in b:
        put("sat_target", str(intval(b["target"], 400, 1600, "Target")) if b["target"] not in ("", None) else "")
    if "plan" in b:
        need(b["plan"] in {p["id"] for p in satdata.PLANS} or b["plan"] == "", "Unknown plan")
        put("sat_plan", b["plan"])
    if "progress" in b:
        need(isinstance(b["progress"], dict) and len(json.dumps(b["progress"])) < 20000, "Bad progress")
        put("sat_progress", json.dumps(b["progress"]))
    if "test_date" in b:
        put("sat_test_date", date_or_none(b["test_date"]) or "")
    return sat_state(ctx)


@route("POST", "/api/s/:sid/sat/scores")
def sat_add_score(ctx):
    access(ctx, ctx.params["sid"], ("student", "counsellor"))
    b = ctx.body
    kind = b.get("kind", "practice")
    need(kind in ("practice", "official"), "Bad kind")
    rw, m = intval(b.get("rw"), 200, 800, "Reading & Writing"), intval(b.get("math"), 200, 800, "Math")
    ctx.db.execute("INSERT INTO sat_scores(student_id,kind,date,total,rw,math,note) VALUES(?,?,?,?,?,?,?)",
                   (ctx.params["sid"], kind, date_or_none(b.get("date")) or D.today().isoformat(), rw + m, rw, m, text(b.get("note"), 300)))
    D.log(ctx.db, ctx.params["sid"], ctx.user["id"], "sat", f"logged a {kind} SAT score of {rw + m}")
    return sat_state(ctx)


@route("DELETE", "/api/sat/scores/:id")
def sat_del_score(ctx):
    r = row(ctx, "sat_scores", ctx.params["id"], "Score")
    access(ctx, r["student_id"], ("student", "counsellor"))
    ctx.db.execute("DELETE FROM sat_scores WHERE id=?", (r["id"],))
    ctx.params["sid"] = r["student_id"]
    return sat_state(ctx)


@route("POST", "/api/s/:sid/sat/practice")
def sat_practice(ctx):
    access(ctx, ctx.params["sid"], ("student",))
    sec = satdata.SECTIONS.get(ctx.body.get("section"))
    need(sec, "Unknown section")
    ans = ctx.body.get("answers") or {}
    review, correct = [], 0
    for q in sec["questions"]:
        given = ans.get(q["id"])
        if q.get("type") == "free":
            ok = str(given or "").strip().replace(" ", "") == q["answer"]
            right = q["answer"]
        else:
            ok = given is not None and str(given).isdigit() and int(given) == q["answer"]
            right = q["choices"][q["answer"]]
        correct += ok
        review.append({"id": q["id"], "ok": ok, "given": given, "right": right, "right_index": q["answer"] if q.get("type") != "free" else None, "why": q["why"], "skill": q["skill"]})
    ctx.db.execute("INSERT INTO attempts(student_id,section,date,correct,total,detail) VALUES(?,?,?,?,?,?)",
                   (ctx.params["sid"], ctx.body["section"], D.today().isoformat(), correct, len(sec["questions"]), json.dumps(review)))
    D.log(ctx.db, ctx.params["sid"], ctx.user["id"], "sat", f"completed '{sec['title']}': {correct}/{len(sec['questions'])}")
    return {"correct": correct, "total": len(sec["questions"]), "review": review}


# ------------------------------------------------------------------ messages
@route("GET", "/api/s/:sid/messages")
def get_messages(ctx):
    access(ctx, ctx.params["sid"])
    ch = ctx.query.get("channel", "team")
    need(ch in ("team", "staff"), "Bad channel")
    need(ch == "team" or ctx.user["role"] != "student", "Staff only", 403)
    after = intval(ctx.query.get("after") or 0, 0, name="after")
    rows = [dict(r) for r in ctx.db.execute("SELECT m.*, u.name sender, u.role role FROM messages m JOIN users u ON u.id=m.sender_id WHERE student_id=? AND channel=? AND m.id>? ORDER BY m.id", (ctx.params["sid"], ch, after))]
    if rows:
        ctx.db.execute("INSERT OR REPLACE INTO reads VALUES(?,?,?,?)", (ctx.user["id"], ctx.params["sid"], ch, max(r["id"] for r in rows)))
    return {"messages": rows}


@route("POST", "/api/s/:sid/messages")
def post_message(ctx):
    access(ctx, ctx.params["sid"])
    ch = ctx.body.get("channel", "team")
    need(ch in ("team", "staff"), "Bad channel")
    need(ch == "team" or ctx.user["role"] != "student", "Staff only", 403)
    cur = ctx.db.execute("INSERT INTO messages(student_id,channel,sender_id,body,created) VALUES(?,?,?,?,?)",
                         (ctx.params["sid"], ch, ctx.user["id"], text(ctx.body.get("body"), 5000, True, "Message"), D.now()))
    ctx.db.execute("INSERT OR REPLACE INTO reads VALUES(?,?,?,?)", (ctx.user["id"], ctx.params["sid"], ch, cur.lastrowid))
    return {"id": cur.lastrowid}


@route("GET", "/api/unread")
def unread(ctx):
    u = ctx.user
    ids = [u["id"]] if u["role"] == "student" else [r[0] for r in ctx.db.execute("SELECT student_id FROM assign WHERE staff_id=?", (u["id"],))]
    out = {}
    for sid in ids:
        n = 0
        for ch in ("team", "staff"):
            if ch == "staff" and u["role"] == "student":
                continue
            last = ctx.db.execute("SELECT last_id FROM reads WHERE user_id=? AND student_id=? AND channel=?", (u["id"], sid, ch)).fetchone()
            n += ctx.db.execute("SELECT COUNT(*) FROM messages WHERE student_id=? AND channel=? AND id>? AND sender_id!=?", (sid, ch, last[0] if last else 0, u["id"])).fetchone()[0]
        out[sid] = n
    return {"unread": out}


@route("GET", "/api/s/:sid/activity")
def activity(ctx):
    access(ctx, ctx.params["sid"])
    return {"events": [dict(r) for r in ctx.db.execute("SELECT e.*, u.name actor FROM events e LEFT JOIN users u ON u.id=e.actor_id WHERE student_id=? ORDER BY e.id DESC LIMIT 60", (ctx.params["sid"],))]}


# ------------------------------------------------------------------ HTTP
SEC_HEADERS = {
    "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "same-origin",
    "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'",
}


class Handler(BaseHTTPRequestHandler):
    server_version = "CollegeCounsel/1.0"

    def log_message(self, fmt, *a):
        if "--quiet" not in sys.argv:
            sys.stderr.write("%s %s\n" % (self.command, self.path))

    def send_json(self, status, obj):
        data = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        for k, v in SEC_HEADERS.items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def handle_api(self, method):
        u = urlparse(self.path)
        query = {k: v[0] for k, v in parse_qs(u.query).items()}
        body = {}
        if method in ("POST", "PUT", "PATCH"):
            n = int(self.headers.get("Content-Length") or 0)
            if n > 2_000_000:
                return self.send_json(413, {"error": "Request too large"})
            if n:
                try:
                    body = json.loads(self.rfile.read(n))
                    assert isinstance(body, dict)
                except Exception:
                    return self.send_json(400, {"error": "Invalid JSON"})
        conn = D.connect()
        try:
            for m, rx, fn, auth in ROUTES:
                mt = rx.match(u.path)
                if m != method or not mt:
                    continue
                user = None
                if auth:
                    tok = (self.headers.get("Authorization") or "").removeprefix("Bearer ").strip()
                    user = conn.execute("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?", (tok, time.time())).fetchone()
                    if not user:
                        return self.send_json(401, {"error": "Please sign in again"})
                    query["_token"] = tok
                try:
                    res = fn(Ctx(conn, user, body, dict(mt.groupdict()), query))
                    conn.commit()
                    return self.send_json(200, res)
                except ApiError as e:
                    conn.rollback()
                    return self.send_json(e.status, {"error": e.msg})
            return self.send_json(404, {"error": "Not found"})
        except Exception as e:  # pragma: no cover
            conn.rollback()
            import traceback
            traceback.print_exc()
            return self.send_json(500, {"error": "Server error: " + str(e)})
        finally:
            conn.close()

    def do_GET(self):
        if self.path.startswith("/api/"):
            return self.handle_api("GET")
        path = urlparse(self.path).path
        if path == "/":
            path = "/index.html"
        f = (STATIC / path.lstrip("/")).resolve()
        if not str(f).startswith(str(STATIC.resolve())) or not f.is_file():
            f = STATIC / "index.html" if "." not in Path(path).name else None
        if not f:
            self.send_response(404)
            self.end_headers()
            return
        data = f.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", (mimetypes.guess_type(f.name)[0] or "application/octet-stream") + ("; charset=utf-8" if f.suffix in (".html", ".js", ".css") else ""))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        for k, v in SEC_HEADERS.items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self): self.handle_api("POST")
    def do_PUT(self): self.handle_api("PUT")
    def do_PATCH(self): self.handle_api("PATCH")
    def do_DELETE(self): self.handle_api("DELETE")


def main():
    import os
    port = int(next((a for a in sys.argv[1:] if a.isdigit()), os.environ.get("PORT", 8200)))
    host = os.environ.get("HOST", "127.0.0.1")
    fresh = not D.DB_PATH.exists()
    D.init_db()
    c = D.connect()
    if not c.execute("SELECT 1 FROM users LIMIT 1").fetchone():
        admin_email, admin_pw = os.environ.get("CC_ADMIN_EMAIL"), os.environ.get("CC_ADMIN_PASSWORD")
        if admin_email and admin_pw:  # production: no demo data, just one counsellor account
            D.seed_catalog(c)
            h, s_, i = D.hash_pw(admin_pw)
            c.execute("INSERT INTO users(email,name,role,pw_hash,salt,iters,created) VALUES(?,?,?,?,?,?,?)", (admin_email.lower(), os.environ.get("CC_ADMIN_NAME", "Counsellor"), "counsellor", h, s_, i, D.now()))
            print("Created counsellor account", admin_email)
        else:
            seed(c)
            print(f"Seeded demo data. All demo passwords: {DEMO_PASSWORD}")
    c.commit()
    c.close()
    srv = ThreadingHTTPServer((host, port), Handler)
    print(f"College counselling app on http://{host}:{port}")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
