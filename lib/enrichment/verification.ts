import type { SpecVerification } from "@/lib/enrichment/types";
import type { SpecificationValueSource } from "@/lib/specifications/types";

/** Equipment and option specs that can differ within the same marketing trim. */
export const TRIM_VARIABLE_SPEC_KEYS = new Set([
  "trim_package",
  "adaptive_cruise_control",
  "lane_assist",
  "lane_keep_assist",
  "blind_spot_monitor",
  "traffic_sign_recognition",
  "autonomous_emergency_braking",
  "parking_assist",
  "heated_seats",
  "heated_steering_wheel",
  "leather_upholstery",
  "dual_zone_climate_control",
  "electric_seats",
  "ventilated_front_seats",
  "keyless_entry",
  "smartphone_key",
  "electric_tailgate",
  "panoramic_roof",
  "sunroof",
  "led_headlights",
  "adaptive_headlights",
  "xenon_headlights",
  "parking_sensors_front",
  "parking_sensors_rear",
  "parking_camera",
  "tow_hitch",
  "navigation",
  "apple_carplay",
  "android_auto",
  "wireless_phone_charging",
  "head_up_display",
  "audio_system",
  "cruise_control",
  "metallic_paint",
  "alloy_wheels",
  "roof_rails",
]);

export function isTrimVariableSpec(specKey: string): boolean {
  return TRIM_VARIABLE_SPEC_KEYS.has(specKey);
}

export function verificationForCatalogSpec(
  specKey: string,
  valueSource: SpecificationValueSource,
): SpecVerification {
  if (valueSource === "rdw") {
    return "verified";
  }
  if (valueSource === "equipment" || isTrimVariableSpec(specKey)) {
    return "trim_inferred";
  }
  return "trim_inferred";
}

export function isUnverifiedForDisplay(verification: SpecVerification): boolean {
  return verification === "trim_inferred";
}
