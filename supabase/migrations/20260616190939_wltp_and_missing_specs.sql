-- Add specs that carbase provides but were missing from the catalog.
--
-- 1. WLTP combined fuel consumption — carbase shows this under "VERBRUIK (WLTP)"
--    as "verbruik gecombineerd". Previously there was no spec_key to receive it,
--    so the value was silently dropped. Added to the powertrain group next to the
--    existing WLTP electric-range and electric-consumption specs.
--
-- 2. Parking sensors front/rear — carbase returns "parkeersensoren: ja, voor & achter"
--    which the scraper now splits into two spec keys. The rear key already existed
--    (parking_sensors_rear from the original migration); only the front key is new.
--    Confirm the rear spec still has the right value_source while we're here.

-- ---------------------------------------------------------------------------
-- 1. WLTP fuel consumption
-- ---------------------------------------------------------------------------

insert into public.specifications (
  spec_key, group_key, group_label, group_sort_order, label, sort_order,
  value_source, value_key, display_type
) values (
  'fuel_consumption_combined_wltp',
  'powertrain', 'Motor & aandrijving', 3,
  'Verbruik gecombineerd (WLTP)', 86,
  'catalog', 'fuel_consumption_combined_wltp', 'text'
) on conflict (spec_key) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Parking sensors front (rear already exists)
-- ---------------------------------------------------------------------------

insert into public.specifications (
  spec_key, group_key, group_label, group_sort_order, label, sort_order,
  value_source, value_key, display_type
) values (
  'parking_sensors_front',
  'exterior', 'Exterieur & licht', 6,
  'Parkeersensoren voor', 25,
  'equipment', 'parking_sensors_front', 'boolean'
) on conflict (spec_key) do nothing;
