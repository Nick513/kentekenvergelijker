import type {
  RdwFuelRecord,
  RdwVehicleRecord,
  VehicleSnapshot,
} from "@/lib/rdw/types";

function parseOptionalInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function titleCaseWords(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function deriveConfigurationKey(
  vehicle: RdwVehicleRecord,
): string {
  const parts = [
    vehicle.typegoedkeuringsnummer ?? "",
    vehicle.variant ?? "",
    vehicle.uitvoering ?? "",
    vehicle.volgnummer_wijziging_eu_typegoedkeuring ?? "",
  ];
  return parts.join("|");
}

function pickPowerKw(fuelRecords: RdwFuelRecord[]): number | null {
  for (const fuel of fuelRecords) {
    const electric = parseOptionalNumber(fuel.netto_max_vermogen_elektrisch);
    if (electric !== null) return electric;
  }

  for (const fuel of fuelRecords) {
    const combustion = parseOptionalNumber(fuel.nettomaximumvermogen);
    if (combustion !== null) return combustion;
  }

  return null;
}

function pickFuelType(fuelRecords: RdwFuelRecord[]): string | null {
  const primary = fuelRecords[0]?.brandstof_omschrijving;
  return primary ? titleCaseWords(primary) : null;
}

function pickElectricRangeKm(fuelRecords: RdwFuelRecord[]): number | null {
  for (const fuel of fuelRecords) {
    const range = parseOptionalInt(fuel.actie_radius_enkel_elektrisch_wltp);
    if (range !== null) return range;
  }
  return null;
}

function pickElectricConsumptionWltp(
  fuelRecords: RdwFuelRecord[],
): number | null {
  for (const fuel of fuelRecords) {
    const consumption = parseOptionalNumber(
      fuel.elektrisch_verbruik_enkel_elektrisch_wltp,
    );
    if (consumption !== null) return consumption;
  }
  return null;
}

function pickCo2EmissionGKm(fuelRecords: RdwFuelRecord[]): number | null {
  for (const fuel of fuelRecords) {
    const co2 = parseOptionalInt(fuel.co2_uitstoot_gecombineerd);
    if (co2 !== null) return co2;
  }
  return null;
}

function pickEmissionStandard(fuelRecords: RdwFuelRecord[]): string | null {
  for (const fuel of fuelRecords) {
    const standard = fuel.uitlaatemissieniveau?.trim();
    if (standard) return standard;
  }
  return null;
}

function parseFirstRegistrationYear(vehicle: RdwVehicleRecord): number | null {
  if (vehicle.datum_eerste_toelating_dt) {
    const date = new Date(vehicle.datum_eerste_toelating_dt);
    if (!Number.isNaN(date.getTime())) {
      return date.getFullYear();
    }
  }

  const compact = vehicle.datum_eerste_toelating;
  if (compact && compact.length >= 4) {
    const year = Number.parseInt(compact.slice(0, 4), 10);
    return Number.isFinite(year) ? year : null;
  }

  return null;
}

function parseApkDate(vehicle: RdwVehicleRecord): string | null {
  if (vehicle.vervaldatum_apk_dt) {
    const date = new Date(vehicle.vervaldatum_apk_dt);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }

  const compact = vehicle.vervaldatum_apk;
  if (compact && compact.length === 8) {
    return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
  }

  return null;
}

export function mapRdwToSnapshot(
  licensePlate: string,
  vehicle: RdwVehicleRecord,
  fuelRecords: RdwFuelRecord[],
): VehicleSnapshot {
  const color = vehicle.eerste_kleur
    ? titleCaseWords(vehicle.eerste_kleur)
    : null;

  return {
    licensePlate,
    brand: vehicle.merk?.trim() ?? "Onbekend",
    modelName: vehicle.handelsbenaming?.trim() ?? "Onbekend",
    vehicleType: vehicle.voertuigsoort?.trim() ?? null,
    bodyType: vehicle.inrichting
      ? titleCaseWords(vehicle.inrichting.trim())
      : null,
    primaryColor: color,
    doorCount: parseOptionalInt(vehicle.aantal_deuren),
    seatCount: parseOptionalInt(vehicle.aantal_zitplaatsen),
    cylinderCount: parseOptionalInt(vehicle.aantal_cilinders),
    engineDisplacementCc: parseOptionalInt(vehicle.cilinderinhoud),
    firstRegistrationYear: parseFirstRegistrationYear(vehicle),
    catalogPrice: parseOptionalInt(vehicle.catalogusprijs),
    apkExpiryDate: parseApkDate(vehicle),
    vehicleLengthCm: parseOptionalInt(vehicle.lengte),
    vehicleWidthCm: parseOptionalInt(vehicle.breedte),
    vehicleHeightCm: parseOptionalInt(vehicle.hoogte_voertuig),
    wheelbaseCm: parseOptionalInt(vehicle.wielbasis),
    curbWeightKg: parseOptionalInt(vehicle.massa_rijklaar),
    emptyWeightKg: parseOptionalInt(vehicle.massa_ledig_voertuig),
    maxTowingWeightBrakedKg: parseOptionalInt(
      vehicle.maximum_trekken_massa_geremd,
    ),
    fuelType: pickFuelType(fuelRecords),
    powerKw: pickPowerKw(fuelRecords),
    electricRangeKm: pickElectricRangeKm(fuelRecords),
    electricConsumptionWltp: pickElectricConsumptionWltp(fuelRecords),
    co2EmissionGKm: pickCo2EmissionGKm(fuelRecords),
    emissionStandard: pickEmissionStandard(fuelRecords),
    europeanVehicleCategory: vehicle.europese_voertuigcategorie ?? null,
    configurationKey: deriveConfigurationKey(vehicle),
    typeApprovalNumber: vehicle.typegoedkeuringsnummer ?? null,
    variant: vehicle.variant ?? null,
    rdwConfigurationCode: vehicle.uitvoering ?? null,
  };
}

export function formatBrandModel(snapshot: VehicleSnapshot): string {
  return `${snapshot.brand} ${snapshot.modelName}`.trim();
}

export function formatPowerKw(powerKw: number | null): string {
  if (powerKw === null) return "-";
  const formatted = new Intl.NumberFormat("nl-NL", {
    maximumFractionDigits: 0,
  }).format(powerKw);
  return `${formatted} kW`;
}

export function formatCatalogPrice(price: number | null): string {
  if (price === null) return "-";
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatApkDate(isoDate: string | null): string {
  if (!isoDate) return "-";
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatElectricRange(km: number | null): string {
  if (km === null) return "-";
  const formatted = new Intl.NumberFormat("nl-NL").format(km);
  return `${formatted} km`;
}

export function formatCount(value: number | null): string {
  if (value === null) return "-";
  return new Intl.NumberFormat("nl-NL").format(value);
}

export function formatYear(year: number | null): string {
  if (year === null) return "-";
  return String(year);
}

export function formatMassKg(kg: number | null): string {
  if (kg === null) return "-";
  const formatted = new Intl.NumberFormat("nl-NL").format(kg);
  return `${formatted} kg`;
}

export function formatVolumeCc(cc: number | null): string {
  if (cc === null) return "-";
  const formatted = new Intl.NumberFormat("nl-NL").format(cc);
  return `${formatted} cc`;
}

export function formatLengthCm(cm: number | null): string {
  if (cm === null) return "-";
  const meters = cm / 100;
  return `${new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(meters)} m`;
}

export function formatCo2Emission(gKm: number | null): string {
  if (gKm === null) return "-";
  return `${new Intl.NumberFormat("nl-NL").format(gKm)} g/km`;
}

export function formatElectricConsumption(kwhPer100Km: number | null): string {
  if (kwhPer100Km === null) return "-";
  const formatted = new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(kwhPer100Km);
  return `${formatted} kWh/100 km`;
}
