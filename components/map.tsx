"use client";

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";

interface MapProps {
	startingPosition: {
		latitude: number;
		longitude: number;
	};
}

export function MapView({ startingPosition }: MapProps) {
	const mapContainer = useRef<HTMLDivElement>(null);
	const map = useRef<maplibregl.Map | null>(null);

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

		return () => {
			if (map.current) {
				map.current.remove();
				map.current = null;
			}
		};
	}, [startingPosition]);

	return <div ref={mapContainer} className="w-full h-full" />;
}
