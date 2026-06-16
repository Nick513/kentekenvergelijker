-- Drop vehicle_configurations, which was accidentally recreated by a botched
-- migration CLI run. The table and all application code referencing it were
-- already removed in 20260616155258_drop_catalog_tables.sql.

drop table if exists public.vehicle_configurations cascade;
