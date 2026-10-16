# LumenEIOS — Adaptive EdTech Ecosystem (NEP 2020)

> **Complete Multi-Role Adaptive Learning & School Management Platform**  
> Aligned with India's National Education Policy (NEP 2020) Competency-Based Education framework.

---

## 1. Executive Summary & Vision

**LumenEIOS** is a high-fidelity web application engineered to demonstrate an AI-inspired adaptive learning and school management ecosystem. 

Traditional school software blindly prioritizes textbook chapter completion over actual student comprehension. When unexpected disruptions occur (extreme weather closures, state election duties, public health camps, and census surveys), classrooms are forced to rush through lessons, leaving severe learning gaps.

LumenEIOS introduces the **Time-Aware Pedagogical Engine**:
1. **Measures 4 Essential Competency Dimensions**:
   - **LU**: Language Understanding (interpreting terminology & clauses)
   - **CU**: Concept Understanding (fundamental mental models & proofs)
   - **AU**: Application Understanding (practical real-world problem-solving)
   - **CT**: Critical Thinking (evaluating claims, detecting fallacies)
2. **Dynamic Calendar Compacting (60/40 Strategy)**:
   - **Protects 100% of Core Competencies** (60% essential curriculum).
   - Reassigns supplementary topics (40%) to guided flipped inquiry, home labs, and cross-curricular synergy projects.
3. **Multi-Infrastructure Tier Telemetry**:
   - Seamlessly supports **High-Tech Private**, **Standard Blended**, and **Low-Tech Rural Government** schools (with offline optical worksheet scan review).
4. **Unified Stakeholder Experience**:
   - Role-specific workflows for **Administrators**, **Principals**, **Teachers**, **Students**, and **Parents**.

---

## 2. Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS 3 (Inter typography, custom Navy `#142A43` & Teal `#16A085` palette)
- **Routing**: React Router DOM v6
- **Data Visualization**: Recharts (Radar charts, Grouped bar charts, Heatmaps, Pacing bars)
- **Icons**: Lucide React
- **Persistence**: Centralized `DataContext` with `LocalStorage` synchronization and Demo Reset

---

## 3. Demo Credentials & Personas

The application features **1-Click Demo Login** buttons directly on the login screen (`/login`) and a persistent **Stakeholder Role Switcher Banner** at the top of every page.

| Role | Demo Email | Password | Name & Title | Campus Context |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | `admin@lumeneios.demo` | `demo123` | **Dr. Rajesh Sharma** (Academic Innovation Director) | Statewide (All 5 Campuses) |
| **Principal** | `principal@lumeneios.demo` | `demo123` | **Dr. Sunita Deshmukh** (Principal) | Sunrise Public School (`school-1`) |
| **Teacher** | `teacher@lumeneios.demo` | `demo123` | **Vikram Sengupta** (Lead TGT Educator) | Class 8-A & 9-B (Maths & Science) |
| **Student** | `student@lumeneios.demo` | `demo123` | **Aarav Patel** (Grade 8 Student) | Class 8-A (Roll #14) |
| **Parent** | `parent@lumeneios.demo` | `demo123` | **Meera Patel** (Guardian) | Linked to Aarav & Ananya Patel |

---

## 4. Multi-School Infrastructure Tiers

The ecosystem is seeded with 5 fictional Indian schools across different infrastructure capabilities:

1. **Sunrise Public School** (`school-1`) — *High-Tech Private* (Bengaluru, Karnataka): Digital smart boards, 1:1 student tablets, fiber broadband.
2. **Green Valley Academy** (`school-2`) — *Standard Blended* (Pune, Maharashtra): Projector classrooms and shared computer laboratories.
3. **Pragati Government Senior Secondary School** (`school-3`) — *Low-Tech Government* (Jaipur, Rajasthan): Printed workbooks, mobile camera OCR scans, community solar lanterns.
4. **Vidya Niketan School** (`school-4`) — *Standard Blended* (Lucknow, Uttar Pradesh): Blended tinkering labs and structured peer learning.
5. **Udaan Learning Government School** (`school-5`) — *Low-Tech Government* (Ranchi, Jharkhand): Physical worksheets, vernacular audio aids, foundational numeracy focus.

---

## 5. End-to-End Stakeholder Demonstration Scenario

Follow this workflow to demonstrate the complete power of LumenEIOS:

1. **Admin Platform Overview** (`/admin/dashboard`):
   - Review multi-school comparative benchmarks.
   - Spot that rural government campuses (Pragati Govt & Udaan) suffer from English Language Understanding (LU) deficits in word problems despite having good conceptual understanding (CU).
2. **Principal Oversight** (`/principal/dashboard`):
   - Switch persona to **Principal**.
   - Notice that Class 8-A has accumulated **16 lost teaching days** due to election duty, weather closures, and health camps.
   - Inspect teacher workloads and reassign faculty.
3. **Teacher Time-Aware Pedagogical Engine** (`/teacher/time-aware`):
   - Switch persona to **Teacher** (Vikram Sengupta).
   - Review the **Pacing Progress Bar**: 16 lost days have turned the calendar buffer negative (-4 days).
   - Click **"Record Lost Teaching Days"** to simulate adding another disruption.
   - Review the **Cross-Curricular Synergy Detection**: Accept the *Rainfall Data Modeling* project (merging Mathematics, Science, and English) to recover 3.5 teaching hours.
   - Click **"Preview Syllabus Compression"**:
     - Inspect the before-and-after schedule.
     - Note that 100% of Core Competencies are strictly protected.
     - Click **"Accept Proposed Plan"**: Recovers 14 days, restores a safe calendar buffer, and records an audit log entry!
4. **Handwritten Optical Scan Review** (`/teacher/scan-review`):
   - Open the scan review tab for offline low-tech schools.
   - Inspect the simulated handwritten worksheet for Aarav Patel.
   - Review the AI OCR confidence (98.4%) and adjust awarded marks.
   - Click **"Approve & Recalibrate Baseline"** to update Aarav's competency scores.
5. **Differentiated Remediation** (`/teacher/remediation`):
   - View personalized assignments. A student weak in LU receives bilingual word problem scaffolding; a student weak in AU receives hands-on measurement tasks.
6. **Student Learning Mission** (`/student/dashboard`):
   - Switch persona to **Student** (Aarav Patel).
   - View "Today's Learning Mission" (Day 104: Mensuration & Volume).
   - Click **"Start Today's Quiz"**, select the correct volume option (6 hours and 40 minutes), and submit to receive instant mastery feedback!
   - Complete and submit assigned homework.
7. **Parent Holistic Card** (`/parent/dashboard`):
   - Switch persona to **Parent** (Meera Patel).
   - View Aarav's progress in reassuring plain language (free of technical jargon).
   - Toggle between children (Aarav and Ananya).
   - Read teacher feedback and actionable suggestions for home learning.
   - Click **"Download Holistic Card"** to generate an official print/PDF export.

---

## 6. Route Directory

- `/login` — Demo Login Portal
- `/admin/dashboard` — Platform Command Center & Governance
- `/admin/schools` — School Network Directory & Onboarding CRUD
- `/admin/users` — User Directory & Role Assignments
- `/admin/academic-config` — Statutory Working Days & Compaction Rules
- `/admin/audit-logs` — Immutable Audit & Security Trail
- `/principal/dashboard` — Campus Executive Dashboard
- `/principal/teachers` — Faculty Section Allocations
- `/principal/curriculum` — Subject Curriculum Progress
- `/principal/reports` — Institutional Compliance Transcripts
- `/teacher/dashboard` — Educator Dashboard & Pacing Radar
- `/teacher/classes` — Student Roster & Classroom Heatmap Matrix
- `/teacher/time-aware` — **Signature Feature**: Time-Aware Pedagogical Engine
- `/teacher/curriculum-180` — 180-Day Daily Micro-Curriculum (VARK & Bloom's)
- `/teacher/assessments` — Competency Assessment Builder & Question Bank
- `/teacher/scan-review` — Offline OCR Optical Worksheet Grading
- `/teacher/remediation` — Differentiated Homework Manager
- `/student/dashboard` — Student Missions, Practice Lab & Achievements
- `/parent/dashboard` — Family Holistic Card & Plain-Language Growth

---

## 7. Backend Architecture & API

The backend is implemented using **Python FastAPI** and **SQLAlchemy 2.x (Async)** with full support for zero-dependency local SQLite execution and production PostgreSQL with pgvector.

### Backend Tech Stack
- **Framework**: FastAPI (Async)
- **Validation**: Pydantic v2
- **ORM & Database**: SQLAlchemy 2.x Async (`sqlite+aiosqlite` for zero-setup local runs; `postgresql+asyncpg` with pgvector for production)
- **Security & RBAC**: JWT (HS256) + bcrypt password hashing + tenant isolation across 5 schools
- **Testing**: Pytest + pytest-asyncio + HTTPX (26 automated test specs)
- **Storage**: S3 / MinIO abstraction with local fallback
- **OCR Engine**: Pluggable provider architecture (`SimulatedOCRProvider`, Hugging Face `TrOCR`, `PaddleOCR`) with mandatory Human-in-the-Loop teacher verification

---

## 8. Local Setup & Startup

### Prerequisites
- Node.js (v18+) and npm
- Python 3.12+ (or 3.15)

### 8.1 Backend Setup
```bash
# 1. Install backend dependencies
python -m pip install -r backend/requirements.txt

# 2. Run backend server (auto-seeds database on first launch)
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
- Interactive API Documentation (Swagger): **`http://localhost:8000/api/v1/docs`**
- Alternative ReDoc: **`http://localhost:8000/api/v1/redoc`**
- System Health: **`http://localhost:8000/health`**

### 8.2 Frontend Setup
```bash
# 1. Install frontend dependencies
npm install

# 2. Start Vite development server
npm run dev
```
Open **`http://localhost:3000`** in your browser.

### 8.3 Run Automated Tests
```bash
python -m pytest backend/tests -v
```
Executes all 26 unit and integration test specs covering permissions, pacing invariants, competency formulas, OCR evaluations, and API endpoints.

---

## 9. Production Docker Compose Deployment

To deploy the entire production stack including PostgreSQL 16 (pgvector), Redis 7, MinIO object storage, and the FastAPI application:

```bash
cd infrastructure
docker-compose up -d --build
```

---

## 10. Technical Documentation Index

Detailed architectural documents are located in the [`docs/`](./docs) directory:
- [System Architecture](./docs/architecture.md)
- [Database Schema & ER Reference](./docs/database-schema.md)
- [Frontend to Backend API Mapping](./docs/frontend-api-mapping.md)
- [Time-Aware Pedagogical Engine & 60/40 Compression](./docs/time-aware-engine.md)
- [Optical Assessment (OCR) & Human Review Pipeline](./docs/ocr-pipeline.md)
- [Model Fine-Tuning & Evaluation Gates](./docs/model-training.md)
- [Security, Permissions & Tenant Isolation](./docs/security.md)
- [Deployment & Operational Guide](./docs/deployment.md)


