import type { RdwFuelRecord, RdwVehicleRecord } from "@/lib/rdw/types";

const RDW_BASE_URL = "https://opendata.rdw.nl/resource";
const VEHICLE_DATASET = "m9d7-ebf2";
const FUEL_DATASET = "8ys7-d773";

const REQUEST_TIMEOUT_MS = 10_000;

export class RdwApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RdwApiError";
  }
}

export class RdwNotFoundError extends Error {
  constructor(readonly licensePlate: string) {
    super(`Kenteken niet gevonden: ${licensePlate}`);
    this.name = "RdwNotFoundError";
  }
}

function getAppToken(): string | undefined {
  return process.env.RDW_APP_TOKEN?.trim() || undefined;
}

function buildHeaders(): HeadersInit {
  const headers: HeadersInit = { Accept: "application/json" };
  const token = getAppToken();
  if (token) {
    headers["X-App-Token"] = token;
  }
  return headers;
}

async function rdwFetch<T>(dataset: string, licensePlate: string): Promise<T[]> {
  const url = new URL(`${RDW_BASE_URL}/${dataset}.json`);
  url.searchParams.set("kenteken", licensePlate);
  url.searchParams.set("$limit", "10");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: buildHeaders(),
      signal: controller.signal,
      cache: "no-store",
    });

    if (response.status === 429) {
      throw new RdwApiError("Te veel verzoeken. Probeer het later opnieuw.", 429);
    }

    if (!response.ok) {
      throw new RdwApiError(
        "Gegevens tijdelijk niet beschikbaar.",
        response.status,
      );
    }

    const data = (await response.json()) as T[];
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (error instanceof RdwApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new RdwApiError("Verzoek duurde te lang. Probeer het later opnieuw.", 408);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function rdwFetchWithRetry<T>(
  dataset: string,
  licensePlate: string,
): Promise<T[]> {
  try {
    return await rdwFetch<T>(dataset, licensePlate);
  } catch (error) {
    const shouldRetry =
      error instanceof RdwApiError &&
      (error.status >= 500 || error.status === 408);

    if (!shouldRetry) {
      throw error;
    }

    return rdwFetch<T>(dataset, licensePlate);
  }
}

export async function fetchRdwVehicle(
  licensePlate: string,
): Promise<RdwVehicleRecord> {
  const records = await rdwFetchWithRetry<RdwVehicleRecord>(
    VEHICLE_DATASET,
    licensePlate,
  );

  if (records.length === 0) {
    throw new RdwNotFoundError(licensePlate);
  }

  return records[0];
}

export async function fetchRdwFuel(
  licensePlate: string,
): Promise<RdwFuelRecord[]> {
  return rdwFetchWithRetry<RdwFuelRecord>(FUEL_DATASET, licensePlate);
}
