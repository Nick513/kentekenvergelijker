-- Drop the catalog tables that were never populated.
--
-- vehicle_configuration_specification_values and vehicle_configurations were
-- designed for a pre-scraped brand/model/trim catalog. No ingestion pipeline
-- ever ran, so both tables have always been empty. The application code that
-- queried them (lib/vehicles/catalog.ts) has been removed in the same commit.

drop table public.vehicle_configuration_specification_values;
drop table public.vehicle_configurations;
