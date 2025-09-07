"use client";

import { useQuery } from "convex/react";
import { MapIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMapLocation } from "@/hooks/useMapLocation";
import { api } from "../convex/_generated/api";

export function MobileNav() {
	const isMobile = useIsMobile();

	const { location: mapLocation } = useMapLocation();
	const [currentLocation, setCurrentLocation] = useState<{
		lat: number;
		lon: number;
		zoom: number;
	}>({
		lat: mapLocation?.latitude || 20,
		lon: mapLocation?.longitude || 0,
		zoom: mapLocation?.zoom || 14,
	});

	useEffect(() => {
		if (mapLocation) {
			setCurrentLocation({
				lat: mapLocation.latitude,
				lon: mapLocation.longitude,
				zoom: mapLocation.zoom || 14,
			});
		}
	}, [mapLocation]);

	const baseRadius = 0.01;
	const radius = baseRadius * 2 ** (14 - currentLocation.zoom);
	const radiusKm = radius * 111;

	const legal =
		useQuery(api.myFunctions.getResourcesInArea, {
			lat: currentLocation.lat,
			lon: currentLocation.lon,
			radiusKm,
			resourceType: "legal",
		}) || [];
	const shelter =
		useQuery(api.myFunctions.getResourcesInArea, {
			lat: currentLocation.lat,
			lon: currentLocation.lon,
			radiusKm,
			resourceType: "shelter",
		}) || [];
	const healthcare =
		useQuery(api.myFunctions.getResourcesInArea, {
			lat: currentLocation.lat,
			lon: currentLocation.lon,
			radiusKm,
			resourceType: "healthcare",
		}) || [];
	const food =
		useQuery(api.myFunctions.getResourcesInArea, {
			lat: currentLocation.lat,
			lon: currentLocation.lon,
			radiusKm,
			resourceType: "food",
		}) || [];

	const allResources = [
		...legal.map((r) => ({ ...r, type: "legal" })),
		...shelter.map((r) => ({ ...r, type: "shelter" })),
		...healthcare.map((r) => ({ ...r, type: "healthcare" })),
		...food.map((r) => ({ ...r, type: "food" })),
	];

	return (
		<Drawer modal={false} open={isMobile}>
			<DrawerTitle className="hidden">Navigation</DrawerTitle>
			<DrawerContent className="max-h-[80svh] p-0">
				<div className="overflow-auto p-6">
					<div className="flex flex-col space-y-3">
						{allResources.length > 0 && (
							<ul className="space-y-2">
								{allResources.map((r, i) => (
									<li
										// biome-ignore lint/suspicious/noArrayIndexKey: index used to be safe in case of duplicate keys
										key={r.name + r.lat + r.lon + i}
										className="flex items-start gap-2 p-2 rounded bg-muted/50"
									>
										<span className="text-lg" style={{ color: r.color }}>
											{r.icon}
										</span>
										<div className="flex-1">
											<div className="font-medium text-sm flex items-center gap-1">
												{r.name}
												{r.verified && (
													<span className="text-green-500 ml-1">✓</span>
												)}
											</div>
											<div className="text-xs text-muted-foreground capitalize">
												{r.type}
											</div>
											{r.address && (
												<div className="text-xs text-muted-foreground">
													📍 {r.address}
												</div>
											)}
										</div>
									</li>
								))}
							</ul>
						)}
						<div className="flex flex-col items-center space-y-2">
							<Button
								variant="ghost"
								size="icon"
								className="size-12 flex flex-col"
							>
								<MapIcon className="size-6 -mb-2" />
								<span className="text-xs text-muted-foreground">Map</span>
							</Button>
						</div>
					</div>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
