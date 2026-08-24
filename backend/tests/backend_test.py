"""Backend API tests: auth, organization, strategy (BSC/cascade), admin user CRUD, regression spot-checks."""
import os
import re
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"


def _creds():
    content = Path("/app/memory/test_credentials.md").read_text(encoding="utf-8")
    e = re.search(r'(?im)^\s*[-*]?\s*Email:\s*([^\s]+)', content)
    p = re.search(r'(?im)^\s*[-*]?\s*Password:\s*([^\s]+)', content)
    return {"email": e.group(1), "password": p.group(1)}


@pytest.fixture(scope="session")
def spv_creds():
    return _creds()


@pytest.fixture(scope="session")
def spv(spv_creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=spv_creds, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"SPV login failed {r.status_code}: {r.text[:300]}")
    data = r.json()
    assert data["role"] == "spv"
    s.headers.update({"Authorization": f"Bearer {data['access_token']}"})
    s.user = data
    return s


@pytest.fixture(scope="session")
def anggota():
    """Register a fresh anggota user via public register."""
    s = requests.Session()
    email = f"test_anggota_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register", json={
        "email": email, "password": "Anggota2026!", "name": "TEST Anggota",
        "role": "anggota", "division": "Multimedia"}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"register failed {r.status_code}: {r.text[:300]}")
    d = r.json()
    s.headers.update({"Authorization": f"Bearer {d['access_token']}"})
    s.user = d
    return s


# ---------------- Auth ----------------
class TestAuth:
    def test_me(self, spv, spv_creds):
        r = spv.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == spv_creds["email"].lower()
        assert d["role"] == "spv"
        assert "password_hash" not in d and "_id" not in d

    def test_bad_password(self, spv_creds):
        r = requests.post(f"{API}/auth/login", json={"email": spv_creds["email"], "password": "wrongpass"}, timeout=30)
        assert r.status_code == 401

    def test_login_sets_httponly_cookies(self, spv_creds):
        r = requests.post(f"{API}/auth/login", json=spv_creds, timeout=30)
        assert r.status_code == 200
        raw = r.headers.get("set-cookie", "")
        assert "access_token" in raw and "HttpOnly" in raw

    def test_unauthenticated_401(self):
        assert requests.get(f"{API}/auth/me", timeout=30).status_code == 401
        assert requests.get(f"{API}/organization", timeout=30).status_code == 401


# ---------------- Organization ----------------
@pytest.fixture(scope="class", autouse=True)
def restore_org(spv):
    """Single-tenant app: snapshot + restore the global organization doc so tests are non-destructive."""
    snap = spv.get(f"{API}/organization", timeout=30).json()
    yield
    spv.put(f"{API}/organization", json={
        "name": snap.get("name"), "vision": snap.get("vision"),
        "mission": snap.get("mission") or [], "values": snap.get("values") or [],
    }, timeout=30)


class TestOrganization:
    def test_get_org(self, spv):
        r = spv.get(f"{API}/organization", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == "main"
        assert "_id" not in d

    def test_update_org_persists(self, spv):
        payload = {
            "name": "TEST PT Sanad Utama",
            "vision": "TEST Menjadi organisasi rujukan",
            "mission": ["TEST misi satu", "TEST misi dua"],
            "values": ["Amanah", "Ihsan"],
        }
        r = spv.put(f"{API}/organization", json=payload, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["name"] == payload["name"]
        assert d["mission"] == payload["mission"]
        # verify persistence
        g = spv.get(f"{API}/organization", timeout=30).json()
        assert g["vision"] == payload["vision"]
        assert g["values"] == payload["values"]

    def test_anggota_cannot_update_org(self, anggota):
        r = anggota.put(f"{API}/organization", json={"name": "hack"}, timeout=30)
        assert r.status_code == 403

    def test_anggota_can_read_org(self, anggota):
        assert anggota.get(f"{API}/organization", timeout=30).status_code == 200

    def test_partial_update_does_not_wipe_lists(self, spv):
        """Sending only name should not clear mission/values."""
        base = {"name": "TEST Org", "vision": "v", "mission": ["m1"], "values": ["v1"]}
        spv.put(f"{API}/organization", json=base, timeout=30)
        spv.put(f"{API}/organization", json={"name": "TEST Org 2"}, timeout=30)
        d = spv.get(f"{API}/organization", timeout=30).json()
        assert d["mission"] == ["m1"], f"mission wiped by partial update: {d['mission']}"
        assert d["values"] == ["v1"]


# ---------------- Strategy / BSC ----------------
class TestStrategyGoals:
    created = []

    def test_create_goal_and_persist(self, spv):
        payload = {
            "perspective": "financial", "title": "TEST Peningkatan Net Profit Margin",
            "year": 2099, "order": 0,
            "kpis": [
                {"id": str(uuid.uuid4()), "name": "NPM", "baseline": 0, "target": 100, "realisasi": 80, "unit": "%"},
                {"id": str(uuid.uuid4()), "name": "Revenue", "baseline": 0, "target": 100, "realisasi": 40, "unit": "%"},
            ],
        }
        r = spv.post(f"{API}/strategy/goals", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "_id" not in d
        assert d["title"] == payload["title"]
        assert len(d["kpis"]) == 2
        assert d["kpis"][0]["target"] == 100
        TestStrategyGoals.created.append(d["id"])

        lst = spv.get(f"{API}/strategy/goals", params={"year": 2099}, timeout=30).json()
        assert any(g["id"] == d["id"] for g in lst)

    def test_invalid_perspective(self, spv):
        r = spv.post(f"{API}/strategy/goals", json={"perspective": "bogus", "title": "x", "year": 2099}, timeout=30)
        assert r.status_code == 400

    def test_anggota_cannot_create_goal(self, anggota):
        r = anggota.post(f"{API}/strategy/goals", json={"perspective": "financial", "title": "x", "year": 2099}, timeout=30)
        assert r.status_code == 403

    def test_anggota_can_read_goals(self, anggota):
        assert anggota.get(f"{API}/strategy/goals", params={"year": 2099}, timeout=30).status_code == 200

    def test_update_goal(self, spv):
        gid = TestStrategyGoals.created[0]
        payload = {
            "perspective": "financial", "title": "TEST Updated Title", "year": 2099, "order": 1,
            "kpis": [{"id": str(uuid.uuid4()), "name": "NPM v2", "baseline": 0, "target": 100, "realisasi": 10, "unit": "%"}],
        }
        r = spv.patch(f"{API}/strategy/goals/{gid}", json=payload, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["title"] == "TEST Updated Title"
        assert len(d["kpis"]) == 1
        lst = spv.get(f"{API}/strategy/goals", params={"year": 2099}, timeout=30).json()
        got = next(g for g in lst if g["id"] == gid)
        assert got["kpis"][0]["realisasi"] == 10

    def test_update_missing_goal_404(self, spv):
        r = spv.patch(f"{API}/strategy/goals/{uuid.uuid4()}",
                      json={"perspective": "financial", "title": "x", "year": 2099}, timeout=30)
        assert r.status_code == 404

    def test_cascade_progress_and_health(self, spv):
        # goal with three KPIs to check 80/40/10 -> green/yellow/red
        payload = {
            "perspective": "customer", "title": "TEST Cascade Health", "year": 2099,
            "kpis": [
                {"id": str(uuid.uuid4()), "name": "k80", "baseline": 0, "target": 100, "realisasi": 80},
                {"id": str(uuid.uuid4()), "name": "k40", "baseline": 0, "target": 100, "realisasi": 40},
                {"id": str(uuid.uuid4()), "name": "k10", "baseline": 0, "target": 100, "realisasi": 10},
            ],
        }
        gid = spv.post(f"{API}/strategy/goals", json=payload, timeout=30).json()["id"]
        TestStrategyGoals.created.append(gid)
        r = spv.get(f"{API}/strategy/cascade", params={"year": 2099}, timeout=30)
        assert r.status_code == 200
        c = r.json()
        assert "organization" in c and "goals" in c and "okrs" in c and "initiatives" in c
        goal = next(g for g in c["goals"] if g["id"] == gid)
        by = {k["name"]: k for k in goal["kpis"]}
        assert by["k80"]["progress"] == 80.0 and by["k80"]["health"] == "green"
        assert by["k40"]["progress"] == 40.0 and by["k40"]["health"] == "red"
        assert by["k10"]["progress"] == 10.0 and by["k10"]["health"] == "red"

    def test_delete_goal(self, spv):
        gid = TestStrategyGoals.created.pop(0)
        r = spv.delete(f"{API}/strategy/goals/{gid}", timeout=30)
        assert r.status_code == 200
        lst = spv.get(f"{API}/strategy/goals", params={"year": 2099}, timeout=30).json()
        assert not any(g["id"] == gid for g in lst)

    def test_delete_nonexistent_goal(self, spv):
        r = spv.delete(f"{API}/strategy/goals/{uuid.uuid4()}", timeout=30)
        assert r.status_code in (200, 404)

    @classmethod
    def teardown_class(cls):
        pass


@pytest.fixture(scope="session", autouse=True)
def _cleanup_goals(spv):
    yield
    for gid in list(TestStrategyGoals.created):
        spv.delete(f"{API}/strategy/goals/{gid}", timeout=30)


# ---------------- Admin User CRUD ----------------
class TestAdminUsers:
    created = []

    def test_list_users_spv(self, spv):
        r = spv.get(f"{API}/users", timeout=30)
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list) and len(users) >= 1
        assert all("password_hash" not in u and "_id" not in u for u in users)
        assert any(u["email"] == spv.user["email"] for u in users)

    def test_list_users_anggota_forbidden(self, anggota):
        assert anggota.get(f"{API}/users", timeout=30).status_code == 403

    def test_create_user_and_workspace(self, spv):
        email = f"test_user_{uuid.uuid4().hex[:8]}@example.com"
        r = spv.post(f"{API}/admin/users", json={
            "email": email, "password": "Secret123", "name": "TEST Created User",
            "role": "anggota", "division": "Konten"}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "password_hash" not in d and "_id" not in d
        assert d["email"] == email and d["role"] == "anggota" and d["division"] == "Konten"
        TestAdminUsers.created.append(d["id"])
        TestAdminUsers.email = email

        users = spv.get(f"{API}/users", timeout=30).json()
        assert any(u["id"] == d["id"] for u in users)
        # workspace auto-created
        ws = spv.get(f"{API}/workspaces", timeout=30).json()
        assert any(w["owner_id"] == d["id"] for w in ws)

    def test_created_user_can_login(self, spv):
        r = requests.post(f"{API}/auth/login", json={"email": TestAdminUsers.email, "password": "Secret123"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["role"] == "anggota"

    def test_duplicate_email_rejected(self, spv):
        r = spv.post(f"{API}/admin/users", json={
            "email": TestAdminUsers.email, "password": "Secret123", "name": "dup"}, timeout=30)
        assert r.status_code == 400

    def test_short_password_rejected(self, spv):
        r = spv.post(f"{API}/admin/users", json={
            "email": f"test_short_{uuid.uuid4().hex[:6]}@example.com", "password": "123", "name": "short"}, timeout=30)
        assert r.status_code == 400

    def test_invalid_role_rejected(self, spv):
        r = spv.post(f"{API}/admin/users", json={
            "email": f"test_role_{uuid.uuid4().hex[:6]}@example.com", "password": "Secret123",
            "name": "x", "role": "superadmin"}, timeout=30)
        assert r.status_code == 400

    def test_update_user_persists(self, spv):
        uid = TestAdminUsers.created[0]
        r = spv.patch(f"{API}/admin/users/{uid}", json={"division": "Desain", "role": "anggota"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["division"] == "Desain"
        users = spv.get(f"{API}/users", timeout=30).json()
        got = next(u for u in users if u["id"] == uid)
        assert got["division"] == "Desain" and got["role"] == "anggota"

    def test_update_missing_user_404(self, spv):
        r = spv.patch(f"{API}/admin/users/{uuid.uuid4()}", json={"division": "X"}, timeout=30)
        assert r.status_code == 404

    def test_reset_password_and_login(self, spv):
        uid = TestAdminUsers.created[0]
        r = spv.post(f"{API}/admin/users/{uid}/reset-password", json={"new_password": "NewPass456"}, timeout=30)
        assert r.status_code == 200 and r.json().get("ok") is True
        lr = requests.post(f"{API}/auth/login", json={"email": TestAdminUsers.email, "password": "NewPass456"}, timeout=30)
        assert lr.status_code == 200
        old = requests.post(f"{API}/auth/login", json={"email": TestAdminUsers.email, "password": "Secret123"}, timeout=30)
        assert old.status_code == 401

    def test_reset_password_too_short(self, spv):
        uid = TestAdminUsers.created[0]
        r = spv.post(f"{API}/admin/users/{uid}/reset-password", json={"new_password": "abc"}, timeout=30)
        assert r.status_code == 400

    def test_anggota_cannot_admin(self, anggota):
        assert anggota.post(f"{API}/admin/users", json={
            "email": "x@y.com", "password": "Secret123", "name": "x"}, timeout=30).status_code == 403
        assert anggota.delete(f"{API}/admin/users/{uuid.uuid4()}", timeout=30).status_code == 403

    def test_cannot_delete_self(self, spv):
        r = spv.delete(f"{API}/admin/users/{spv.user['id']}", timeout=30)
        assert r.status_code == 400

    def test_delete_user_cascades(self, spv):
        uid = TestAdminUsers.created.pop(0)
        r = spv.delete(f"{API}/admin/users/{uid}", timeout=30)
        assert r.status_code == 200
        assert r.json()["workspaces_deleted"] >= 1
        users = spv.get(f"{API}/users", timeout=30).json()
        assert not any(u["id"] == uid for u in users)
        ws = spv.get(f"{API}/workspaces", timeout=30).json()
        assert not any(w["owner_id"] == uid for w in ws)
        assert requests.post(f"{API}/auth/login",
                             json={"email": TestAdminUsers.email, "password": "NewPass456"}, timeout=30).status_code == 401

    def test_delete_missing_user_404(self, spv):
        r = spv.delete(f"{API}/admin/users/{uuid.uuid4()}", timeout=30)
        assert r.status_code == 404


# ---------------- Regression spot-checks ----------------
class TestRegression:
    def test_spv_dashboard(self, spv):
        r = spv.get(f"{API}/dashboard/spv", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "workspaces" in d and d["count"] == len(d["workspaces"])

    def test_anggota_dashboard_forbidden(self, anggota):
        assert anggota.get(f"{API}/dashboard/spv", timeout=30).status_code == 403

    def test_okr_task_habit_flow(self, anggota):
        ws = anggota.get(f"{API}/workspaces", timeout=30).json()
        assert len(ws) == 1
        wid = ws[0]["id"]

        okr = anggota.post(f"{API}/workspaces/{wid}/okrs", json={
            "objective": "TEST Objective", "cycle": "Q1 2026",
            "key_results": [{"metric": "KR1", "baseline": 0, "target": 100, "realisasi": 50, "unit": "%"}]},
            timeout=30)
        assert okr.status_code == 200, okr.text
        assert okr.json()["key_results"][0]["metric"] == "KR1"

        task = anggota.post(f"{API}/workspaces/{wid}/tasks", json={
            "name": "TEST Task", "kategori": "RUTIN", "frekuensi": "HARIAN", "status": "SELESAI"}, timeout=30)
        assert task.status_code == 200

        habit = anggota.post(f"{API}/workspaces/{wid}/habits", json={"name": "TEST Habit", "target_days": 40}, timeout=30)
        assert habit.status_code == 200
        hid = habit.json()["id"]
        log = anggota.post(f"{API}/workspaces/{wid}/habit-logs",
                          json={"habit_id": hid, "date": "2026-07-01", "completed": True}, timeout=30)
        assert log.status_code == 200

        summ = anggota.get(f"{API}/workspaces/{wid}/summary", timeout=30).json()
        assert summ["tasks"]["total"] >= 1
        assert summ["okr"]["avg_progress"] == 50.0

    def test_anggota_cannot_access_other_workspace(self, anggota, spv):
        spv_ws = [w for w in spv.get(f"{API}/workspaces", timeout=30).json()
                  if w["owner_id"] == spv.user["id"]]
        if not spv_ws:
            pytest.skip("no spv workspace")
        r = anggota.get(f"{API}/workspaces/{spv_ws[0]['id']}", timeout=30)
        assert r.status_code == 403
