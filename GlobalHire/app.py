"""GlobalHire local development server.

Run this file from PyCharm. Flask serves the built premium UI and the SQLite API.
"""
from __future__ import annotations

import os
import sqlite3
from functools import wraps
from pathlib import Path
from typing import Any, Callable

from flask import Flask, g, jsonify, request, send_from_directory, session
from werkzeug.security import (
    check_password_hash,
    generate_password_hash,
)

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("GLOBALHIRE_DB", BASE_DIR / "globalhire.db"))
DIST_DIR = BASE_DIR / "dist"

app = Flask(__name__, static_folder=None)
app.secret_key = os.environ.get("GLOBALHIRE_SECRET", "local-dev-secret-change-before-deployment")
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax", SESSION_COOKIE_SECURE=False)

SAMPLE_COMPANIES = [
    ("northstar-labs", "Northstar Labs", "Technology", "London, UK", "northstarlabs.example", "Technology · 240 people", "N", "peach", "Northstar Labs is an illustrative sample company building calm, useful software for people doing ambitious work."),
    ("cloudline", "Cloudline", "Software", "Remote-first · Europe", "cloudline.example", "Software · 860 people", "C", "blue", "Cloudline is a fictional sample software team included to demonstrate the GlobalHire experience."),
    ("kinfolk", "Kinfolk", "People & Culture", "Amsterdam, NL", "kinfolk.example", "People & Culture · 120 people", "K", "green", "Kinfolk is a fictional sample team that cares about thoughtful hiring and a welcoming workplace."),
    ("daybreak", "Daybreak", "Climate technology", "Berlin, DE", "daybreak.example", "Climate tech · 310 people", "D", "lavender", "Daybreak is a fictional sample climate technology company focused on practical climate insights."),
]

SAMPLE_JOBS = [
    ("product-designer", "Senior Product Designer", "Northstar Labs", "N", "peach", "London, UK · Hybrid", "£75k – £95k", "Full-time", "2h ago", "Design", "Hybrid", "Shape simple, thoughtful experiences for a product used by teams around the world. Partner closely with product and engineering to take ideas from early sketches to polished, accessible releases.", "Lead product design from discovery through delivery\nTurn customer insights into clear product direction\nWork closely with engineering and product partners", "5+ years of product design experience\nA portfolio showing shipped digital products\nConfident in research, prototyping, and design systems"),
    ("platform-engineer", "Software Engineer, Platform", "Cloudline", "C", "blue", "Remote · Europe", "€90k – €120k", "Full-time", "5h ago", "Engineering", "Remote", "Help build a dependable platform that makes modern infrastructure feel effortless. Own meaningful systems work and collaborate across a curious, distributed engineering team.", "Design and operate cloud services at scale\nImprove developer tooling and platform reliability\nDocument decisions and share technical context", "Strong experience with cloud-native systems\nComfort working with distributed teams\nA practical approach to reliability and security"),
    ("people-partner", "People & Talent Partner", "Kinfolk", "K", "green", "Amsterdam, NL · Hybrid", "€65k – €82k", "Full-time", "1d ago", "People", "Hybrid", "Create an excellent, human hiring experience while helping a growing team find its next colleagues. Blend thoughtful talent partnership with hands-on recruiting.", "Partner with leaders on hiring plans\nBuild an inclusive candidate experience\nUse recruiting insights to improve the process", "Experience in talent acquisition or people operations\nClear, considerate communication\nComfort balancing priorities in a growing company"),
    ("climate-analyst", "Climate Data Analyst", "Daybreak", "D", "lavender", "Berlin, DE · Hybrid", "€58k – €72k", "Full-time", "2d ago", "Data", "Hybrid", "Turn complex climate data into useful insights for businesses making better decisions. Work with an interdisciplinary team building practical climate tools.", "Build clear and trusted data reports\nExplore data quality and measurement methods\nShare insights with product and customer teams", "Experience with SQL and analytical tools\nInterest in climate impact and data quality\nStrong storytelling with data"),
    ("customer-success", "Customer Success Manager", "Northstar Labs", "N", "peach", "Toronto, CA · Remote", "CA$82k – CA$105k", "Full-time", "3d ago", "Customer Success", "Remote", "Help customers get lasting value from tools that improve how their teams work. Build trusted relationships and bring customer insight back to the product team.", "Guide new customers through onboarding\nBuild success plans around customer goals\nIdentify patterns and share feedback with product", "Experience in customer success or consulting\nComfort managing customer relationships\nClear written and spoken communication"),
    ("marketing-lead", "Growth Marketing Lead", "Cloudline", "C", "blue", "Singapore · On-site", "S$105k – S$135k", "Full-time", "4d ago", "Marketing", "On-site", "Build thoughtful campaigns that introduce more teams to dependable cloud tools. Shape the growth roadmap with a small, collaborative team.", "Plan multi-channel marketing experiments\nMeasure campaign performance and learn quickly\nPartner with product on launch storytelling", "Experience running B2B growth campaigns\nStrong analytical and creative judgment\nComfortable owning projects end to end"),
]


def connect_db() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = connect_db()
    db.executescript("""
        CREATE TABLE IF NOT EXISTS profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'candidate' CHECK(role IN ('candidate','recruiter','admin')),
            headline TEXT NOT NULL DEFAULT '',
            location TEXT NOT NULL DEFAULT '',
            bio TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS companies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT UNIQUE,
            owner_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            industry TEXT NOT NULL DEFAULT '',
            headquarters TEXT NOT NULL DEFAULT '',
            website TEXT NOT NULL DEFAULT '',
            description TEXT NOT NULL DEFAULT '',
            verification_status TEXT NOT NULL DEFAULT 'pending' CHECK(verification_status IN ('pending','verified','rejected')),
            is_sample INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT UNIQUE,
            company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
            created_by INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
            title TEXT NOT NULL,
            location TEXT NOT NULL DEFAULT '',
            salary TEXT NOT NULL DEFAULT 'Salary not listed',
            employment_type TEXT NOT NULL DEFAULT 'Full-time',
            posted TEXT NOT NULL DEFAULT 'Recently posted',
            category TEXT NOT NULL DEFAULT 'Opportunity',
            work_mode TEXT NOT NULL DEFAULT 'Hybrid',
            description TEXT NOT NULL DEFAULT '',
            responsibilities TEXT NOT NULL DEFAULT '',
            requirements TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','closed','removed')),
            is_sample INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS saved_jobs (
            profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY(profile_id, job_id)
        );
        CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
            cover_letter TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'Applied' CHECK(status IN ('Applied','Under Review','Shortlisted','Interview Scheduled','Selected','Rejected','Offer Received')),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(profile_id, job_id)
        );
    """)
    company_ids: dict[str, int] = {}
    for slug, name, industry, hq, website, _field, _logo, _color, description in SAMPLE_COMPANIES:
        db.execute("""INSERT OR IGNORE INTO companies(slug,name,industry,headquarters,website,description,verification_status,is_sample)
                      VALUES(?,?,?,?,?,?, 'verified', 1)""", (slug,name,industry,hq,website,description))
        row = db.execute("SELECT id FROM companies WHERE slug=?", (slug,)).fetchone()
        company_ids[name] = row["id"]
    for row in SAMPLE_JOBS:
        (slug,title,company,logo,color,location,salary,emp,posted,category,mode,description,responsibilities,requirements) = row
        db.execute("""INSERT OR IGNORE INTO jobs(slug,company_id,title,location,salary,employment_type,posted,category,work_mode,description,responsibilities,requirements,status,is_sample)
                      VALUES(?,?,?,?,?,?,?,?,?,?,?,?, 'published', 1)""",
                   (slug,company_ids[company],title,location,salary,emp,posted,category,mode,description,responsibilities,requirements))
    db.commit()
    db.close()


def profile_for(user_id: int) -> sqlite3.Row | None:
    return get_db().execute("SELECT * FROM profiles WHERE id=?", (user_id,)).fetchone()


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        g.db = connect_db()
    return g.db


@app.teardown_appcontext
def close_db(_error: BaseException | None) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()


def user_payload(row: sqlite3.Row) -> dict[str, Any]:
    company = get_db().execute("SELECT name,website,headquarters,industry,verification_status FROM companies WHERE owner_id=? ORDER BY id LIMIT 1", (row["id"],)).fetchone()
    return {
        "id": row["id"], "email": row["email"], "role": row["role"],
        "full_name": row["full_name"], "headline": row["headline"],
        "location": row["location"], "bio": row["bio"],
        "company": dict(company) if company else None,
        "user_metadata": {"full_name": row["full_name"], "role": row["role"], "company_name": company["name"] if company else ""},
    }


def login_required(fn: Callable[..., Any]) -> Callable[..., Any]:
    @wraps(fn)
    def decorated(*args: Any, **kwargs: Any) -> Any:
        if not session.get("user_id"):
            return jsonify(error="Please sign in to continue."), 401
        g.current_user = profile_for(int(session["user_id"]))
        if g.current_user is None:
            session.clear()
            return jsonify(error="Please sign in to continue."), 401
        return fn(*args, **kwargs)
    return decorated


def require_role(*roles: str) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(fn)
        @login_required
        def wrapped(*args: Any, **kwargs: Any) -> Any:
            if g.current_user["role"] not in roles:
                return jsonify(error="You do not have access to this feature."), 403
            return fn(*args, **kwargs)
        return wrapped
    return decorator


def row_to_job(row: sqlite3.Row) -> dict[str, Any]:
    keys = set(row.keys())
    company = row["company_name"] if "company_name" in keys else "Company"
    logo = row["logo"] if "logo" in keys else (company[:1].upper() or "G")
    color = row["color"] if "color" in keys else "blue"
    return {
        "id": row["slug"] or str(row["id"]), "slug": row["slug"] or str(row["id"]),
        "db_id": row["id"], "title": row["title"], "company": company, "logo": logo,
        "color": color, "location": row["location"], "pay": row["salary"],
        "type": row["employment_type"], "posted": row["posted"], "tag": row["category"],
        "mode": row["work_mode"], "description": row["description"],
        "responsibilities": row["responsibilities"].splitlines(),
        "requirements": row["requirements"].splitlines(), "sample": bool(row["is_sample"]),
        "status": row["status"],
    }


def row_to_company(row: sqlite3.Row) -> dict[str, Any]:
    name = row["name"]
    return {"id": row["slug"] or str(row["id"]), "name": name, "industry": row["industry"],
            "field": row["field"] if "field" in row.keys() else row["industry"],
            "headquarters": row["headquarters"], "website": row["website"],
            "description": row["description"], "verification_status": row["verification_status"],
            "logo": row["logo"] if "logo" in row.keys() else name[:1].upper(),
            "color": row["color"] if "color" in row.keys() else "blue",
            "jobs": row["jobs"] if "jobs" in row.keys() else 0,
            "sample": bool(row["is_sample"])}


@app.get("/api/health")
def health() -> Any:
    return jsonify(status="ok", database=str(DB_PATH.name))


@app.post("/api/auth/register")
def register() -> Any:
    data = request.get_json(silent=True) or {}
    full_name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    role = data.get("role", "candidate")
    if len(full_name) < 2:
        return jsonify(error="Enter your full name."), 400
    if "@" not in email or len(email) > 254:
        return jsonify(error="Enter a valid email address."), 400
    if len(password) < 8:
        return jsonify(error="Use a password with at least 8 characters."), 400
    if role not in ("candidate", "recruiter"):
        return jsonify(error="Choose candidate or recruiter account."), 400
    company_name = str(data.get("companyName", "")).strip()
    if role == "recruiter" and (not company_name or not str(data.get("companyLocation", "")).strip()):
        return jsonify(error="Enter your company name and location."), 400
    db = get_db()
    try:
        password_hash = generate_password_hash(password)
        cursor = db.execute("INSERT INTO profiles(full_name,email,password_hash,role) VALUES(?,?,?,?)",
                            (full_name, email, password_hash, role))
        user_id = cursor.lastrowid
        if role == "recruiter":
            db.execute("INSERT INTO companies(owner_id,name,industry,headquarters,website,description,verification_status,is_sample) VALUES(?,?,?,?,?,?, 'pending',0)",
                       (user_id, company_name, str(data.get("industry", "")).strip(), str(data.get("companyLocation", "")).strip(), str(data.get("companyWebsite", "")).strip(), "Recruiter submitted company profile; verification pending."))
        db.commit()
    except sqlite3.IntegrityError:
        db.rollback()
        return jsonify(error="An account with that email already exists."), 409
    session.clear()
    session["user_id"] = user_id
    return jsonify(user=user_payload(profile_for(user_id))), 201


@app.post("/api/auth/login")
def login() -> Any:
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    row = get_db().execute("SELECT * FROM profiles WHERE email=?", (email,)).fetchone()
    if row is None or not check_password_hash(row["password_hash"], password):
        return jsonify(error="Email or password is incorrect."), 401
    session.clear()
    session["user_id"] = row["id"]
    return jsonify(user=user_payload(row))


@app.post("/api/auth/logout")
def logout() -> Any:
    session.clear()
    return jsonify(ok=True)


@app.post("/api/auth/forgot-password")
def forgot_password() -> Any:
    return jsonify(error="Password reset email is not configured in this local PyCharm version. Contact your platform administrator to reset the account."), 501


@app.get("/api/me")
def me() -> Any:
    user_id = session.get("user_id")
    if not user_id:
        return jsonify(user=None, role=None, saved=[])
    row = profile_for(int(user_id))
    if row is None:
        session.clear()
        return jsonify(user=None, role=None, saved=[])
    saved = [r["slug"] or str(r["id"]) for r in get_db().execute("SELECT j.id,j.slug FROM saved_jobs s JOIN jobs j ON j.id=s.job_id WHERE s.profile_id=?", (user_id,))]
    return jsonify(user=user_payload(row), role=row["role"], saved=saved)


@app.get("/api/jobs")
def list_jobs() -> Any:
    rows = get_db().execute("""SELECT j.*, c.name AS company_name,
        CASE c.name WHEN 'Northstar Labs' THEN 'N' WHEN 'Cloudline' THEN 'C' WHEN 'Kinfolk' THEN 'K' WHEN 'Daybreak' THEN 'D' ELSE substr(c.name,1,1) END AS logo,
        CASE c.name WHEN 'Northstar Labs' THEN 'peach' WHEN 'Cloudline' THEN 'blue' WHEN 'Kinfolk' THEN 'green' WHEN 'Daybreak' THEN 'lavender' ELSE 'blue' END AS color
        FROM jobs j LEFT JOIN companies c ON c.id=j.company_id WHERE j.status='published' ORDER BY j.is_sample DESC,j.created_at DESC""").fetchall()
    return jsonify(jobs=[row_to_job(r) for r in rows])


@app.get("/api/companies")
def list_companies() -> Any:
    rows = get_db().execute("""SELECT c.*, (SELECT count(*) FROM jobs j WHERE j.company_id=c.id AND j.status='published') AS jobs,
        CASE c.name WHEN 'Northstar Labs' THEN 'Technology · 240 people' WHEN 'Cloudline' THEN 'Software · 860 people' WHEN 'Kinfolk' THEN 'People & Culture · 120 people' WHEN 'Daybreak' THEN 'Climate tech · 310 people' ELSE c.industry END AS field,
        CASE c.name WHEN 'Northstar Labs' THEN 'N' WHEN 'Cloudline' THEN 'C' WHEN 'Kinfolk' THEN 'K' WHEN 'Daybreak' THEN 'D' ELSE substr(c.name,1,1) END AS logo,
        CASE c.name WHEN 'Northstar Labs' THEN 'peach' WHEN 'Cloudline' THEN 'blue' WHEN 'Kinfolk' THEN 'green' WHEN 'Daybreak' THEN 'lavender' ELSE 'blue' END AS color
        FROM companies c WHERE c.is_sample=1 OR c.verification_status='verified' ORDER BY c.is_sample DESC,c.name""").fetchall()
    return jsonify(companies=[row_to_company(r) for r in rows])


@app.route("/api/saved/<job_slug>", methods=["POST", "DELETE"])
@require_role("candidate")
def change_saved(job_slug: str) -> Any:
    db = get_db()
    job = db.execute("SELECT id FROM jobs WHERE slug=? AND status='published'", (job_slug,)).fetchone()
    if job is None:
        return jsonify(error="This role is no longer available."), 404
    if request.method == "POST":
        db.execute("INSERT OR IGNORE INTO saved_jobs(profile_id,job_id) VALUES(?,?)", (g.current_user["id"], job["id"]))
    else:
        db.execute("DELETE FROM saved_jobs WHERE profile_id=? AND job_id=?", (g.current_user["id"], job["id"]))
    db.commit()
    return jsonify(ok=True)


@app.route("/api/profile", methods=["GET", "PUT"])
@require_role("candidate", "recruiter", "admin")
def profile() -> Any:
    if request.method == "GET":
        return jsonify(profile=user_payload(g.current_user))
    data = request.get_json(silent=True) or {}
    name = str(data.get("full_name", "")).strip()
    if len(name) < 2:
        return jsonify(error="Enter your full name."), 400
    get_db().execute("UPDATE profiles SET full_name=?,headline=?,location=?,bio=? WHERE id=?",
                     (name, str(data.get("headline", "")).strip(), str(data.get("location", "")).strip(), str(data.get("bio", "")).strip(), g.current_user["id"]))
    get_db().commit()
    return jsonify(profile=user_payload(profile_for(g.current_user["id"])))


@app.post("/api/applications")
@require_role("candidate")
def apply() -> Any:
    data = request.get_json(silent=True) or {}
    slug = str(data.get("job_id", ""))
    job = get_db().execute("SELECT * FROM jobs WHERE slug=? AND status='published'", (slug,)).fetchone()
    if job is None:
        return jsonify(error="This role is not open for applications."), 404
    try:
        get_db().execute("INSERT INTO applications(profile_id,job_id,cover_letter) VALUES(?,?,?)",
                         (g.current_user["id"], job["id"], str(data.get("cover_letter", "")).strip()))
        get_db().commit()
    except sqlite3.IntegrityError:
        return jsonify(error="You have already applied to this role."), 409
    return jsonify(ok=True), 201


@app.get("/api/applications")
@require_role("candidate", "recruiter", "admin")
def applications() -> Any:
    user = g.current_user
    if user["role"] == "candidate":
        rows = get_db().execute("SELECT a.*,j.slug,j.title,j.is_sample,c.name AS company FROM applications a JOIN jobs j ON j.id=a.job_id LEFT JOIN companies c ON c.id=j.company_id WHERE a.profile_id=? ORDER BY a.created_at DESC", (user["id"],)).fetchall()
    else:
        rows = get_db().execute("SELECT a.*,j.slug,j.title,j.is_sample,c.name AS company,p.full_name AS candidate FROM applications a JOIN jobs j ON j.id=a.job_id JOIN companies c ON c.id=j.company_id LEFT JOIN profiles p ON p.id=a.profile_id WHERE c.owner_id=? ORDER BY a.created_at DESC", (user["id"],)).fetchall()
    return jsonify(applications=[dict(r) for r in rows])


@app.post("/api/recruiter/jobs")
@require_role("recruiter")
def create_recruiter_job() -> Any:
    data = request.get_json(silent=True) or {}
    title, location = str(data.get("title", "")).strip(), str(data.get("location", "")).strip()
    if not title or not location:
        return jsonify(error="Enter a job title and location."), 400
    company = get_db().execute("SELECT * FROM companies WHERE owner_id=? ORDER BY id LIMIT 1", (g.current_user["id"],)).fetchone()
    if not company:
        return jsonify(error="Add your company profile first."), 400
    slug = f"role-{g.current_user['id']}-{os.urandom(4).hex()}"
    db = get_db()
    db.execute("INSERT INTO jobs(slug,company_id,created_by,title,location,description,status,is_sample) VALUES(?,?,?,?,?,?, 'draft',0)",
               (slug, company["id"], g.current_user["id"], title, location, str(data.get("description", "")).strip() or f"{title} opportunity based in {location}."))
    db.commit()
    return jsonify(ok=True, status="draft", verification_status=company["verification_status"]), 201


@app.get("/api/recruiter/jobs")
@require_role("recruiter")
def recruiter_jobs() -> Any:
    rows = get_db().execute("SELECT j.*, c.name AS company_name FROM jobs j JOIN companies c ON c.id=j.company_id WHERE c.owner_id=? ORDER BY j.created_at DESC", (g.current_user["id"],)).fetchall()
    return jsonify(jobs=[row_to_job(r) for r in rows])


@app.get("/api/recruiter/company")
@require_role("recruiter")
def recruiter_company() -> Any:
    company = get_db().execute("SELECT * FROM companies WHERE owner_id=? ORDER BY id LIMIT 1", (g.current_user["id"],)).fetchone()
    return jsonify(company=dict(company) if company else None)


@app.get("/api/admin/overview")
@require_role("admin")
def admin_overview() -> Any:
    db = get_db()
    return jsonify(
        members=db.execute("SELECT count(*) AS n FROM profiles WHERE role='candidate'").fetchone()["n"],
        recruiters=db.execute("SELECT count(*) AS n FROM profiles WHERE role='recruiter'").fetchone()["n"],
        pending_companies=db.execute("SELECT count(*) AS n FROM companies WHERE verification_status='pending'").fetchone()["n"],
        draft_jobs=db.execute("SELECT count(*) AS n FROM jobs WHERE status='draft' AND is_sample=0").fetchone()["n"],
        applications=db.execute("SELECT count(*) AS n FROM applications").fetchone()["n"],
    )


@app.get("/api/admin/companies")
@require_role("admin")
def admin_companies() -> Any:
    rows = get_db().execute("SELECT c.*, p.full_name AS owner_name, p.email AS owner_email FROM companies c LEFT JOIN profiles p ON p.id=c.owner_id WHERE c.is_sample=0 ORDER BY CASE c.verification_status WHEN 'pending' THEN 0 ELSE 1 END, c.id DESC").fetchall()
    return jsonify(companies=[dict(row) for row in rows])


@app.post("/api/admin/companies/<int:company_id>/<action>")
@require_role("admin")
def review_company(company_id: int, action: str) -> Any:
    if action not in ("approve", "reject"):
        return jsonify(error="Choose approve or reject."), 400
    status = "verified" if action == "approve" else "rejected"
    cursor = get_db().execute("UPDATE companies SET verification_status=? WHERE id=? AND is_sample=0", (status, company_id))
    get_db().commit()
    if not cursor.rowcount:
        return jsonify(error="Company not found."), 404
    return jsonify(ok=True, verification_status=status)


@app.get("/api/admin/jobs")
@require_role("admin")
def admin_jobs() -> Any:
    rows = get_db().execute("SELECT j.*, c.name AS company_name, c.verification_status FROM jobs j JOIN companies c ON c.id=j.company_id WHERE j.is_sample=0 ORDER BY CASE j.status WHEN 'draft' THEN 0 ELSE 1 END, j.created_at DESC").fetchall()
    return jsonify(jobs=[dict(row) for row in rows])


@app.post("/api/admin/jobs/<slug>/<action>")
@require_role("admin")
def review_job(slug: str, action: str) -> Any:
    if action not in ("publish", "remove"):
        return jsonify(error="Choose publish or remove."), 400
    job = get_db().execute("SELECT j.id,j.status,c.verification_status FROM jobs j JOIN companies c ON c.id=j.company_id WHERE j.slug=? AND j.is_sample=0", (slug,)).fetchone()
    if job is None:
        return jsonify(error="Job listing not found."), 404
    if action == "publish" and job["verification_status"] != "verified":
        return jsonify(error="Approve the company before publishing its job listings."), 400
    status = "published" if action == "publish" else "removed"
    get_db().execute("UPDATE jobs SET status=? WHERE id=?", (status, job["id"]))
    get_db().commit()
    return jsonify(ok=True, status=status)


@app.get("/")
def index() -> Any:
    return send_from_directory(DIST_DIR, "index.html")


@app.get("/assets/<path:filename>")
def assets(filename: str) -> Any:
    return send_from_directory(DIST_DIR / "assets", filename)


@app.get("/favicon.svg")
def favicon() -> Any:
    return send_from_directory(DIST_DIR, "favicon.svg")


@app.get("/<path:path>")
def spa(path: str) -> Any:
    candidate = DIST_DIR / path
    if candidate.is_file():
        return send_from_directory(DIST_DIR, path)
    return send_from_directory(DIST_DIR, "index.html")


init_db()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "5000")), debug=True)
