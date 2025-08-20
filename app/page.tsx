"use client";

import { useEffect, useState } from "react";
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
				<div className="flex-1 relative overflow-hidden flex items-center justify-center">
					<div className="text-center">
						{loading && <p>Getting your location...</p>}
						{error && <p className="text-red-500">{error}</p>}
						{coordinates && (
							<div>
								<h2 className="text-2xl font-bold mb-4">Your Coordinates</h2>
								{coordinates.latitude}, {coordinates.longitude}
							</div>
						)}
					</div>
				</div>
			</main>
		</div>
	);
}
