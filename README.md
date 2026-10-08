# Catoshi Vault Rush

Catoshi Vault Rush includes free Vault Run, Speed Trials, and real-time multiplayer races. Multiplayer is available from the home screen and runs as an isolated child service behind the same-origin `/mp/` proxy, so the solo game remains available if the multiplayer service is offline.

## Run locally

Use Node.js 24, install the dependencies, then start the main site:

```sh
npm install
npm start
```

Open `http://localhost:3000` and choose **MULTIPLAYER**. The main service starts the multiplayer child process automatically. To run only the standalone multiplayer service for development, use `npm run start:multiplayer`.

Multiplayer data is stored alongside the main database by default. Set `DATABASE_PATH` or `MP_DATABASE_PATH` to persistent storage when deploying. The Docker image installs the runtime dependencies and starts the integrated main service on port 3000.

Entry to every mode is free. Vault Run remains playable without wallet connection, signing, deposits, or token holdings.
