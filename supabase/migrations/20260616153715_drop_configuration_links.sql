-- Drop configuration_links.
--
-- This table was the explicit-link shortcut between RDW type-approval keys and
-- consumer catalog entries (vehicle_configurations). All rows were populated by
-- the legacy migration that also created the rdw:-prefixed vehicle_configurations
-- rows. Those rows were deleted in 20260616152905_cleanup.sql via ON DELETE CASCADE,
-- leaving configuration_links permanently empty.
--
-- The application code (lib/vehicles/catalog.ts) handles the empty case by falling
-- through to the trim-resolution heuristics, so dropping the table changes no
-- observable behaviour. The dead code path is removed in the same commit.

drop table public.configuration_links;
