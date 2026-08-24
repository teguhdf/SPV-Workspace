# Sanad Workspace — SPV Monitoring Suite

## Original Problem Statement
Web aplikasi untuk SPV memantau to-do tim di semua divisi. Sebelumnya menggunakan spreadsheet berisi Action Plan, Tracker Amaliyah Spiritual, dan Tracker To-Do Harian/Mingguan/Bulanan. Membutuhkan fitur monitoring & rekomendasi terbaik untuk kontrol to-do dan target action plan.

## User Choices
- Auth: JWT custom (email/password) dengan role SPV & Anggota
- Struktur: 1 workspace per user; SPV memantau semua workspace
- Fitur: OKR, Action Plan/Initiative, Execution Scoreboard, Tracker Amaliyah, Tracker To-Do Harian/Mingguan/Bulanan, Dashboard SPV, Catatan/Arahan SPV per task/habit
- Design: clean modern hijau kubah mesjid nabawi (emerald)

## Architecture
- Backend: FastAPI + MongoDB (motor async), JWT auth (httpOnly cookies + Bearer fallback), bcrypt hashing
- Frontend: React 19 + React Router 7 + shadcn/ui + Tailwind + sonner + lucide-react + framer-motion + recharts
- Env: MONGO_URL, DB_NAME, JWT_SECRET, CORS_ORIGINS, ADMIN_EMAIL, ADMIN_PASSWORD
- Seeded SPV account on startup

## User Personas
- SPV / Supervisor (Kang Teguh) — overview semua workspace, memberi arahan, monitoring OKR & execution
- Anggota Tim — kelola OKR, initiative, task, habit spiritual di workspace masing-masing

## Implemented (Feb 2026 — v1)
- Auth: register/login/logout/me, seeded admin, role-based routing
- Workspace CRUD & multi-workspace listing untuk SPV
- OKR CRUD (objective + N Key Results dengan baseline/target/realisasi, auto progress calc)
- Initiative/Action Plan CRUD (status, %, deadline, linked KR, catatan tim & SPV)
- Execution Scoreboard: task CRUD dengan kategori (RUTIN/TIDAK_RUTIN), frekuensi (SEKALI/HARIAN/MINGGUAN/BULANAN), status, deadline, dokumen link, filter status/frekuensi, quick-status
- Tracker Amaliyah Spiritual: habit CRUD + kalender grid harian per bulan (GitHub-style contribution), compliance %, arahan SPV
- Tracker To-Do Harian/Mingguan/Bulanan: grid checkbox berdasarkan frekuensi task
- Dashboard SPV: agregasi execution score, OKR progress, overdue count, amaliyah 30d compliance per workspace
- Overdue detection otomatis
- Design: sidebar mesjid gradient + Islamic pattern overlay, Outfit + Inter + Amiri fonts

## Backlog (P1/P2)
- Auth reset password + brute force lockout
- Multi-workspace per divisi grouping & Struktur divisi
- Analytics chart (recharts) - trend chart per bulan
- Export laporan mingguan/bulanan (PDF/Excel)
- Reminder / Notifikasi (WA / Email via Resend)
- Import initial data dari Google Sheet
- Bulk task assignment SPV → Anggota
- SPV can create workspace on behalf of anggota
- Attach dokumen SOP per habit
- Mobile responsive polishing untuk grid amaliyah
