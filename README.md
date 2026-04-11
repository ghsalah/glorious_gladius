# Glorious Gladius

MVP for a delivery company: admin dashboard (React + Vite), Django REST API with SQLite, and Google Maps for routing and live fleet views.

## Backend (Django REST Framework + SQLite)

### Prerequisites

- Python 3.11+

### Setup

```bash
cd glorious_gladius/backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_admin
python manage.py runserver 0.0.0.0:8000
```

Default administrator (created by `seed_admin` if missing):

- **Email:** `admin@glorious-gladius.local`
- **Password:** `admin@123`

API routes (JSON, JWT `Authorization: Bearer …` except login):

- `POST /auth/login`, `GET /auth/me`, `POST /auth/change-password`
- `GET|POST /drivers`, `PATCH|DELETE /drivers/<uuid>`
- `GET|POST /deliveries`, `PATCH /deliveries/<uuid>/assign`, `PATCH /deliveries/<uuid>/unassign`
- `GET /tracking/drivers/latest`

Django admin (`/admin/`) uses the same user model; staff users can manage data there with server-side validation.

## Admin dashboard (React + Vite + Tailwind)

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
cd glorious_gladius/admin
cp .env.example .env
# Set VITE_API_URL to your API (default http://127.0.0.1:8000). Add VITE_GOOGLE_MAPS_API_KEY for maps.
npm install
npm run dev
```

Open `http://localhost:5173`, sign in with the admin above, and use **Change password** in the header when you need to rotate credentials.

### Build (Vercel / static host)

```bash
npm run build
npm run preview
```

Set `VITE_API_URL` in the host environment to your deployed Django origin. Enable CORS for that origin in `backend/config/settings.py` (`CORS_ALLOWED_ORIGINS`).

## Next steps

- Driver mobile app using driver JWT endpoints (not included here)
- Real-time GPS writes to `DriverLocation` (e.g. WebSockets) instead of polling
