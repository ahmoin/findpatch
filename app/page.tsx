"use client";

import { useEffect, useState } from "react";
import { MapView } from "@/components/map";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
	const [coordinates, setCoordinates] = useState<{
		latitude: number;
		longitude: number;
	} | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!navigator.geolocation) {
			setError("Geolocation is not supported by this browser");
			setLoading(false);
			return;
		}

		navigator.geolocation.getCurrentPosition(
			(position) => {
				setCoordinates({
					latitude: position.coords.latitude,
					longitude: position.coords.longitude,
				});
				setLoading(false);
			},
			(error) => {
				setError(`Error getting location: ${error.message}`);
				setLoading(false);
			},
		);
	}, []);

	return (
		<div className="min-h-screen bg-background">
			<SiteHeader />

			<main className="flex flex-col h-[calc(100vh-8rem)]">
				<div className="flex-1 relative overflow-hidden">
					{loading && (
						<div className="flex items-center justify-center h-full">
							<p>Getting your location...</p>
						</div>
					)}
					{error && (
						<div className="flex items-center justify-center h-full">
							<p className="text-red-500">{error}</p>
						</div>
					)}
					{coordinates && <MapView startingPosition={coordinates} />}
				</div>
			</main>
		</div>
	);
}
