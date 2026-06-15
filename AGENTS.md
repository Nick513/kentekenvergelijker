<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes: APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project conventions

Read `cursor.md` before changing UI or database work.

Database: always use English names for tables, columns, indexes, constraints, enums, functions, and triggers. Map Dutch external API fields to English at ingest time.

User-facing copy: never mention how data is fetched or stored. No APIs, registers, databases, or provider names in the app, SEO, or visitor-visible errors. See `cursor.md` for the full rule.
