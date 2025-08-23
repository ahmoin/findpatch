import { useEffect, useState } from "react";

interface MapLocation {
	latitude: number;
	longitude: number;
	zoom: number;
}

const STORAGE_KEY = "findpatch_map_location";

export function useMapLocation(initialLocation?: MapLocation) {
	const [location, setLocation] = useState<MapLocation | null>(() => {
		if (typeof window !== "undefined") {
			try {
				const stored = localStorage.getItem(STORAGE_KEY);
				if (stored) {
					const parsed = JSON.parse(stored);
					if (
						typeof parsed.latitude === "number" &&
						typeof parsed.longitude === "number" &&
						typeof parsed.zoom === "number" &&
						parsed.latitude >= -90 &&
						parsed.latitude <= 90 &&
						parsed.longitude >= -180 &&
						parsed.longitude <= 180 &&
						parsed.zoom >= 1 &&
						parsed.zoom <= 20
					) {
						console.log("Loaded map location from localStorage:", parsed);
						return parsed;
					}
				}
			} catch (error) {
				console.warn("Failed to load map location from localStorage:", error);
			}
		}

		return initialLocation || null;
	});

	useEffect(() => {
		if (location && typeof window !== "undefined") {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
				console.log("Saved map location to localStorage:", location);
			} catch (error) {
				console.warn("Failed to save map location to localStorage:", error);
			}
		}
	}, [location]);

	const updateLocation = (newLocation: Partial<MapLocation>) => {
		if (location) {
			setLocation((prev) =>
				prev
					? {
							...prev,
							...newLocation,
						}
					: null,
			);
		}
	};

	const resetLocation = () => {
		setLocation(null); // Reset to null to trigger geolocation
		if (typeof window !== "undefined") {
			localStorage.removeItem(STORAGE_KEY);
		}
	};

	return {
		location,
		setLocation,
		updateLocation,
		resetLocation,
		hasCachedLocation: location !== null,
	};
}
