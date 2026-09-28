#  CRM Portal & Team Collaboration System

A modern, full-stack enterprise CRM and workforce management portal built with **Django REST Framework** and **React (Vite)**. Features role-based dashboards, project & task delegation, real-time shift clock-in/out attendance tracking, leave request workflows, team messaging, and invoice management.

---

##  Key Features

###  1. Role-Based Access Control (RBAC)
- **Executive Manager**: Organization-wide metrics, employee directory & onboarding, client & billing management, attendance roster oversight, and leave request approvals.
- **Team Lead**: Per-project task delegation, sprint tracking, employee progress reports, shift punches, and team attendance roster.
- **Employee**: Daily assigned tasks, live shift punch clock with real-time ticker, leave application and balance tracker, profile management, and secure password updates.

###  2. Shift Punch & Attendance Management
- **Live Shift Punch Widget**: Real-time wall clock and live elapsed shift counter.
- **Attendance History Log**: Detailed log tracking clock-in, clock-out, total hours worked, and presence status (`PRESENT`, `HALF_DAY`, `ON_LEAVE`, `ABSENT`).
- **Team Attendance Roster**: Real-time shift status across departments with instant search and online presence indicators.

###  3. Leave Management & Balances
- **Balance Allocation Tracker**: Annual, Casual, and Sick leave quotas with allocated vs. used counters.
- **Application Workflow**: Leave requests with multi-day calculation, manager notes, and email notifications.
- **Approval System**: Filter by status (`PENDING`, `APPROVED`, `REJECTED`) with one-click approval and rejection reasons.

###  4. Projects, Tasks & Collaboration
- **Project Delegation**: Budgeting, timelines, team member allocations ("hired to team").
- **Task Management**: Priorities (`URGENT`, `HIGH`, `MEDIUM`, `LOW`), status progression, task review feedback, and file attachments (images, PDF documents).
- **Internal Messenger**: Team channels, direct messaging, user presence dots, and audio/video calling modals.

###  5. Invoicing & Billing
- Client billing and invoice generation with tax calculations, payment status tracking, and transaction logging.

---

##  Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, React Router, Lucide Icons, Vanilla CSS (Glassmorphism & Modern Design System) |
| **Backend** | Python 3.10+, Django 4.2 LTS, Django REST Framework (DRF) |
| **Authentication** | JWT (`djangorestframework-simplejwt`), role token claims, secure password hashing |
| **Database** | SQLite (Default for local development) / PostgreSQL ready |
| **Email Service** | SMTP with dual-port fallback (Port 465 SSL / Port 587 TLS) + Console backend fallback |
| **Media Handling** | Pillow (image processing, thumbnails, PDF document uploads) |

---

## Repository Structure

```text
crm_portal/
├── backend/                  # Django REST Framework backend
│   ├── api/                  # Application models, serializers, views, and migrations
│   │   ├── management/       # Custom commands (e.g. create_manager)
│   │   ├── middleware.py     # User presence & activity tracking
│   │   ├── utils.py          # Email notification and helper functions
│   │   └── views.py          # REST API endpoints & viewsets
│   ├── crm_backend/          # Project settings, routing, and WSGI configuration
│   ├── .env.example          # Environment variable template
│   ├── manage.py             # Django CLI management script
│   ├── requirements.txt      # Python dependencies
│   └── seed_db.py            # Development database seeder
├── frontend/                 # React + Vite frontend
│   ├── public/               # Static assets & icons
│   ├── src/
│   │   ├── assets/           # UI graphics & logos
│   │   ├── components/       # Reusable components (Navbar, Sidebar, Modals, Tables)
│   │   ├── context/          # Auth, Messenger, and Notification React contexts
│   │   ├── pages/            # Role dashboards (Manager, TeamLead, Employee, Login)
│   │   ├── services/         # Axios API client with auto port-retry interceptor
│   │   ├── index.css         # Global design tokens, themes & table styles
│   │   └── main.jsx          # Frontend entry point
│   ├── .env.example          # Frontend environment template
│   ├── package.json          # Node dependencies and scripts
│   └── vite.config.js        # Vite configuration
├── .gitignore                # Comprehensive root Git exclusion rules
└── README.md                 # Project documentation
```

---

## Quick Start Guide

### Prerequisites
- **Python** 3.10 or higher
- **Node.js** 18+ and **npm**
- **Git**

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/<your-username>/crm_portal.git
cd crm_portal
```

---

### Step 2: Backend Setup (Django)

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment**:
   ```bash
   # On Windows (PowerShell):
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # On macOS/Linux:
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**:
   Copy `.env.example` to `.env`:
   ```bash
   # On Windows:
   copy .env.example .env

   # On macOS/Linux:
   cp .env.example .env
   ```
   *Edit `.env` to configure your custom `SECRET_KEY` and optional Gmail SMTP credentials.*

5. **Run database migrations**:
   ```bash
   python manage.py migrate
   ```

6. **(Optional) Seed demo development data**:
   ```bash
   python seed_db.py
   ```
   *This populates sample clients, projects, tasks, attendance records, and test user accounts.*

7. **Start the Django development server**:
   ```bash
   python manage.py runserver
   ```
   The backend API will run at `http://127.0.0.1:8000/api/`.

---

### Step 3: Frontend Setup (React + Vite)

1. **Open a new terminal and navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install Node packages**:
   ```bash
   npm install
   ```

3. **Configure environment variables (optional)**:
   ```bash
   # On Windows:
   copy .env.example .env

   # On macOS/Linux:
   cp .env.example .env
   ```
   *By default, the frontend automatically connects to `http://127.0.0.1:8000/api`.*

4. **Launch the development server**:
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:5173`.

---

##  Default Demo Accounts

If you ran `python seed_db.py`, the following demo accounts are available:

| Role | Username | Default Password | Primary Dashboard |
| :--- | :--- | :--- | :--- |
| **Manager** | `manager` | `admin123` | Executive KPI Overview, Staff Roster, Invoices, Approvals |
| **Team Lead** | `teamlead1` | `lead123` | Project Tasks, Team Performance, Sprint Tracking |
| **Employee** | `employee1` | `dev123` | Shift Clock-in, Daily Tasks, Leave Applications |

> [!WARNING]
> These demo credentials are for **local testing only**. In production, create your admin account using `python manage.py createsuperuser` or `python manage.py create_manager` and set strong passwords.

---

##  Security Best Practices

- **Never Commit Secrets**: Real credentials (such as Google App Passwords, database passwords, or JWT keys) must remain in `.env` and are strictly ignored by `.gitignore`.
- **Database Safety**: The `seed_db.py` script includes a safeguard that prevents execution when `DEBUG=False` unless `ALLOW_SEED_DB=true` is explicitly provided.
- **Production Deployment**:
  - Set `DEBUG=False` in your production environment.
  - Set a unique, strong `SECRET_KEY`.
  - Configure `ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS` to match your production domain.
  - Serve uploaded media files via a dedicated object store (S3, Cloud Storage) or secured reverse proxy (Nginx).

---

##  Contributing

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

##  License

This project is licensed under the [MIT License](LICENSE).
# Enterprise-CRM-Portal
