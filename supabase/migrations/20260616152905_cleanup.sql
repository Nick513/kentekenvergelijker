-- Database cleanup.
--
-- 1. Extend plate_specification_values.verification to include listing_claim_structured.
--    This is required for the AutoScout24 structured enrichment introduced alongside this
--    migration — without it every INSERT from that source would violate the check constraint.
--
-- 2. Drop the configurations table.
--    This table stored RDW type-approval blobs (one row per homologated configuration).
--    It was populated by a one-time migration from the legacy vehicle_configurations table
--    but has never been queried by the application since. The application derives the same
--    data from the RDW OpenData API on demand and stores relevant fields on VehicleSnapshot.
--    configuration_links still references configuration_key as plain text after the FK is
--    removed; the column keeps its existing data and the application query (.eq on that
--    column) continues to work unchanged.
--
-- 3. Delete rdw:-prefixed rows from vehicle_configurations.
--    The same migration that created the new vehicle_configurations schema inserted these
--    rows as a bridge to the old schema (catalog_key = 'rdw:' || configuration_key).
--    Every application query excludes them with .not("catalog_key", "like", "rdw:%"), so
--    they have never been returned to the application. The ON DELETE CASCADE on
--    configuration_links means their child rows are cleaned up automatically.
--
-- 4. Add heated_windscreen as an equipment spec.
--    Used by the enrichment keyword list; needs to exist in specifications for the
--    plate_specification_values FK to accept it.

-- ---------------------------------------------------------------------------
-- 1. Extend verification check
-- ---------------------------------------------------------------------------

alter table public.plate_specification_values
  drop constraint plate_specification_values_verification_check;

alter table public.plate_specification_values
  add constraint plate_specification_values_verification_check
  check (verification in (
    'verified',
    'listing_claim_structured',
    'listing_claim',
    'trim_inferred'
  ));

-- ---------------------------------------------------------------------------
-- 2. Drop configurations (remove FK first)
-- ---------------------------------------------------------------------------

alter table public.configuration_links
  drop constraint configuration_links_configuration_key_fkey;

drop table public.configurations;

-- ---------------------------------------------------------------------------
-- 3. Delete rdw:-prefixed vehicle_configurations rows
--    (CASCADE deletes the corresponding configuration_links rows)
-- ---------------------------------------------------------------------------

delete from public.vehicle_configurations
where catalog_key like 'rdw:%';

-- ---------------------------------------------------------------------------
-- 4. Add heated_windscreen spec
-- ---------------------------------------------------------------------------

insert into public.specifications (
  spec_key, group_key, group_label, group_sort_order, label, sort_order,
  value_source, value_key, display_type
) values (
  'heated_windscreen', 'comfort', 'Comfort & interieur', 5, 'Verwarmde voorruit', 95,
  'equipment', 'heated_windscreen', 'boolean'
) on conflict (spec_key) do nothing;
