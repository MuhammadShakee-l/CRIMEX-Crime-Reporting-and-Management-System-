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
- [Roles & Access](#roles--access)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [AI / RAG Backend](#ai--rag-backend)

---

## Features

- **Role-based dashboards** — distinct, purpose-built views for System Admin, Station Admin, and LEO
- **Case lifecycle management** — full status flow: `NEW → TRIAGED → ASSIGNED → IN_PROGRESS → CLOSED`, with configurable closure reasons
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
|---|---|
| [React 18](https://react.dev/) | UI framework |
| [Vite](https://vitejs.dev/) | Build tooling & dev server |
| [React Router v6](https://reactrouter.com/) | Client-side routing |
| [Tailwind CSS v3](https://tailwindcss.com/) | Utility-first styling |
| [Framer Motion](https://www.framer.com/motion/) | Animations |
| [Heroicons](https://heroicons.com/) | Icon set |
| [Axios](https://axios-http.com/) | HTTP client |
| [React Toastify](https://fkhadra.github.io/react-toastify/) | Toast notifications |

### AI / Backend Utilities

| Technology | Purpose |
|---|---|
| [Streamlit](https://streamlit.io/) | Interactive AI demo UI |
| [FAISS](https://faiss.ai/) | Dense vector search index |
| [BM25 (rank-bm25)](https://github.com/dorianbrown/rank_bm25) | Sparse keyword retrieval |
| [Sentence Transformers](https://www.sbert.net/) | Semantic embeddings |
| [Hugging Face Transformers](https://huggingface.co/docs/transformers/) | Seq2Seq generation model |
| [scikit-learn](https://scikit-learn.org/) | ML utilities |
| [NumPy / Pandas](https://numpy.org/) | Data processing |

---

## Project Structure

```
CRIMEX/
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.cjs
├── package.json
└── src/
    ├── App.jsx                  # Root router
    ├── main.jsx                 # Entry point
    ├── components/              # Shared UI components
    │   ├── Layout.jsx
    │   ├── Sidebar.jsx
    │   ├── Topbar.jsx
    │   ├── StatCard.jsx
    │   ├── DataTable.jsx
    │   ├── Modal.jsx
    │   └── ...
    ├── contexts/
    │   └── AuthContext.jsx      # JWT auth state & helpers
    ├── pages/
    │   ├── public/              # Landing page
    │   ├── auth/                # Login, Signup, ForgotPassword
    │   ├── officer/             # LEO dashboards & tools
    │   ├── station/             # Station admin views
    │   └── admin/               # System admin views
    ├── routes/
    │   └── ProtectedRoute.jsx   # Role-based route guard
    ├── services/
    │   ├── api.js               # Axios instance
    │   └── mock.js              # Mock API adapter
    └── utils/
        ├── constants.js         # Roles, statuses, status flow
        ├── rag_pipeline.py      # Hybrid BM25 + FAISS RAG pipeline
        ├── streamlit_app.py     # Streamlit AI demo
        ├── evaluate.py          # RAG evaluation
        └── ...
```

---

## Roles & Access

| Role | Path Prefix | Capabilities |
|---|---|---|
| **Citizen** | `/` | Report incidents via public homepage |
| **LEO (Officer)** | `/officer/` | View assigned cases, background search, behavioral patterns |
| **Station Admin** | `/station/` | Assign/manage cases, view LEO roster, workload & hotspot analysis |
| **System Admin** | `/admin/` | Full user management, system-wide dashboard |

Access to protected routes is enforced by `ProtectedRoute.jsx`, which checks the authenticated user's role against the allowed roles for each route.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- npm v9+

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
|---|---|
| `npm run dev` | Start the Vite dev server with hot reload |
| `npm run build` | Build the production bundle |
| `npm run preview` | Preview the production build locally |

---

## AI / RAG Backend

The utils directory contains a Python-based **Retrieval-Augmented Generation (RAG)** pipeline for intelligent case-related queries:

- **rag_pipeline.py** — hybrid retrieval combining BM25 (sparse) and FAISS (dense) search, with a Seq2Seq generation step
- **`preprocess.py`** — ingests and indexes raw case documents
- **`evaluate.py`** — evaluates retrieval quality with custom metrics
- **`streamlit_app.py`** — interactive Streamlit demo UI for the RAG pipeline

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
