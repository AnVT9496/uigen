# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Next.js dev server (Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest (unit tests)
npm run setup        # Install deps + Prisma generate + migrate
npm run db:reset     # Reset SQLite database
```

## Architecture

**UIGen** is a Next.js 15 app where users describe React components in chat and Claude generates/edits code shown in a live preview.

### Core Data Flow

1. User sends a message via the chat UI
2. `POST /api/chat` streams a response from Claude (Vercel AI SDK)
3. Claude calls tools (`str_replace_editor`, `file_manager`) to manipulate a virtual file system
4. The frontend receives file system updates via the stream and re-renders the preview iframe

### Key Directories

- `src/app/` — Next.js App Router: `page.tsx` (home), `[projectId]/page.tsx` (project view), `api/chat/route.ts` (main AI endpoint), `main-content.tsx` (resizable panel layout)
- `src/lib/` — Core logic:
  - `file-system.ts` — In-memory virtual FS (serialized to DB for persistence; no disk writes)
  - `provider.ts` — LLM provider abstraction (Anthropic Claude or mock fallback when no API key)
  - `tools/` — AI tool definitions passed to Claude
  - `prompts/` — System prompt for code generation
  - `contexts/` — `ChatContext` and `FileSystemContext` for shared state
- `src/components/` — UI split into `chat/`, `auth/`, `editor/` (Monaco), `preview/`, `ui/` (shadcn/ui)
- `src/actions/` — Server actions for auth and project CRUD
- `prisma/` — SQLite schema with `User` and `Project` models

### Virtual File System

The entire generated codebase lives in memory (`src/lib/file-system.ts`). Files are serialized as JSON and stored in the `Project.files` column. The preview iframe uses Babel Standalone to evaluate JSX directly in the browser.

### Authentication

JWT sessions via `jose` stored in HTTP-only cookies (7-day expiry). Passwords hashed with bcrypt. Anonymous users can use the app without signing in — state is local only.

### AI Integration

- Model: Anthropic Claude via `@ai-sdk/anthropic`
- Streaming: Vercel AI SDK `streamText` with tool calling
- Mock provider: Used automatically when `ANTHROPIC_API_KEY` is not set

### Tech Stack

Next.js 15 · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui (Radix UI) · Monaco Editor · Prisma + SQLite · Vercel AI SDK · Vitest
