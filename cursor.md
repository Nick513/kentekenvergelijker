# Cursor project notes

## Design system

Before changing UI, styling, colors, or components, read **`docs/design-system.md`**.

Use `kv-*` design tokens and component classes from `app/globals.css`. Do not introduce generic `blue-*` or `slate-*` palette for new work.

## Typography

Never use the em dash character (Unicode U+2014) anywhere in this project: code, UI copy, metadata, README, comments, or docs.

Use a regular hyphen (`-`), a comma, or rephrase the sentence instead.

## Database

Always use English names for database objects: table and column names, constraints, indexes, enums, functions, and triggers.

Dutch is fine for UI copy and user-facing labels. External APIs (e.g. RDW) may use Dutch field names in JSON; map those to English columns when persisting to Supabase.
