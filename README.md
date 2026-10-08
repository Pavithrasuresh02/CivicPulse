# CivicPulse — Complete Hackathon Build

**Tagline:** Your Problem. Our Priority.

This repository extends the Phase 13 backend foundation into a complete mobile-first civic complaint platform with:

- Citizen / Officer / Admin role separation
- First-time Civic Decision Challenge with resume + Civic Mind Score
- Complaint intake with optional image uploads
- Anthropic Claude AI classification with structured JSON parsing and confidence review
- AI-assisted related-report detection + underlying Civic Issue grouping
- Deterministic priority scoring
- Deterministic department / jurisdiction / officer routing
- Officer case management + resolution evidence
- Citizen verification + Bronze/Silver/Gold/Platinum badges
- Admin global dashboard, AI review/rerouting, analytics, recognition center
- Cloudinary-backed image storage
- PostgreSQL persistence
- Responsive React/Vite frontend

## Local setup

### 1. Database
Create a PostgreSQL database named `civicpulse` and set `backend/.env` from `.env.example`.

### 2. Backend
```bash
cd backend
npm install
npm run migrate
npm run seed
npm start
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend expects `VITE_API_URL=http://localhost:5000/api` by default.

## Demo seed credentials

- Citizen: `citizen1@demo.civicpulse.test` / `Demo@12345`
- Citizen (challenge incomplete): `citizen5@demo.civicpulse.test` / `Demo@12345`
- Officer: use a seeded login such as `OFF-WAT-001` / `Demo@12345`, department `WATER`
- Admin: `ADM-001` / `Admin@12345`

Seed is development/demo data. Do not use demo passwords in production.

## External services

Set:
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL` (default is `claude-haiku-4-5-20251001`)
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

The complaint is persisted before AI processing. If Claude fails, the complaint remains stored with `ai_status=FAILED` and can be retried by Admin.

## Deployment

Backend is ready for Render. Frontend can be deployed to Vercel. Use environment variables instead of hardcoded secrets/URLs.
