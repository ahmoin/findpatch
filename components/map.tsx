"use client";

import * as maptilersdk from "@maptiler/sdk";
import axios from "axios";
import * as React from "react";
import "@maptiler/sdk/dist/maptiler-sdk.css";
import { useQuery } from "convex/react";
import { useTheme } from "next-themes";
import { useMapLocation } from "@/hooks/useMapLocation";
import { api } from "../convex/_generated/api";

interface MapProps {
	startingPosition: {
		latitude: number;
		longitude: number;
	};
	deviceLocation?: {
		latitude: number;
		longitude: number;
	} | null;
}

interface Resource {
	type: string;
	name: string;
	color: string;
	icon: string;
	lat: number;
	lon: number;
	address?: string;
	verified?: boolean;
	confidence?: number;
	osmTags?: {
		phone?: string;
		website?: string;
		opening_hours?: string;
		addr_street?: string;
		addr_city?: string;
		addr_postcode?: string;
	};
}

export function MapView({ startingPosition, deviceLocation }: MapProps) {
	const mapContainer = React.useRef<HTMLDivElement>(null);
	const map = React.useRef<maptilersdk.Map | null>(null);
	const [resources, setResources] = React.useState<Resource[]>([]);
	const [cacheStatus, setCacheStatus] = React.useState<{
		[key: string]: { fromCache: boolean; cacheAge?: number };
	}>({});
	const markersRef = React.useRef<maptilersdk.Marker[]>([]);
	const userLocationMarker = React.useRef<maptilersdk.Marker | null>(null);
	const { theme: mode } = useTheme();

	const { location: mapLocation, updateLocation } = useMapLocation({
		latitude: startingPosition.latitude,
		longitude: startingPosition.longitude,
		zoom:
			startingPosition.latitude === 20 && startingPosition.longitude === 0
				? 2
				: 14,
	});

	const effectiveLocation = mapLocation || {
		latitude: startingPosition.latitude,
		longitude: startingPosition.longitude,
		zoom:
			startingPosition.latitude === 20 && startingPosition.longitude === 0
				? 2
				: 14,
	};

	React.useEffect(() => {
		if (map.current && startingPosition.latitude !== 20) {
			map.current.flyTo({
				center: [startingPosition.longitude, startingPosition.latitude],
				zoom: 14,
				duration: 2000,
			});
		}
	}, [startingPosition]);

	React.useEffect(() => {
		if (!map.current) return;

		if (deviceLocation) {
			if (userLocationMarker.current) {
				userLocationMarker.current.setLngLat([
					deviceLocation.longitude,
					deviceLocation.latitude,
				]);
			} else {
				const dotElement = document.createElement("div");
				dotElement.style.width = "12px";
				dotElement.style.height = "12px";
				dotElement.style.backgroundColor = "oklch(0.55 0.22 263)";
				dotElement.style.borderRadius = "50%";
				dotElement.style.border = "2px solid white";
				dotElement.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";

				userLocationMarker.current = new maptilersdk.Marker({
					element: dotElement,
				})
					.setLngLat([deviceLocation.longitude, deviceLocation.latitude])
					.addTo(map.current);
			}
		} else {
			if (userLocationMarker.current) {
				userLocationMarker.current.remove();
				userLocationMarker.current = null;
			}
		}
	}, [deviceLocation]);

	const [currentLocation, setCurrentLocation] = React.useState({
		lat: effectiveLocation.latitude,
		lon: effectiveLocation.longitude,
		zoom: effectiveLocation.zoom,
	});

	const baseRadius = 0.01;
	const radius = baseRadius * 2 ** (14 - currentLocation.zoom);
	const radiusKm = radius * 111;

	const legalCache = useQuery(api.myFunctions.getResourcesInArea, {
		lat: currentLocation.lat,
		lon: currentLocation.lon,
		radiusKm: radiusKm,
		resourceType: "legal",
	});
	const shelterCache = useQuery(api.myFunctions.getResourcesInArea, {
		lat: currentLocation.lat,
		lon: currentLocation.lon,
		radiusKm: radiusKm,
		resourceType: "shelter",
	});
	const healthcareCache = useQuery(api.myFunctions.getResourcesInArea, {
		lat: currentLocation.lat,
		lon: currentLocation.lon,
		radiusKm: radiusKm,
		resourceType: "healthcare",
	});
	const foodCache = useQuery(api.myFunctions.getResourcesInArea, {
		lat: currentLocation.lat,
		lon: currentLocation.lon,
		radiusKm: radiusKm,
		resourceType: "food",
	});

	const getCacheForResourceType = (resourceType: string) => {
		switch (resourceType) {
			case "legal":
				return legalCache
					? { resources: legalCache, fromCache: true, cacheAge: 0 }
					: null;
			case "shelter":
				return shelterCache
					? { resources: shelterCache, fromCache: true, cacheAge: 0 }
					: null;
			case "healthcare":
				return healthcareCache
					? { resources: healthcareCache, fromCache: true, cacheAge: 0 }
					: null;
			case "food":
				return foodCache
					? { resources: foodCache, fromCache: true, cacheAge: 0 }
					: null;
			default:
				return null;
		}
	};

	const fetchResourceLayer = async (
		lat: number,
		lon: number,
		zoom: number,
		resourceType: string,
		retryCount = 0,
	): Promise<Resource[]> => {
		try {
			const cachedData = getCacheForResourceType(resourceType);
			if (cachedData?.resources) {
				setCacheStatus((prev) => ({
					...prev,
					[resourceType]: {
						fromCache: true,
						cacheAge: cachedData.cacheAge,
					},
				}));

				return cachedData.resources;
			}

			const response = await axios.post("/api/resources", {
				lat,
				lon,
				zoom,
				resourceType,
			});

			setCacheStatus((prev) => ({
				...prev,
				[resourceType]: {
					fromCache: false,
					cacheAge: 0,
				},
			}));

			return response.data.resources;
		} catch (error: unknown) {
			console.error(`Error fetching ${resourceType} resources:`, error);

			const isAxiosError = (
				err: unknown,
			): err is { response?: { status: number } } => {
				return typeof err === "object" && err !== null && "response" in err;
			};

			if (isAxiosError(error) && error.response?.status === 429) {
				const maxRetries = 3;
				if (retryCount < maxRetries) {
					const delay = 2 ** retryCount * 1000;
					await new Promise((resolve) => setTimeout(resolve, delay));
					return fetchResourceLayer(
						lat,
						lon,
						zoom,
						resourceType,
						retryCount + 1,
					);
				}
			}

			return [];
		}
	};

	const clearMarkers = () => {
		markersRef.current.forEach((marker) => marker.remove());
		markersRef.current = [];
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: some dependencies change on every re-render and should not be used as hook dependencies.
	const fetchNearbyResources = React.useCallback(
		async (lat: number, lon: number, zoom: number) => {
			clearMarkers();

			const resourceTypes = ["legal", "shelter", "healthcare", "food"];
			let allResources: Resource[] = [];

			const cachedResources: Resource[] = [];
			const typesToFetch: string[] = [];

			for (const resourceType of resourceTypes) {
				const cachedData = getCacheForResourceType(resourceType);
				if (cachedData?.resources) {
					cachedResources.push(...cachedData.resources);
					setCacheStatus((prev) => ({
						...prev,
						[resourceType]: { fromCache: true, cacheAge: cachedData.cacheAge },
					}));
				} else {
					typesToFetch.push(resourceType);
				}
			}

			if (cachedResources.length > 0) {
				allResources = [...cachedResources];
				setResources([...allResources]);
			}

			for (const resourceType of typesToFetch) {
				const layerResources = await fetchResourceLayer(
					lat,
					lon,
					zoom,
					resourceType,
				);
				allResources = [...allResources, ...layerResources];

				setResources([...allResources]);

				if (layerResources.length > 3) {
					await new Promise((resolve) => setTimeout(resolve, 500));
				} else {
					console.log(
						`Only ${layerResources.length} ${resourceType} resources found, moving to next layer immediately`,
					);
				}
			}

			if (allResources.length === 0) {
				setResources([]);
			}
		},
		[],
	);

	React.useEffect(() => {
		const cachedResources: Resource[] = [];

		if (legalCache && legalCache.length > 0) {
			cachedResources.push(...legalCache);
			setCacheStatus((prev) => ({
				...prev,
				legal: { fromCache: true, cacheAge: 0 },
			}));
		}
		if (shelterCache && shelterCache.length > 0) {
			cachedResources.push(...shelterCache);
			setCacheStatus((prev) => ({
				...prev,
				shelter: { fromCache: true, cacheAge: 0 },
			}));
		}
		if (healthcareCache && healthcareCache.length > 0) {
			cachedResources.push(...healthcareCache);
			setCacheStatus((prev) => ({
				...prev,
				healthcare: { fromCache: true, cacheAge: 0 },
			}));
		}
		if (foodCache && foodCache.length > 0) {
			cachedResources.push(...foodCache);
			setCacheStatus((prev) => ({
				...prev,
				food: { fromCache: true, cacheAge: 0 },
			}));
		}

		if (cachedResources.length > 0) {
			setResources(cachedResources);
		}
	}, [legalCache, shelterCache, healthcareCache, foodCache]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: fetchNearbyResources changes on every re-render and should not be used as a hook dependency.
	React.useEffect(() => {
		if (map.current || !mapContainer.current) return;

		map.current = new maptilersdk.Map({
			container: mapContainer.current,
			forceNoAttributionControl: true,
			style:
				mode === "dark"
					? maptilersdk.MapStyle.BASIC.DARK
					: maptilersdk.MapStyle.BASIC.LIGHT,
			center: [effectiveLocation.longitude, effectiveLocation.latitude],
			zoom: effectiveLocation.zoom,
			navigationControl: true,
			geolocateControl: true,
			apiKey: process.env.NEXT_PUBLIC_MAPTILER_API_KEY,
		});

		const initialZoom = map.current.getZoom();
		fetchNearbyResources(
			effectiveLocation.latitude,
			effectiveLocation.longitude,
			initialZoom,
		);

		let updateTimeout: NodeJS.Timeout;

		const handleMapUpdate = () => {
			if (!map.current) return;

			clearTimeout(updateTimeout);
			updateTimeout = setTimeout(() => {
				if (!map.current) return;

				const center = map.current.getCenter();
				const zoom = map.current.getZoom();

				setCurrentLocation({ lat: center.lat, lon: center.lng, zoom });
				updateLocation({
					latitude: center.lat,
					longitude: center.lng,
					zoom: zoom,
				});

				fetchNearbyResources(center.lat, center.lng, zoom);
			}, 1000);
		};

		map.current.on("moveend", handleMapUpdate);
		map.current.on("zoomend", handleMapUpdate);

		return () => {
			if (map.current) {
				map.current.remove();
				map.current = null;
			}
		};
	}, []);

	React.useEffect(() => {
		if (!map.current || resources.length === 0) return;

		resources.forEach((resource) => {
			if (!map.current) return;

			if (
				!resource.lat ||
				!resource.lon ||
				Number.isNaN(resource.lat) ||
				Number.isNaN(resource.lon)
			) {
				console.warn(`Skipping resource with invalid coordinates:`, {
					name: resource.name,
					lat: resource.lat,
					lon: resource.lon,
					type: resource.type,
				});
				return;
			}

			const resourceElement = document.createElement("div");
			resourceElement.style.width = "32px";
			resourceElement.style.height = "32px";
			resourceElement.style.backgroundColor = resource.color;
			resourceElement.style.borderRadius = "50%";
			resourceElement.style.border = "2px solid white";
			resourceElement.style.display = "flex";
			resourceElement.style.alignItems = "center";
			resourceElement.style.justifyContent = "center";
			resourceElement.style.fontSize = "16px";
			resourceElement.style.cursor = "pointer";
			resourceElement.innerHTML = resource.icon;

			const popup = new maptilersdk.Popup({
				offset: 25,
				closeButton: false,
			}).setHTML(
				`<div style="padding: 8px 10px; max-width: 280px;">
					<div style="font-size: 14px; font-weight: bold; margin-bottom: 4px; color: #333;">
						${resource.name}
						${resource.verified ? '<span style="color: #22c55e; margin-left: 4px;">✓</span>' : ""}
					</div>
					<div style="color: ${resource.color}; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
						${resource.icon} ${resource.type}
						${resource.confidence ? `<span style="color: #666; margin-left: 8px;">${Math.round(resource.confidence * 100)}% confidence</span>` : ""}
					</div>
					${resource.address ? `<div style="font-size: 11px; color: #666; margin-bottom: 2px;">📍 ${resource.address}</div>` : ""}
					${resource.osmTags?.phone ? `<div style="font-size: 11px; color: #666; margin-bottom: 2px;">📞 ${resource.osmTags.phone}</div>` : ""}
					${resource.osmTags?.website ? `<div style="font-size: 11px; color: #666; margin-bottom: 2px;">🌐 <a href="${resource.osmTags.website}" target="_blank" style="color: #3b82f6;">Website</a></div>` : ""}
					${resource.osmTags?.opening_hours ? `<div style="font-size: 11px; color: #666;">🕒 ${resource.osmTags.opening_hours}</div>` : ""}
				</div>`,
			);

			new maptilersdk.Marker({ element: resourceElement })
				.setLngLat([resource.lon, resource.lat])
				.setPopup(popup)
				.addTo(map.current);
		});
	}, [resources]);

	React.useEffect(() => {
		if (!map.current) return;

		map.current.setStyle(
			mode === "dark"
				? maptilersdk.MapStyle.BASIC.DARK
				: maptilersdk.MapStyle.BASIC.LIGHT,
		);
	}, [mode]);

	return (
		<div className="relative w-full h-full">
			<div ref={mapContainer} className="w-full h-full" />

			<div className="absolute top-4 right-4 bg-black/80 text-white text-xs rounded-lg p-2 max-w-xs">
				<div className="font-semibold mb-1">⚡ Status</div>
				{["legal", "shelter", "healthcare", "food"].map((type) => {
					const status = cacheStatus[type];
					const cachedData = getCacheForResourceType(type);
					const hasCache = cachedData?.resources;
					const verifiedCount = hasCache
						? cachedData.resources.filter((r: Resource) => r.verified).length
						: 0;
					const totalCount = hasCache ? cachedData.resources.length : 0;

					return (
						<div key={type} className="flex items-center gap-2 mb-1">
							<div
								className={`w-2 h-2 rounded-full ${
									hasCache
										? "bg-green-400"
										: status
											? (status.fromCache ? "bg-green-400" : "bg-yellow-400")
											: "bg-gray-500"
								}`}
							/>
							<span className="capitalize">{type}:</span>
							<span className="text-gray-300">
								{hasCache
									? `${totalCount} found (${verifiedCount} verified)`
									: status
										? status.fromCache
											? `cached (${Math.round((status.cacheAge || 0) / 1000 / 60)}min ago)`
											: "fresh"
										: "loading..."}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}
