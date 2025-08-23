"use client";

import { useEffect, useState } from "react";
import { MapView } from "@/components/map";
import { SiteHeader } from "@/components/site-header";
import { useMapLocation } from "@/hooks/useMapLocation";

export default function Home() {
	const [coordinates, setCoordinates] = useState<{
		latitude: number;
		longitude: number;
	} | null>(null);
	const [deviceLocation, setDeviceLocation] = useState<{
		latitude: number;
		longitude: number;
	} | null>(null);
	const [geoLocationStatus, setGeoLocationStatus] = useState<
		"loading" | "success" | "error" | "not-requested" | "hidden"
	>("not-requested");

	const { location: cachedLocation, hasCachedLocation } = useMapLocation();

	useEffect(() => {
		if (hasCachedLocation && cachedLocation && !coordinates) {
			setCoordinates({
				latitude: cachedLocation.latitude,
				longitude: cachedLocation.longitude,
			});
		}
	}, [hasCachedLocation, cachedLocation, coordinates]);

	useEffect(() => {
		if (!navigator.geolocation) {
			setGeoLocationStatus("error");
			return;
		}

		setGeoLocationStatus("loading");
		console.log("Requesting fresh device geolocation (never cached)...");

		navigator.geolocation.getCurrentPosition(
			(position) => {
				console.log("Geolocation successful:", position.coords);
				const newDeviceLocation = {
					latitude: position.coords.latitude,
					longitude: position.coords.longitude,
				};

				setDeviceLocation(newDeviceLocation);

				if (!hasCachedLocation) {
					setCoordinates(newDeviceLocation);
				}

				setGeoLocationStatus("success");
				setTimeout(() => {
					setGeoLocationStatus("hidden");
				}, 3000);
			},
			(error) => {
				console.log("Geolocation failed:", error.message);
				setGeoLocationStatus("error");
			},
			{
				timeout: 10000,
				maximumAge: 0,
				enableHighAccuracy: true,
			},
		);
	}, [hasCachedLocation]);

	return (
		<div className="min-h-screen bg-background">
			<SiteHeader />

			<main className="flex flex-col h-screen">
				<div className="flex-1 relative overflow-hidden">
					<MapView
						startingPosition={coordinates || { latitude: 20, longitude: 0 }}
						deviceLocation={deviceLocation}
					/>

					{geoLocationStatus === "loading" && (
						<div className="absolute top-4 left-4 bg-blue-500/90 text-white text-sm rounded-lg px-3 py-2 flex items-center gap-2">
							<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
							Getting your location...
						</div>
					)}

					{geoLocationStatus === "success" && coordinates && (
						<div
							className="absolute top-4 left-4 bg-green-500/90 text-white text-sm rounded-lg px-3 py-2 flex items-center gap-2 opacity-0 animate-pulse"
							style={{ animation: "fadeIn 0.5s ease-in-out forwards" }}
						>
							<div className="w-4 h-4 text-white">✓</div>
							Location found! Map updated.
						</div>
					)}

					{geoLocationStatus === "error" && (
						<div className="absolute top-4 left-4 bg-orange-500/90 text-white text-sm rounded-lg px-3 py-2 max-w-sm">
							<div className="flex items-center gap-2 mb-1">
								<div className="w-4 h-4 text-white">⚠</div>
								Location access denied
							</div>
							<div className="text-xs opacity-90">
								You can search or navigate manually to your area
							</div>
						</div>
					)}
				</div>
			</main>
		</div>
	);
}
