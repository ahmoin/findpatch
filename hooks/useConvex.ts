import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

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
	return useMutation(api.myFunctions.cleanupExpiredCache);
}
