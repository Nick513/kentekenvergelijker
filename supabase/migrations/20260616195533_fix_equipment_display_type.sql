-- The carbase migration added these equipment spec rows with display_type='text',
-- which means listing boolean values (valueBoolean: true, valueText: null) always
-- resolve to '-' in the UI. Fix by switching to boolean so ✓/✗ renders correctly.
-- Also corrects value_source to 'equipment' since these are listing-detected features,
-- not catalog text data.

update public.specifications
set
  display_type  = 'boolean',
  value_source  = 'equipment'
where spec_key in (
  'cruise_control',
  'rain_sensor',
  'high_beam_assist',
  'tire_pressure_monitor',
  'stability_control',
  'air_conditioning',
  'head_up_display',
  'electric_parking_brake',
  'start_stop_system',
  'sport_seats',
  'isofix',
  'xenon_headlights',
  'fog_lights',
  'alloy_wheels',
  'roof_rails',
  'folding_mirrors',
  'bluetooth',
  'dab_radio',
  'digital_instrument_cluster'
);

-- heated_windscreen already exists (added in 20260616152905_cleanup.sql).
