"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";

interface MapProps {
	startingPosition: {
		latitude: number;
		longitude: number;
	};
}

interface Resource {
	type: string;
	name: string;
	color: string;
	icon: string;
	lat: number;
	lon: number;
}

export function MapView({ startingPosition }: MapProps) {
	const mapContainer = useRef<HTMLDivElement>(null);
	const map = useRef<maplibregl.Map | null>(null);
	const [resources, setResources] = useState<Resource[]>([]);
	const markersRef = useRef<maplibregl.Marker[]>([]);

	const fetchResourceLayer = async (
		lat: number,
		lon: number,
		zoom: number,
		resourceType: string,
		retryCount = 0,
	): Promise<Resource[]> => {
		try {
			const baseRadius = 0.005;
			const radius = baseRadius * Math.pow(2, 14 - zoom);
			let query = "";

			switch (resourceType) {
				case "legal":
					query = `
						(
							node["office"="lawyer"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
							node["office"="legal"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
							node["amenity"="courthouse"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
							node["office"="notary"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
							node["amenity"="legal_aid"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
							node["office"="solicitor"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
							node["office"="barrister"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
							node["amenity"="public_building"]["public_building"="legal"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
							node["shop"="legal"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
						);
					`;
					break;
				case "shelter":
					query = `node["amenity"~"^(shelter|social_facility)$"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});`;
					break;
				case "healthcare":
					query = `node["amenity"~"^(hospital|clinic|doctors|pharmacy)$"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});`;
					break;
				case "food":
					query = `
						(
							node["amenity"="food_bank"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
							node["amenity"="soup_kitchen"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
							node["amenity"="community_centre"]["community_centre:for"~"food"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
							node["social_facility"="food_bank"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
							node["social_facility"="soup_kitchen"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
							node["amenity"="restaurant"]["cuisine"="free"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
							node["shop"="charity"]["shop"~"food"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
							node["amenity"="social_facility"]["social_facility:for"~"food"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
						);
					`;
					break;
			}

			const overpassQuery = `[out:json][timeout:30];(${query});out;`;

			const response = await axios.post(
				"https://overpass-api.de/api/interpreter",
				overpassQuery,
				{
					headers: {
						"Content-Type": "text/plain",
					},
					timeout: 30000,
				},
			);

			return response.data.elements.map((element: any) => {
				let type = resourceType;
				let color = "#666666";
				let icon = "📍";

				switch (resourceType) {
					case "legal":
						color = "#8b5cf6";
						icon = "⚖️";
						break;
					case "shelter":
						color = "#3b82f6";
						icon = "🏠";
						break;
					case "healthcare":
						color = "#ef4444";
						icon = "🏥";
						break;
					case "food":
						color = "#22c55e";
						icon = "🍽️";
						break;
				}

				return {
					type,
					name:
						element.tags.name ||
						`${type.charAt(0).toUpperCase() + type.slice(1)} Service`,
					color,
					icon,
					lat: element.lat,
					lon: element.lon,
				};
			});
		} catch (error: any) {
			console.error(`Error fetching ${resourceType} resources:`, error);

			if (error.response?.status === 429 || error.code === "ECONNABORTED") {
				const maxRetries = 3;
				if (retryCount < maxRetries) {
					const delay = 2 ** retryCount * 1000;
					console.log(
						`Rate limited for ${resourceType}, retrying in ${delay}ms...`,
					);
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

	const fetchNearbyResources = async (
		lat: number,
		lon: number,
		zoom: number,
	) => {
		clearMarkers();
		setResources([]);

		const resourceTypes = ["legal", "shelter", "healthcare", "food"];
		let allResources: Resource[] = [];

		console.log(
			`Fetching resources for center: ${lat.toFixed(4)}, ${lon.toFixed(4)} at zoom ${zoom}`,
		);

		for (const resourceType of resourceTypes) {
			console.log(`Loading ${resourceType} resources...`);
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
			setResources([
				{
					type: "legal",
					name: "Legal Aid Office",
					color: "#8b5cf6",
					icon: "⚖️",
					lat: lat - 0.002,
					lon: lon - 0.001,
				},
				{
					type: "shelter",
					name: "Emergency Shelter",
					color: "#3b82f6",
					icon: "🏠",
					lat: lat - 0.001,
					lon: lon + 0.002,
				},
				{
					type: "healthcare",
					name: "Community Health Center",
					color: "#ef4444",
					icon: "🏥",
					lat: lat + 0.001,
					lon: lon - 0.002,
				},
				{
					type: "food",
					name: "Food Bank",
					color: "#22c55e",
					icon: "🍽️",
					lat: lat + 0.002,
					lon: lon + 0.001,
				},
			]);
		}
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: fetchNearbyResources changes on every re-render and should not be used as a hook dependency.
	useEffect(() => {
		if (map.current || !mapContainer.current) return;

		map.current = new maplibregl.Map({
			container: mapContainer.current,
			attributionControl: false,
			style: {
				version: 8,
				sources: {
					osm: {
						type: "raster",
						tiles: [
							"https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
							"https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
							"https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
						],
						tileSize: 256,
					},
				},
				layers: [
					{
						id: "background",
						type: "background",
						paint: {
							"background-color": "#1a1a1a",
						},
					},
					{
						id: "osm-tiles",
						type: "raster",
						source: "osm",
						paint: {
							"raster-brightness-min": 0,
							"raster-brightness-max": 0.4,
							"raster-contrast": 0.4,
							"raster-saturation": -0.8,
						},
					},
				],
			},
			center: [startingPosition.longitude, startingPosition.latitude],
			zoom: 14,
		});

		const dotElement = document.createElement("div");
		dotElement.style.width = "12px";
		dotElement.style.height = "12px";
		dotElement.style.backgroundColor = "oklch(0.55 0.22 263)";
		dotElement.style.borderRadius = "50%";
		dotElement.style.border = "2px solid white";
		dotElement.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";

		new maplibregl.Marker({ element: dotElement })
			.setLngLat([startingPosition.longitude, startingPosition.latitude])
			.addTo(map.current);

		const initialZoom = map.current.getZoom();
		fetchNearbyResources(
			startingPosition.latitude,
			startingPosition.longitude,
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
	}, [startingPosition]);

	useEffect(() => {
		if (!map.current || resources.length === 0) return;

		resources.forEach((resource) => {
			if (!map.current) return;

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

			const popup = new maplibregl.Popup({
				offset: 25,
				closeButton: false,
			}).setHTML(
				`<div style="padding: 6px 8px;">
					<div style="font-size: 14px; font-weight: bold; margin-bottom: 2px; color: #333;">${resource.name}</div>
					<div style="color: ${resource.color}; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">${resource.icon} ${resource.type}</div>
				</div>`,
			);

			new maplibregl.Marker({ element: resourceElement })
				.setLngLat([resource.lon, resource.lat])
				.setPopup(popup)
				.addTo(map.current);
		});
	}, [resources]);

	return <div ref={mapContainer} className="w-full h-full" />;
}
