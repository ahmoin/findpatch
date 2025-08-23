import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

// Legacy hooks for backward compatibility
export function useCachedResources(
	lat: number,
	lon: number,
	zoom: number,
	resourceType: string,
) {
	return useQuery(api.myFunctions.getCachedResources, {
		lat,
		lon,
		zoom,
		resourceType,
	});
}

export function useCacheResources() {
	return useMutation(api.myFunctions.cacheResources);
}

export function useCleanupExpiredCache() {
	return useMutation(api.myFunctions.cleanupExpiredResources);
}

export function useResourcesInArea(
	lat: number,
	lon: number,
	radiusKm: number,
	resourceType: string,
) {
	return useQuery(api.myFunctions.getResourcesInArea, {
		lat,
		lon,
		radiusKm,
		resourceType,
	});
}

export function useUpsertResources() {
	return useMutation(api.myFunctions.upsertResources);
}

export function useAllResourcesByType(resourceType: string) {
	return useQuery(api.myFunctions.getAllResourcesByType, {
		resourceType,
	});
}
