from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import bcrypt
import jwt as pyjwt
import httpx
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Any, Dict

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


# ================= Database =================
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ================= App =================
app = FastAPI(title="SPV Monitoring API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("spv-app")

# ================= Auth Helpers =================
JWT_ALG = "HS256"

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id, "email": email, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
        "type": "access",
    }
    return pyjwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALG)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh",
    }
    return pyjwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALG)

def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=43200, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=604800, path="/")


async def get_current_user(request: Request) -> dict:
    # 1) Try Emergent session_token first (Google OAuth flow)
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            # Bearer could be either JWT access token or Emergent session_token; try session first
            candidate = auth[7:]
            sess = await db.user_sessions.find_one({"session_token": candidate}, {"_id": 0})
            if sess:
                session_token = candidate
    if session_token:
        sess = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if sess:
            exp = sess.get("expires_at")
            if isinstance(exp, str):
                exp = datetime.fromisoformat(exp)
            if exp and exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp and exp < datetime.now(timezone.utc):
                raise HTTPException(status_code=401, detail="Session expired")
            user = await db.users.find_one({"id": sess["user_id"]}, {"_id": 0, "password_hash": 0})
            if user:
                return user

    # 2) Fallback: JWT access token
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = pyjwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALG])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user.pop("_id", None)
        return user
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def require_spv(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in ("spv", "admin"):
        raise HTTPException(status_code=403, detail="SPV access required")
    return user


# ================= Models =================
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def new_id() -> str:
    return str(uuid.uuid4())


class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "anggota"  # spv | anggota
    division: Optional[str] = None

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class WorkspaceIn(BaseModel):
    name: str
    division: Optional[str] = None
    cycle: Optional[str] = "Q1 2026"
    owner_id: Optional[str] = None  # only SPV can set

class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    division: Optional[str] = None
    cycle: Optional[str] = None

class KeyResult(BaseModel):
    id: str = Field(default_factory=new_id)
    metric: str
    baseline: float = 0
    target: float = 0
    realisasi: float = 0
    unit: str = "%"
    confidence: str = "medium"  # high|medium|low
    deadline: Optional[str] = None
    comments: Optional[str] = None

class OKRIn(BaseModel):
    objective: str
    cycle: Optional[str] = "Q1 2026"
    key_results: List[KeyResult] = []
    spv_note: Optional[str] = None

class InitiativeIn(BaseModel):
    name: str
    output: Optional[str] = None
    linked_kr: Optional[str] = None
    status: str = "belum_mulai"  # belum_mulai|proses|selesai|terkendala
    percentage: float = 0
    deadline: Optional[str] = None
    comments: Optional[str] = None
    spv_note: Optional[str] = None

class TaskIn(BaseModel):
    name: str
    kategori: str = "RUTIN"  # RUTIN|TIDAK_RUTIN
    frekuensi: str = "HARIAN"  # SEKALI|HARIAN|MINGGUAN|BULANAN
    status: str = "BELUM_MULAI"  # BELUM_MULAI|ON_TRACKER|PROSES|SELESAI|TERKENDALA
    pemberi_tugas: Optional[str] = None
    waktu_mulai: Optional[str] = None
    batas_waktu: Optional[str] = None
    catatan_tim: Optional[str] = None
    catatan_spv: Optional[str] = None
    link_dokumen: Optional[str] = None

class HabitIn(BaseModel):
    name: str
    target_metric: Optional[str] = "Istiqomah > 40 hari"
    target_days: int = 40
    category: Optional[str] = "harian"
    spv_note: Optional[str] = None

class HabitLogIn(BaseModel):
    habit_id: str
    date: str  # YYYY-MM-DD
    completed: bool = True
    note: Optional[str] = None

class TaskLogIn(BaseModel):
    task_id: str
    date: str
    completed: bool = True
    note: Optional[str] = None


# ================= Auth endpoints =================
@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    if payload.role not in ("spv", "anggota"):
        raise HTTPException(status_code=400, detail="Role tidak valid")
    user_id = new_id()
    user_doc = {
        "id": user_id,
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "role": payload.role,
        "division": payload.division,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user_doc)
    # Create default workspace for the user
    ws_id = new_id()
    await db.workspaces.insert_one({
        "id": ws_id, "name": f"Workspace {payload.name}",
        "owner_id": user_id, "division": payload.division,
        "cycle": "Q1 2026", "created_at": now_iso(),
    })
    access = create_access_token(user_id, email, payload.role)
    refresh = create_refresh_token(user_id)
    set_auth_cookies(response, access, refresh)
    return {"id": user_id, "email": email, "name": payload.name, "role": payload.role, "division": payload.division, "access_token": access}


@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    access = create_access_token(user["id"], user["email"], user["role"])
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return {"id": user["id"], "email": user["email"], "name": user["name"], "role": user["role"], "division": user.get("division"), "access_token": access}


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    st = request.cookies.get("session_token")
    if st:
        await db.user_sessions.delete_one({"session_token": st})
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


class GoogleSessionIn(BaseModel):
    session_id: str


@api.post("/auth/google/session")
async def google_session(payload: GoogleSessionIn, response: Response):
    """Exchange Emergent session_id for a session_token, create/update user, set cookie."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client_http:
            r = await client_http.get(
                EMERGENT_SESSION_URL,
                headers={"X-Session-ID": payload.session_id},
            )
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Google session tidak valid")
        data = r.json()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=502, detail="Gagal menghubungi layanan Google Auth")

    email = (data.get("email") or "").lower()
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture")
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(status_code=400, detail="Data sesi tidak lengkap")

    admin_email = (os.environ.get("ADMIN_EMAIL") or "").lower()
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        upd: Dict[str, Any] = {"name": existing.get("name") or name, "picture": picture, "auth_provider": existing.get("auth_provider") or "google"}
        if email == admin_email and existing.get("role") != "spv":
            upd["role"] = "spv"
        await db.users.update_one({"id": existing["id"]}, {"$set": upd})
        user_id = existing["id"]
        role = upd.get("role", existing.get("role", "anggota"))
    else:
        user_id = new_id()
        role = "spv" if email == admin_email else "anggota"
        await db.users.insert_one({
            "id": user_id, "email": email, "name": name,
            "picture": picture, "role": role, "division": None,
            "auth_provider": "google", "created_at": now_iso(),
        })
        # Auto-create default workspace
        await db.workspaces.insert_one({
            "id": new_id(), "name": f"Workspace {name}",
            "owner_id": user_id, "division": None,
            "cycle": "Q1 2026", "created_at": now_iso(),
        })

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id, "session_token": session_token,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at.isoformat(),
    })
    response.set_cookie(
        "session_token", session_token,
        httponly=True, secure=True, samesite="none",
        max_age=7 * 24 * 3600, path="/",
    )
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return user


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ================= Users =================
@api.get("/users")
async def list_users(user: dict = Depends(require_spv)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return users


# ================= Workspaces =================
def _clean(doc: Dict[str, Any]) -> Dict[str, Any]:
    doc.pop("_id", None)
    return doc


async def _get_accessible_workspace(ws_id: str, user: dict) -> dict:
    ws = await db.workspaces.find_one({"id": ws_id}, {"_id": 0})
    if not ws:
        raise HTTPException(404, "Workspace tidak ditemukan")
    if user["role"] not in ("spv", "admin") and ws["owner_id"] != user["id"]:
        raise HTTPException(403, "Akses ditolak")
    return ws


@api.get("/workspaces")
async def list_workspaces(user: dict = Depends(get_current_user)):
    q = {} if user["role"] in ("spv", "admin") else {"owner_id": user["id"]}
    items = await db.workspaces.find(q, {"_id": 0}).to_list(500)
    # attach owner name
    owner_ids = list({i["owner_id"] for i in items})
    owners = {u["id"]: u async for u in db.users.find({"id": {"$in": owner_ids}}, {"_id": 0, "password_hash": 0})}
    for it in items:
        o = owners.get(it["owner_id"], {})
        it["owner_name"] = o.get("name")
        it["owner_email"] = o.get("email")
    return items


@api.post("/workspaces")
async def create_workspace(payload: WorkspaceIn, user: dict = Depends(get_current_user)):
    owner_id = user["id"]
    if user["role"] in ("spv", "admin") and payload.owner_id:
        owner_id = payload.owner_id
    ws = {
        "id": new_id(), "name": payload.name, "owner_id": owner_id,
        "division": payload.division, "cycle": payload.cycle or "Q1 2026",
        "created_at": now_iso(),
    }
    await db.workspaces.insert_one(ws)
    return _clean(ws)


@api.get("/workspaces/{ws_id}")
async def get_workspace(ws_id: str, user: dict = Depends(get_current_user)):
    ws = await _get_accessible_workspace(ws_id, user)
    owner = await db.users.find_one({"id": ws["owner_id"]}, {"_id": 0, "password_hash": 0})
    ws["owner"] = owner
    return ws


@api.patch("/workspaces/{ws_id}")
async def update_workspace(ws_id: str, payload: WorkspaceUpdate, user: dict = Depends(get_current_user)):
    await _get_accessible_workspace(ws_id, user)
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    if upd:
        await db.workspaces.update_one({"id": ws_id}, {"$set": upd})
    ws = await db.workspaces.find_one({"id": ws_id}, {"_id": 0})
    return ws


# ================= OKRs =================
@api.get("/workspaces/{ws_id}/okrs")
async def list_okrs(ws_id: str, user: dict = Depends(get_current_user)):
    await _get_accessible_workspace(ws_id, user)
    items = await db.okrs.find({"workspace_id": ws_id}, {"_id": 0}).to_list(200)
    return items


@api.post("/workspaces/{ws_id}/okrs")
async def create_okr(ws_id: str, payload: OKRIn, user: dict = Depends(get_current_user)):
    await _get_accessible_workspace(ws_id, user)
    doc = {
        "id": new_id(), "workspace_id": ws_id,
        "objective": payload.objective, "cycle": payload.cycle or "Q1 2026",
        "key_results": [kr.model_dump() for kr in payload.key_results],
        "spv_note": payload.spv_note,
        "created_at": now_iso(),
    }
    await db.okrs.insert_one(doc)
    return _clean(doc)


@api.patch("/okrs/{okr_id}")
async def update_okr(okr_id: str, payload: OKRIn, user: dict = Depends(get_current_user)):
    okr = await db.okrs.find_one({"id": okr_id}, {"_id": 0})
    if not okr:
        raise HTTPException(404, "OKR tidak ditemukan")
    await _get_accessible_workspace(okr["workspace_id"], user)
    upd = {
        "objective": payload.objective, "cycle": payload.cycle,
        "key_results": [kr.model_dump() for kr in payload.key_results],
        "spv_note": payload.spv_note,
    }
    await db.okrs.update_one({"id": okr_id}, {"$set": upd})
    doc = await db.okrs.find_one({"id": okr_id}, {"_id": 0})
    return doc


@api.delete("/okrs/{okr_id}")
async def delete_okr(okr_id: str, user: dict = Depends(get_current_user)):
    okr = await db.okrs.find_one({"id": okr_id})
    if not okr:
        raise HTTPException(404, "OKR tidak ditemukan")
    await _get_accessible_workspace(okr["workspace_id"], user)
    await db.okrs.delete_one({"id": okr_id})
    return {"ok": True}


# ================= Initiatives =================
@api.get("/workspaces/{ws_id}/initiatives")
async def list_initiatives(ws_id: str, user: dict = Depends(get_current_user)):
    await _get_accessible_workspace(ws_id, user)
    return await db.initiatives.find({"workspace_id": ws_id}, {"_id": 0}).to_list(500)


@api.post("/workspaces/{ws_id}/initiatives")
async def create_initiative(ws_id: str, payload: InitiativeIn, user: dict = Depends(get_current_user)):
    await _get_accessible_workspace(ws_id, user)
    doc = {"id": new_id(), "workspace_id": ws_id, **payload.model_dump(), "created_at": now_iso()}
    await db.initiatives.insert_one(doc)
    return _clean(doc)


@api.patch("/initiatives/{iid}")
async def update_initiative(iid: str, payload: InitiativeIn, user: dict = Depends(get_current_user)):
    it = await db.initiatives.find_one({"id": iid})
    if not it:
        raise HTTPException(404, "Initiative tidak ditemukan")
    await _get_accessible_workspace(it["workspace_id"], user)
    await db.initiatives.update_one({"id": iid}, {"$set": payload.model_dump()})
    doc = await db.initiatives.find_one({"id": iid}, {"_id": 0})
    return doc


@api.delete("/initiatives/{iid}")
async def delete_initiative(iid: str, user: dict = Depends(get_current_user)):
    it = await db.initiatives.find_one({"id": iid})
    if not it:
        raise HTTPException(404, "Initiative tidak ditemukan")
    await _get_accessible_workspace(it["workspace_id"], user)
    await db.initiatives.delete_one({"id": iid})
    return {"ok": True}


# ================= Tasks (Execution Scoreboard) =================
@api.get("/workspaces/{ws_id}/tasks")
async def list_tasks(ws_id: str, user: dict = Depends(get_current_user)):
    await _get_accessible_workspace(ws_id, user)
    return await db.tasks.find({"workspace_id": ws_id}, {"_id": 0}).to_list(1000)


@api.post("/workspaces/{ws_id}/tasks")
async def create_task(ws_id: str, payload: TaskIn, user: dict = Depends(get_current_user)):
    await _get_accessible_workspace(ws_id, user)
    doc = {"id": new_id(), "workspace_id": ws_id, **payload.model_dump(), "created_at": now_iso()}
    await db.tasks.insert_one(doc)
    return _clean(doc)


@api.patch("/tasks/{tid}")
async def update_task(tid: str, payload: TaskIn, user: dict = Depends(get_current_user)):
    t = await db.tasks.find_one({"id": tid})
    if not t:
        raise HTTPException(404, "Task tidak ditemukan")
    await _get_accessible_workspace(t["workspace_id"], user)
    await db.tasks.update_one({"id": tid}, {"$set": payload.model_dump()})
    return await db.tasks.find_one({"id": tid}, {"_id": 0})


@api.delete("/tasks/{tid}")
async def delete_task(tid: str, user: dict = Depends(get_current_user)):
    t = await db.tasks.find_one({"id": tid})
    if not t:
        raise HTTPException(404, "Task tidak ditemukan")
    await _get_accessible_workspace(t["workspace_id"], user)
    await db.tasks.delete_one({"id": tid})
    await db.task_logs.delete_many({"task_id": tid})
    return {"ok": True}


# Task logs (for recurring daily/weekly/monthly tasks)
@api.get("/workspaces/{ws_id}/task-logs")
async def list_task_logs(ws_id: str, start: Optional[str] = None, end: Optional[str] = None,
                         user: dict = Depends(get_current_user)):
    await _get_accessible_workspace(ws_id, user)
    q: Dict[str, Any] = {"workspace_id": ws_id}
    if start and end:
        q["date"] = {"$gte": start, "$lte": end}
    return await db.task_logs.find(q, {"_id": 0}).to_list(5000)


@api.post("/workspaces/{ws_id}/task-logs")
async def upsert_task_log(ws_id: str, payload: TaskLogIn, user: dict = Depends(get_current_user)):
    await _get_accessible_workspace(ws_id, user)
    doc = {
        "id": new_id(), "workspace_id": ws_id,
        "task_id": payload.task_id, "date": payload.date,
        "completed": payload.completed, "note": payload.note,
        "updated_at": now_iso(),
    }
    await db.task_logs.update_one(
        {"workspace_id": ws_id, "task_id": payload.task_id, "date": payload.date},
        {"$set": doc}, upsert=True,
    )
    return doc


# ================= Habits (Amaliyah Spiritual) =================
@api.get("/workspaces/{ws_id}/habits")
async def list_habits(ws_id: str, user: dict = Depends(get_current_user)):
    await _get_accessible_workspace(ws_id, user)
    return await db.habits.find({"workspace_id": ws_id}, {"_id": 0}).to_list(200)


@api.post("/workspaces/{ws_id}/habits")
async def create_habit(ws_id: str, payload: HabitIn, user: dict = Depends(get_current_user)):
    await _get_accessible_workspace(ws_id, user)
    doc = {"id": new_id(), "workspace_id": ws_id, **payload.model_dump(), "created_at": now_iso()}
    await db.habits.insert_one(doc)
    return _clean(doc)


@api.patch("/habits/{hid}")
async def update_habit(hid: str, payload: HabitIn, user: dict = Depends(get_current_user)):
    h = await db.habits.find_one({"id": hid})
    if not h:
        raise HTTPException(404, "Habit tidak ditemukan")
    await _get_accessible_workspace(h["workspace_id"], user)
    await db.habits.update_one({"id": hid}, {"$set": payload.model_dump()})
    return await db.habits.find_one({"id": hid}, {"_id": 0})


@api.delete("/habits/{hid}")
async def delete_habit(hid: str, user: dict = Depends(get_current_user)):
    h = await db.habits.find_one({"id": hid})
    if not h:
        raise HTTPException(404, "Habit tidak ditemukan")
    await _get_accessible_workspace(h["workspace_id"], user)
    await db.habits.delete_one({"id": hid})
    await db.habit_logs.delete_many({"habit_id": hid})
    return {"ok": True}


@api.get("/workspaces/{ws_id}/habit-logs")
async def list_habit_logs(ws_id: str, start: Optional[str] = None, end: Optional[str] = None,
                          user: dict = Depends(get_current_user)):
    await _get_accessible_workspace(ws_id, user)
    q: Dict[str, Any] = {"workspace_id": ws_id}
    if start and end:
        q["date"] = {"$gte": start, "$lte": end}
    return await db.habit_logs.find(q, {"_id": 0}).to_list(10000)


@api.post("/workspaces/{ws_id}/habit-logs")
async def upsert_habit_log(ws_id: str, payload: HabitLogIn, user: dict = Depends(get_current_user)):
    await _get_accessible_workspace(ws_id, user)
    doc = {
        "id": new_id(), "workspace_id": ws_id,
        "habit_id": payload.habit_id, "date": payload.date,
        "completed": payload.completed, "note": payload.note,
        "updated_at": now_iso(),
    }
    await db.habit_logs.update_one(
        {"workspace_id": ws_id, "habit_id": payload.habit_id, "date": payload.date},
        {"$set": doc}, upsert=True,
    )
    return doc


# ================= Dashboard / Analytics =================
def _kr_progress(kr: dict) -> float:
    try:
        target = float(kr.get("target", 0))
        baseline = float(kr.get("baseline", 0))
        real = float(kr.get("realisasi", 0))
        if target == baseline:
            return 100.0 if real >= target else 0.0
        p = ((real - baseline) / (target - baseline)) * 100
        return max(0.0, min(100.0, p))
    except Exception:
        return 0.0


@api.get("/workspaces/{ws_id}/summary")
async def workspace_summary(ws_id: str, user: dict = Depends(get_current_user)):
    await _get_accessible_workspace(ws_id, user)
    tasks = await db.tasks.find({"workspace_id": ws_id}, {"_id": 0}).to_list(2000)
    okrs = await db.okrs.find({"workspace_id": ws_id}, {"_id": 0}).to_list(200)
    inits = await db.initiatives.find({"workspace_id": ws_id}, {"_id": 0}).to_list(500)
    habits = await db.habits.find({"workspace_id": ws_id}, {"_id": 0}).to_list(200)

    total = len(tasks)
    selesai = sum(1 for t in tasks if t.get("status") == "SELESAI")
    proses = sum(1 for t in tasks if t.get("status") in ("PROSES", "ON_TRACKER"))
    terkendala = sum(1 for t in tasks if t.get("status") == "TERKENDALA")
    belum = sum(1 for t in tasks if t.get("status") == "BELUM_MULAI")

    today = date.today().isoformat()
    overdue = 0
    for t in tasks:
        bw = t.get("batas_waktu")
        if bw and t.get("status") != "SELESAI" and bw < today:
            overdue += 1

    exec_score = round((selesai / total * 100) if total else 0, 1)

    # OKR overall
    kr_progresses = []
    for o in okrs:
        for kr in o.get("key_results", []):
            kr_progresses.append(_kr_progress(kr))
    okr_progress = round(sum(kr_progresses) / len(kr_progresses), 1) if kr_progresses else 0

    # Habit compliance last 30 days
    from_date = (date.today() - timedelta(days=29)).isoformat()
    logs = await db.habit_logs.find(
        {"workspace_id": ws_id, "date": {"$gte": from_date}, "completed": True},
        {"_id": 0}
    ).to_list(10000)
    habit_slots = len(habits) * 30
    habit_compliance = round((len(logs) / habit_slots * 100) if habit_slots else 0, 1)

    return {
        "tasks": {
            "total": total, "selesai": selesai, "proses": proses,
            "terkendala": terkendala, "belum_mulai": belum, "overdue": overdue,
            "execution_score": exec_score,
        },
        "okr": {"total": len(okrs), "avg_progress": okr_progress},
        "initiatives": {
            "total": len(inits),
            "selesai": sum(1 for i in inits if i.get("status") == "selesai"),
        },
        "habits": {"total": len(habits), "compliance_30d": habit_compliance},
    }


@api.get("/dashboard/spv")
async def spv_dashboard(user: dict = Depends(require_spv)):
    """Aggregated overview across all workspaces (SPV only)."""
    workspaces = await db.workspaces.find({}, {"_id": 0}).to_list(500)
    result = []
    for ws in workspaces:
        owner = await db.users.find_one({"id": ws["owner_id"]}, {"_id": 0, "password_hash": 0})
        # Reuse summary logic
        tasks = await db.tasks.find({"workspace_id": ws["id"]}, {"_id": 0}).to_list(2000)
        okrs = await db.okrs.find({"workspace_id": ws["id"]}, {"_id": 0}).to_list(200)
        habits = await db.habits.find({"workspace_id": ws["id"]}, {"_id": 0}).to_list(200)
        total = len(tasks)
        selesai = sum(1 for t in tasks if t.get("status") == "SELESAI")
        today = date.today().isoformat()
        overdue = sum(1 for t in tasks if t.get("batas_waktu") and t.get("status") != "SELESAI" and t["batas_waktu"] < today)
        kr_progresses = []
        for o in okrs:
            for kr in o.get("key_results", []):
                kr_progresses.append(_kr_progress(kr))
        okr_progress = round(sum(kr_progresses) / len(kr_progresses), 1) if kr_progresses else 0

        from_date = (date.today() - timedelta(days=29)).isoformat()
        logs = await db.habit_logs.count_documents({"workspace_id": ws["id"], "date": {"$gte": from_date}, "completed": True})
        habit_slots = len(habits) * 30
        habit_compliance = round((logs / habit_slots * 100) if habit_slots else 0, 1)

        result.append({
            "workspace": ws,
            "owner": owner,
            "execution_score": round((selesai / total * 100) if total else 0, 1),
            "total_tasks": total, "selesai": selesai, "overdue": overdue,
            "okr_progress": okr_progress, "okr_count": len(okrs),
            "habit_compliance": habit_compliance, "habit_count": len(habits),
        })
    return {"workspaces": result, "count": len(result)}


# ================= Startup =================
async def seed_admin():
    email = os.environ.get("ADMIN_EMAIL", "").lower()
    password = os.environ.get("ADMIN_PASSWORD", "")
    if not email or not password:
        return
    existing = await db.users.find_one({"email": email})
    if not existing:
        uid = new_id()
        await db.users.insert_one({
            "id": uid, "email": email,
            "password_hash": hash_password(password),
            "name": "Kang Teguh", "role": "spv",
            "division": "Multimedia", "created_at": now_iso(),
        })
        # Default SPV workspace
        await db.workspaces.insert_one({
            "id": new_id(), "name": "Workspace Kang Teguh",
            "owner_id": uid, "division": "Multimedia",
            "cycle": "Q1 2026", "created_at": now_iso(),
        })
        logger.info("Seeded admin/SPV user: %s", email)
    elif not verify_password(password, existing["password_hash"]):
        await db.users.update_one({"email": email},
                                  {"$set": {"password_hash": hash_password(password), "role": "spv"}})


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.workspaces.create_index("owner_id")
    await db.tasks.create_index([("workspace_id", 1), ("frekuensi", 1)])
    await db.habit_logs.create_index([("workspace_id", 1), ("habit_id", 1), ("date", 1)], unique=True)
    await db.task_logs.create_index([("workspace_id", 1), ("task_id", 1), ("date", 1)], unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await seed_admin()


class OrgIn(BaseModel):
    name: Optional[str] = None
    vision: Optional[str] = None
    mission: Optional[List[str]] = None
    values: Optional[List[str]] = None


PERSPECTIVE_ORDER = ["financial", "customer", "process", "learning"]


async def _get_org() -> dict:
    doc = await db.organization.find_one({"id": "main"}, {"_id": 0})
    if not doc:
        doc = {"id": "main", "name": "PT Solusi Bisnis Utama", "vision": "", "mission": [], "values": [], "created_at": now_iso()}
        await db.organization.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/organization")
async def get_org(user: dict = Depends(get_current_user)):
    return await _get_org()


@api.put("/organization")
async def update_org(payload: OrgIn, user: dict = Depends(require_spv)):
    await _get_org()
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    if upd:
        await db.organization.update_one({"id": "main"}, {"$set": upd})
    return await _get_org()


class KPIItem(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    baseline: float = 0
    target: float = 0
    realisasi: float = 0
    unit: str = ""
    linked_kr_id: Optional[str] = None
    linked_okr_id: Optional[str] = None


class GoalIn(BaseModel):
    perspective: str  # financial|customer|process|learning
    title: str
    year: int = 2026
    order: int = 0
    kpis: List[KPIItem] = []


@api.get("/strategy/goals")
async def list_goals(year: int = 2026, user: dict = Depends(get_current_user)):
    items = await db.goals.find({"year": year}, {"_id": 0}).sort([("perspective", 1), ("order", 1)]).to_list(500)
    return items


@api.post("/strategy/goals")
async def create_goal(payload: GoalIn, user: dict = Depends(require_spv)):
    if payload.perspective not in PERSPECTIVE_ORDER:
        raise HTTPException(400, "Perspective tidak valid")
    doc = {"id": new_id(), **payload.model_dump(), "created_at": now_iso()}
    doc["kpis"] = [k.model_dump() if hasattr(k, "model_dump") else dict(k) for k in payload.kpis]
    await db.goals.insert_one(doc)
    return _clean(doc)


@api.patch("/strategy/goals/{gid}")
async def update_goal(gid: str, payload: GoalIn, user: dict = Depends(require_spv)):
    g = await db.goals.find_one({"id": gid})
    if not g:
        raise HTTPException(404, "Goal tidak ditemukan")
    upd = payload.model_dump()
    upd["kpis"] = [k.model_dump() for k in payload.kpis]
    await db.goals.update_one({"id": gid}, {"$set": upd})
    return await db.goals.find_one({"id": gid}, {"_id": 0})


@api.delete("/strategy/goals/{gid}")
async def delete_goal(gid: str, user: dict = Depends(require_spv)):
    await db.goals.delete_one({"id": gid})
    return {"ok": True}


def _kpi_progress(kpi: dict) -> float:
    try:
        t = float(kpi.get("target", 0)); b = float(kpi.get("baseline", 0)); r = float(kpi.get("realisasi", 0))
        if t == b:
            return 100.0 if r >= t else 0.0
        return max(0.0, min(100.0, ((r - b) / (t - b)) * 100))
    except Exception:
        return 0.0


def _kpi_health(progress: float) -> str:
    if progress >= 75: return "green"
    if progress >= 40: return "yellow"
    return "red"


@api.get("/strategy/cascade")
async def strategy_cascade(year: int = 2026, user: dict = Depends(get_current_user)):
    org = await _get_org()
    goals = await db.goals.find({"year": year}, {"_id": 0}).sort([("perspective", 1), ("order", 1)]).to_list(500)
    okrs = await db.okrs.find({}, {"_id": 0}).to_list(500)
    inits = await db.initiatives.find({}, {"_id": 0}).to_list(1000)
    okr_by_kr = {}
    for o in okrs:
        for kr in o.get("key_results", []):
            okr_by_kr[kr["id"]] = {"okr_id": o["id"], "objective": o["objective"], "kr": kr, "workspace_id": o["workspace_id"]}
    # attach linked info to each kpi + health
    for g in goals:
        for k in g.get("kpis", []):
            k["progress"] = round(_kpi_progress(k), 1)
            k["health"] = _kpi_health(k["progress"])
            if k.get("linked_kr_id") and okr_by_kr.get(k["linked_kr_id"]):
                k["linked_okr"] = okr_by_kr[k["linked_kr_id"]]
    return {"organization": org, "goals": goals, "okrs": okrs, "initiatives": inits}


# ================= User Management (SPV) =================
class AdminUserIn(BaseModel):
    email: EmailStr
    password: Optional[str] = None
    name: str
    role: str = "anggota"
    division: Optional[str] = None
    active: bool = True


class AdminUserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    division: Optional[str] = None
    active: Optional[bool] = None


class PasswordResetIn(BaseModel):
    new_password: str


@api.post("/admin/users")
async def admin_create_user(payload: AdminUserIn, user: dict = Depends(require_spv)):
    if payload.role not in ("spv", "anggota"):
        raise HTTPException(400, "Role tidak valid")
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email sudah terdaftar")
    if not payload.password or len(payload.password) < 6:
        raise HTTPException(400, "Password minimal 6 karakter")
    uid = new_id()
    doc = {
        "id": uid, "email": email, "name": payload.name,
        "password_hash": hash_password(payload.password),
        "role": payload.role, "division": payload.division,
        "active": payload.active, "auth_provider": "local",
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    await db.workspaces.insert_one({
        "id": new_id(), "name": f"Workspace {payload.name}",
        "owner_id": uid, "division": payload.division,
        "cycle": "Q1 2026", "created_at": now_iso(),
    })
    doc.pop("password_hash", None)
    return _clean(doc)


@api.patch("/admin/users/{uid}")
async def admin_update_user(uid: str, payload: AdminUserUpdate, user: dict = Depends(require_spv)):
    target = await db.users.find_one({"id": uid})
    if not target:
        raise HTTPException(404, "User tidak ditemukan")
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "role" in upd and upd["role"] not in ("spv", "anggota"):
        raise HTTPException(400, "Role tidak valid")
    if upd:
        await db.users.update_one({"id": uid}, {"$set": upd})
    doc = await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0})
    return doc


@api.post("/admin/users/{uid}/reset-password")
async def admin_reset_password(uid: str, payload: PasswordResetIn, user: dict = Depends(require_spv)):
    if len(payload.new_password) < 6:
        raise HTTPException(400, "Password minimal 6 karakter")
    target = await db.users.find_one({"id": uid})
    if not target:
        raise HTTPException(404, "User tidak ditemukan")
    await db.users.update_one({"id": uid}, {"$set": {"password_hash": hash_password(payload.new_password)}})
    return {"ok": True}


@api.delete("/admin/users/{uid}")
async def admin_delete_user(uid: str, user: dict = Depends(require_spv)):
    if uid == user["id"]:
        raise HTTPException(400, "Tidak dapat menghapus akun sendiri")
    target = await db.users.find_one({"id": uid})
    if not target:
        raise HTTPException(404, "User tidak ditemukan")
    # cascade delete: workspaces owned + their nested data + user sessions
    ws_list = await db.workspaces.find({"owner_id": uid}, {"_id": 0}).to_list(100)
    ws_ids = [w["id"] for w in ws_list]
    if ws_ids:
        await db.okrs.delete_many({"workspace_id": {"$in": ws_ids}})
        await db.initiatives.delete_many({"workspace_id": {"$in": ws_ids}})
        await db.tasks.delete_many({"workspace_id": {"$in": ws_ids}})
        await db.task_logs.delete_many({"workspace_id": {"$in": ws_ids}})
        await db.habits.delete_many({"workspace_id": {"$in": ws_ids}})
        await db.habit_logs.delete_many({"workspace_id": {"$in": ws_ids}})
        await db.workspaces.delete_many({"owner_id": uid})
    await db.user_sessions.delete_many({"user_id": uid})
    await db.users.delete_one({"id": uid})
    return {"ok": True, "workspaces_deleted": len(ws_ids)}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
