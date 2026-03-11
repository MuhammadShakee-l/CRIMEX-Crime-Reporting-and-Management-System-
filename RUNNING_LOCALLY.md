Running the app locally

Option A — Run with Docker (recommended if you don't want to install Node locally):

1. Install Docker Desktop: https://docs.docker.com/get-docker/
2. From the project root run:

```bash
docker-compose up --build
```

3. Open http://localhost:5173 in your browser.

Option B — Install Node.js locally (Windows):

1. Install Node.js LTS from https://nodejs.org/ (includes npm)
2. From the project root run:

```bash
npm install
npm run dev
```

Vite will open the app; if it doesn't, browse to http://localhost:5173

Notes
- The Docker/devcontainer binds Vite to 0.0.0.0 so the port is reachable from the host.
- If you open the repo in VS Code with the Remote - Containers extension, the devcontainer will run and install dependencies automatically.
