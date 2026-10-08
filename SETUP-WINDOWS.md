# Windows quick start

1. Install Node.js LTS and PostgreSQL, or run only PostgreSQL with Docker Desktop.
2. Open two VS Code terminals.
3. Database: `docker compose up -d postgres`.
4. Backend: `cd backend`, copy `.env.example` to `.env`, set `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/civicpulse` and a JWT secret of 32+ characters, then run `npm install`, `npm run migrate`, `npm run seed`, `npm start`.
5. Frontend: `cd frontend`, copy `.env.example` to `.env`, then run `npm install` and `npm run dev`.
6. For real AI, add your Anthropic key to `backend/.env`. For image storage, add Cloudinary keys. The current Anthropic default is `claude-haiku-4-5-20251001`; Anthropic lists that model as active as of October 2026. Change `ANTHROPIC_MODEL` as needed for your account. 
