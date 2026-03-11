# CRIMEX-Crime-Reporting-and-Management-System-
A role-based crime reporting &amp; case management platform with multiple dashboards, case lifecycle tracking, background search, hotspot analysis, and an AI-powered RAG backend built with React + Vite and Python.
  

```markdown
# CRIMEX — Crime Reporting & Management System

> A modern, role-based crime reporting and case management platform designed to improve public safety. Citizens can report incidents quickly, Law Enforcement Officers (LEOs) manage their assigned cases, Station Admins oversee the full station workload, and System Admins control user access — all from purpose-built dashboards.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Roles and Access](#roles-and-access)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [AI / RAG Backend](#ai--rag-backend)
- [License](#license)

---

## Features

- **Role-based dashboards** — distinct, purpose-built views for System Admin, Station Admin, and LEO
- **Case lifecycle management** — full status flow: `NEW → TRIAGED → ASSIGNED → IN_PROGRESS → CLOSED` with configurable closure reasons
- **Background search** — search criminal records by 13-digit CNIC or face photo upload
- **Behavioral patterns** — incident frequency and pattern-cluster analytics panel
- **Hotspot mapping** — geographic crime density visualization for station admins
- **Workload management** — officer caseload overview and assignment balancing
- **User management** — system admin can add, view, and manage all users
- **JWT authentication** — secure login with persistent sessions via localStorage
- **Toast notifications** — real-time feedback for all user actions

---

## Tech Stack

### Frontend

| Technology | Purpose |
| --- | --- |
| React 18 | UI framework |
| Vite | Build tooling and dev server |
| React Router v6 | Client-side routing |
| Tailwind CSS v3 | Utility-first styling |
| Framer Motion | Animations |
| Heroicons | Icon set |
| Axios | HTTP client |
| React Toastify | Toast notifications |

### AI / Backend Utilities

| Technology | Purpose |
| --- | --- |
| Streamlit | Interactive AI demo UI |
| FAISS | Dense vector search index |
| rank-bm25 | Sparse keyword retrieval |
| Sentence Transformers | Semantic embeddings |
| Hugging Face Transformers | Seq2Seq generation model |
| scikit-learn | ML utilities |
| NumPy / Pandas | Data processing |

---

## Project Structure

```
CRIMEX/
├── index.html
├── package.json
├── package-lock.json
├── postcss.config.cjs
├── tailwind.config.js
├── vite.config.js
└── src/
    ├── App.jsx
    ├── main.jsx
    ├── components/
    │   ├── CaseStatusTag.jsx
    │   ├── DataTable.jsx
    │   ├── Layout.jsx
    │   ├── Modal.jsx
    │   ├── RoleSidebar.jsx
    │   ├── Sidebar.jsx
    │   ├── StatCard.jsx
    │   ├── StatusChip.jsx
    │   ├── StatusPill.jsx
    │   ├── Table.jsx
    │   └── Topbar.jsx
    ├── contexts/
    │   └── AuthContext.jsx
    ├── pages/
    │   ├── admin/
    │   │   ├── AddUser.jsx
    │   │   ├── Approvals.jsx
    │   │   ├── Dashboard.jsx
    │   │   └── UsersList.jsx
    │   ├── auth/
    │   │   ├── ForgotPassword.jsx
    │   │   ├── Login.jsx
    │   │   └── Signup.jsx
    │   ├── officer/
    │   │   ├── BackgroundSearch.jsx
    │   │   ├── BehaviorPatterns.jsx
    │   │   ├── CaseDetail.jsx
    │   │   ├── CasesList.jsx
    │   │   └── Dashboard.jsx
    │   ├── public/
    │   │   └── Homepage.jsx
    │   └── station/
    │       ├── AssignedCases.jsx
    │       ├── CaseDetail.jsx
    │       ├── Dashboard.jsx
    │       ├── Hotspot.jsx
    │       ├── StationLeos.jsx
    │       ├── StationUsers.jsx
    │       ├── UnassignedCases.jsx
    │       └── Workload.jsx
    ├── routes/
    │   └── ProtectedRoute.jsx
    ├── services/
    │   ├── api.js
    │   └── mock.js
    ├── styles/
    │   └── global.css
    └── utils/
        ├── authPaths.js
        ├── build_index.py
        ├── config.py
        ├── constants.js
        ├── data_utils.py
        ├── designTokens.js
        ├── eval_utils.py
        ├── evaluate.py
        ├── format.js
        ├── logging_utils.py
        ├── preprocess.py
        ├── queryHelpers.js
        ├── rag_pipeline.py
        ├── requirements.txt
        ├── streamlit_app.py
        └── text_utils.py
```

---

## Roles and Access

| Role | Path Prefix | Capabilities |
| --- | --- | --- |
| Citizen | `/` | Report incidents via the public homepage |
| LEO (Officer) | `/officer/` | View assigned cases, background search, behavioral patterns |
| Station Admin | `/station/` | Assign and manage cases, view LEO roster, workload and hotspot analysis |
| System Admin | `/admin/` | Full user management, system-wide dashboard |

Access to protected routes is enforced by `ProtectedRoute.jsx`, which checks the authenticated user's role against the allowed roles defined for each route.

---

## Getting Started

### Prerequisites

- Node.js v18 or higher
- npm v9 or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/crimex.git
cd crimex

# Install dependencies
npm install
```

### Run the Development Server

```bash
npm run dev
```

The app will open automatically at `http://localhost:5173`.

---

## Available Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server with hot reload |
| `npm run build` | Build the production bundle |
| `npm run preview` | Preview the production build locally |

---

## AI / RAG Backend

The utils directory contains a Python-based Retrieval-Augmented Generation (RAG) pipeline for intelligent case-related queries.

- rag_pipeline.py — hybrid retrieval combining BM25 sparse search and FAISS dense search with a Seq2Seq generation step
- `preprocess.py` — ingests and indexes raw case documents
- `build_index.py` — builds the FAISS vector index
- `evaluate.py` and `eval_utils.py` — evaluate retrieval quality with custom metrics
- `streamlit_app.py` — interactive Streamlit demo UI for the RAG pipeline
- `data_utils.py`, `text_utils.py`, `logging_utils.py` — shared pipeline utilities
- `config.py` — centralized configuration for paths and model names

### Python Setup

```bash
cd src/utils
pip install -r requirements.txt
```

### Run the Streamlit App

```bash
streamlit run streamlit_app.py
```

---

## License

This project is intended for academic and demonstration purposes.
