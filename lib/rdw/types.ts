/** Raw record from RDW Gekentekende voertuigen (m9d7-ebf2). */
export type RdwVehicleRecord = {
  kenteken?: string;
  merk?: string;
  handelsbenaming?: string;
  voertuigsoort?: string;
  inrichting?: string;
  eerste_kleur?: string;
  aantal_deuren?: string;
  catalogusprijs?: string;
  vervaldatum_apk?: string;
  vervaldatum_apk_dt?: string;
  typegoedkeuringsnummer?: string;
  variant?: string;
  uitvoering?: string;
  volgnummer_wijziging_eu_typegoedkeuring?: string;
  europese_voertuigcategorie?: string;
  [key: string]: string | undefined;
};

/** Raw record from RDW Gekentekende voertuigen brandstof (8ys7-d773). */
export type RdwFuelRecord = {
  kenteken?: string;
  brandstof_omschrijving?: string;
  netto_max_vermogen_elektrisch?: string;
  nettomaximumvermogen?: string;
  elektrisch_verbruik_enkel_elektrisch_wltp?: string;
  actie_radius_enkel_elektrisch_wltp?: string;
  [key: string]: string | undefined;
};

export type VehicleSnapshot = {
  licensePlate: string;
  brand: string;
  modelName: string;
  vehicleType: string | null;
  bodyType: string | null;
  primaryColor: string | null;
  doorCount: number | null;
  catalogPrice: number | null;
  apkExpiryDate: string | null;
  fuelType: string | null;
  powerKw: number | null;
  electricRangeKm: number | null;
  europeanVehicleCategory: string | null;
  configurationKey: string;
  typeApprovalNumber: string | null;
  variant: string | null;
  rdwConfigurationCode: string | null;
};

export type PlateFetchResult =
  | { status: "ok"; snapshot: VehicleSnapshot }
  | { status: "not_found"; licensePlate: string }
  | { status: "error"; licensePlate: string; message: string };
