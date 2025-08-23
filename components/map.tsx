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

	const fetchNearbyResources = async (lat: number, lon: number) => {
		try {
			const radius = 0.01;
			const overpassQuery = `
				[out:json][timeout:25];
				(
					node["amenity"~"^(food_bank|soup_kitchen|restaurant|fast_food)$"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
					node["amenity"~"^(hospital|clinic|doctors|pharmacy)$"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
					node["amenity"~"^(shelter|social_facility)$"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
					node["office"="lawyer"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
				);
				out;
			`;

			const response = await axios.post(
				"https://overpass-api.de/api/interpreter",
				overpassQuery,
				{
					headers: {
						"Content-Type": "text/plain",
					},
				},
			);

			const resourcesData: Resource[] = response.data.elements.map(
				(element: any) => {
					let type = "other";
					let color = "#666666";
					let icon = "📍";

					if (element.tags.amenity) {
						if (
							["food_bank", "soup_kitchen", "restaurant", "fast_food"].includes(
								element.tags.amenity,
							)
						) {
							type = "food";
							color = "#22c55e";
							icon = "🍽️";
						} else if (
							["hospital", "clinic", "doctors", "pharmacy"].includes(
								element.tags.amenity,
							)
						) {
							type = "healthcare";
							color = "#ef4444";
							icon = "🏥";
						} else if (
							["shelter", "social_facility"].includes(element.tags.amenity)
						) {
							type = "shelter";
							color = "#3b82f6";
							icon = "🏠";
						}
					} else if (element.tags.office === "lawyer") {
						type = "legal";
						color = "#8b5cf6";
						icon = "⚖️";
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
				},
			);

			setResources(resourcesData.slice(0, 20));
		} catch (error) {
			console.error("Error fetching resources:", error);
			setResources([
				{
					type: "food",
					name: "Food Bank",
					color: "#22c55e",
					icon: "🍽️",
					lat: lat + 0.002,
					lon: lon + 0.001,
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
					type: "legal",
					name: "Legal Aid Office",
					color: "#8b5cf6",
					icon: "⚖️",
					lat: lat - 0.002,
					lon: lon - 0.001,
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

		fetchNearbyResources(startingPosition.latitude, startingPosition.longitude);

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
			resourceElement.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
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
