import { unstable_cache } from "next/cache";
import { fetchRdwFuel, fetchRdwVehicle } from "@/lib/rdw/client";
import type { RdwFuelRecord, RdwVehicleRecord } from "@/lib/rdw/types";

const CACHE_TTL_SECONDS = 3600;

function getCached<T>(
  cacheKey: string,
  licensePlate: string,
  fetcher: (plate: string) => Promise<T>,
): Promise<T> {
  return unstable_cache(
    async () => fetcher(licensePlate),
    [cacheKey, licensePlate],
    { revalidate: CACHE_TTL_SECONDS },
  )();
}

export function getCachedRdwVehicle(
  licensePlate: string,
): Promise<RdwVehicleRecord> {
  return getCached("rdw-vehicle", licensePlate, fetchRdwVehicle);
}

export function getCachedRdwFuel(
  licensePlate: string,
): Promise<RdwFuelRecord[]> {
  return getCached("rdw-fuel", licensePlate, fetchRdwFuel);
}
