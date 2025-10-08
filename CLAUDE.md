# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Discord-like chat application with a Rust backend (Axum) and Next.js frontend. The system uses a snapshot + SSE update architecture to keep clients synchronized with server state.

## Architecture

### Backend (Rust/Axum)

- **Framework**: Axum web server with SQLite database (in-memory for dev)
- **API Style**: REST endpoints + Server-Sent Events (SSE) for real-time updates
- **State Management**: Broadcast channels distribute updates to connected clients
- **TypeScript Generation**: Uses `ts-rs` to auto-generate TypeScript bindings from Rust structs

**Core modules**:
- `main.rs`: App initialization, route registration, serves static Next.js build
- `snapshot.rs`: Snapshot system (`/snapshot` endpoint) and SSE updates (`/updates` endpoint)
- `user.rs`, `server.rs`, `channel.rs`, `message.rs`: Domain models with insert methods and REST endpoints

**Database**: SQLx with compile-time query verification. Migrations in `migrations/` directory.

### Frontend (Next.js/React)

- **Framework**: Next.js 15 with Turbopack, exported as static build
- **State**: React Context (`AppStateProvider`) manages global snapshot state
- **Real-time Sync**: On mount, fetches snapshot and subscribes to SSE `/updates` endpoint
- **TypeScript Bindings**: Auto-generated in `frontend/src/bindings/` from Rust structs

**Update Handling**: `handleUpdate()` in `app-state.tsx` merges SSE updates into the snapshot.

### Synchronization Flow

1. Client fetches initial state via `/snapshot` (returns users, servers, channels, messages)
2. Client subscribes to `/updates` SSE stream
3. Backend broadcasts `Update` enum variants (User/Server/Channel/Message) on state changes
4. Frontend merges updates into local snapshot

## Development Commands

### Backend

```bash
# Initialize SQLite DB for sqlx compile-time verification
echo DATABASE_URL=sqlite://dev.db > .env
sqlx database create
sqlx migrate run

# Run backend (serves on http://0.0.0.0:3000)
cd backend
cargo run

# Add new migration
sqlx migrate add <name>
```

### Frontend

```bash
cd frontend

# Development server with Turbopack
npm run dev

# Production build (static export)
npm run build

# Lint
npm run lint
```

### Full Stack Development

Backend serves the frontend static build from `frontend/out/`, so:
1. Build frontend with `npm run build` in `frontend/`
2. Run backend with `cargo run` in `backend/`
3. Access app at http://localhost:3000

### API Documentation

Swagger UI available at http://localhost:3000/swagger-ui when backend is running.

## Key Patterns

### Adding a New Endpoint

1. Define struct with `#[derive(Serialize, Deserialize, TS, ToSchema)]` and `#[ts(export, export_to = "../../frontend/src/bindings/")]`
2. Create handler function with `#[utoipa::path(...)]` macro
3. Register route in `main.rs`
4. If state changes, broadcast update via `Sender`: `send.send(Event::default().json_data(Update::YourVariant(data))?)`
5. Handle update in frontend `handleUpdate()` function

### TypeScript Bindings

Rust structs with `#[derive(TS)]` and `#[ts(export, export_to = "...")]` auto-generate TypeScript definitions on build. Import from `@bindings/StructName`.

## Project Status

Currently at Milestone 1: basic messaging with servers/channels. No auth, permissions, or advanced features yet. See README.md for roadmap.
