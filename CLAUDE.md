# Instructions

Do not make any changes until you have 95% confidence in what you need to build. Ask me follow up questions until you reach that confidence.

# n8n to App

Convert n8n automations into production web apps. Each workflow becomes a standalone Next.js app deployed on Vercel via its own GitHub repo.

## Build Order

1. **Workflow** — build and test the n8n automation end-to-end
2. **Validate** — confirm output data structure and quality
3. **Frontend** — build the Next.js UI that triggers the workflow and displays results
4. **Ship** — push to GitHub, deploy on Vercel

Never start the frontend until the workflow is proven.

## Tech Stack

| Layer | Tool |
|---|---|
| Automation | n8n (self-hosted) |
| Frontend | Next.js + React + TypeScript |
| Deployment | Vercel |
| Version control | GitHub (one repo per app) |
| Maps data | Google Places API (via n8n HTTP Request node) |
| Output | Google Sheets (via n8n Google Sheets node) |

## MCPs & Skills

- **n8n MCP** — read/modify workflows on the live n8n instance
- **GitHub MCP** — create repos, commit, push code
- **n8n skill** — workflow and node configuration expertise
- **Frontend designer skill** — UI design and component building

## Apps

| App | Repo | Status |
|---|---|---|
| Lead Finder | TBD | Planning |

## Lead Finder Spec

**Purpose**: Find local businesses via Google Places API and export to Google Sheets.

**Inputs**
- Business type (e.g. restaurant, gym, school)
- Location / address
- Search radius

**Output fields**
- Business name
- Address
- Phone number
- Contact email
- Key person (owner or decision-maker)

**Behavior**
- 20 results per workflow run
- Appends to existing sheet — no duplicates
- Stops at 200 results per search session
- Paginates automatically if more results exist

## File Conventions

- Each app lives in its own GitHub repo
- n8n workflow JSON exports saved to `/workflows/` in each app repo
- No shared packages across apps — each app is fully self-contained
- Environment variables go in `.env.local` (never committed)
