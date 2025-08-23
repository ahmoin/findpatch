import { type NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import {
	reverseGeocode,
	validateCoordinates,
	extractOSMTags,
	calculateResourceConfidence,
	generateBasicAddress,
	forwardGeocode,
	extractAddressFromOSM,
	type ReverseGeocodeResult,
} from "../../../lib/address-validation";

interface OverpassElement {
	type: "node" | "way" | "relation";
	id: number;
	lat?: number;
	lon?: number;
	center?: {
		lat: number;
		lon: number;
	};
	tags: {
		[key: string]: string | undefined;
		name?: string;
	};
}

interface GooglePlaceResult {
	name: string;
	geometry: {
		location: {
			lat: number;
			lng: number;
		};
	};
	formatted_address?: string;
	vicinity?: string;
	rating?: number;
	user_ratings_total?: number;
	formatted_phone_number?: string;
	website?: string;
	opening_hours?: {
		open_now?: boolean;
		weekday_text?: string[];
	};
}

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL || "");

function convertGooglePlaceToResource(
	place: GooglePlaceResult,
	resourceType: string,
) {
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

	let confidence = 0.7;
	if (place.rating && place.rating > 4) confidence += 0.1;
	if (place.user_ratings_total && place.user_ratings_total > 10)
		confidence += 0.1;
	if (place.opening_hours?.open_now !== undefined) confidence += 0.05;
	if (place.formatted_phone_number) confidence += 0.05;

	return {
		type: resourceType,
		name: place.name,
		color,
		icon,
		lat: place.geometry.location.lat,
		lon: place.geometry.location.lng,
		address: place.formatted_address || place.vicinity,
		verified: true,
		confidence: Math.min(confidence, 1.0),
		osmTags: {
			phone: place.formatted_phone_number,
			website: place.website,
			opening_hours: place.opening_hours?.weekday_text?.join("; "),
		},
	};
}

async function searchGooglePlaces(
	lat: number,
	lon: number,
	resourceType: string,
	radius: number,
) {
	const apiKey = process.env.GOOGLE_PLACES_API_KEY;
	if (!apiKey) {
		console.log("Google Places API key not found, skipping Google search");
		return [];
	}

	let searchQuery = "";
	switch (resourceType) {
		case "legal":
			searchQuery = "lawyer OR attorney OR legal aid OR courthouse";
			break;
		case "shelter":
			searchQuery =
				"homeless shelter OR emergency shelter OR transitional housing";
			break;
		case "healthcare":
			searchQuery =
				"hospital OR clinic OR pharmacy OR urgent care OR community health";
			break;
		case "food":
			searchQuery =
				"food bank OR soup kitchen OR food pantry OR community kitchen";
			break;
		default:
			return [];
	}

	try {
		const response = await axios.get(
			`https://maps.googleapis.com/maps/api/place/textsearch/json`,
			{
				params: {
					query: searchQuery,
					location: `${lat},${lon}`,
					radius: Math.min(radius * 111000, 50000),
					key: apiKey,
				},
				timeout: 10000,
			},
		);

		console.log(
			`Google Places returned ${response.data.results?.length || 0} results for ${resourceType}`,
		);
		return response.data.results || [];
	} catch (error) {
		console.log(`Google Places API error for ${resourceType}:`, error);
		return [];
	}
}

export async function POST(request: NextRequest) {
	try {
		const { lat, lon, zoom, resourceType } = await request.json();

		if (!lat || !lon || !zoom || !resourceType) {
			return NextResponse.json(
				{ error: "Missing required parameters" },
				{ status: 400 },
			);
		}

		const cachedResult = await convex.query(
			api.myFunctions.getCachedResources,
			{
				lat,
				lon,
				zoom,
				resourceType,
			},
		);

		if (cachedResult) {
			console.log(
				`Returning cached ${resourceType} resources (age: ${Math.round(cachedResult.cacheAge / 1000 / 60)}min)`,
			);
			return NextResponse.json({
				resources: cachedResult.resources,
				fromCache: true,
				cacheAge: cachedResult.cacheAge,
			});
		}

		const baseRadius = 0.005;
		const radius = baseRadius * 2 ** (14 - zoom);

		const googleResults = await searchGooglePlaces(
			lat,
			lon,
			resourceType,
			radius,
		);

		if (googleResults.length > 0) {
			const resources = googleResults.map((place: GooglePlaceResult) =>
				convertGooglePlaceToResource(place, resourceType),
			);

			await convex.mutation(api.myFunctions.cacheResources, {
				lat,
				lon,
				zoom,
				resourceType,
				resources,
			});

			console.log(
				`Cached ${resources.length} ${resourceType} resources from Google Places`,
			);

			return NextResponse.json({
				resources,
				fromCache: false,
				cached: true,
			});
		}

		console.log(
			`Google Places returned no results, falling back to OpenStreetMap for ${resourceType}`,
		);
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
				query = `
					(
						node["amenity"="shelter"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
						node["amenity"="social_facility"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
						way["amenity"="shelter"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
						way["amenity"="social_facility"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
					);
				`;
				break;
			case "healthcare":
				query = `
					(
						node["amenity"="hospital"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
						node["amenity"="clinic"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
						node["amenity"="doctors"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
						node["amenity"="pharmacy"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
						way["amenity"="hospital"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
						way["amenity"="clinic"](${lat - radius},${lon - radius},${lat + radius},${lon + radius});
					);
				`;
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
			default:
				return NextResponse.json(
					{ error: "Invalid resource type" },
					{ status: 400 },
				);
		}

		const overpassQuery = `[out:json][timeout:30];(${query});out center tags;`;

		console.log(`Overpass query for ${resourceType}:`, overpassQuery);

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

		console.log(
			`Overpass API returned ${response.data.elements?.length || 0} elements for ${resourceType}`,
		);

		const validatedResources = await Promise.all(
			response.data.elements.map(async (element: OverpassElement) => {
				console.log(
					`Processing element: ${element.tags.name || "Unnamed"} (${element.type})`,
				);

				let elementLat: number, elementLon: number;

				if (element.type === "node") {
					if (element.lat == null || element.lon == null) {
						console.log(
							`Node missing coordinates: lat=${element.lat}, lon=${element.lon}`,
						);
						return null;
					}
					elementLat = element.lat;
					elementLon = element.lon;
					console.log(`Node coordinates: lat=${elementLat}, lon=${elementLon}`);
				} else if (element.type === "way" && element.center) {
					elementLat = element.center.lat;
					elementLon = element.center.lon;
					console.log(
						`Way center coordinates: lat=${elementLat}, lon=${elementLon}`,
					);
				} else if (element.type === "relation" && element.center) {
					elementLat = element.center.lat;
					elementLon = element.center.lon;
					console.log(
						`Relation center coordinates: lat=${elementLat}, lon=${elementLon}`,
					);
				} else {
					const osmAddress = extractAddressFromOSM(element.tags);
					if (osmAddress) {
						console.log(`Trying forward geocoding for address: ${osmAddress}`);
						const coords = await forwardGeocode(osmAddress);
						if (coords) {
							elementLat = coords.lat;
							elementLon = coords.lon;
							console.log(
								`Forward geocoded ${osmAddress} to ${elementLat}, ${elementLon}`,
							);
						} else {
							console.log(`Forward geocoding failed for: ${osmAddress}`);
							return null;
						}
					} else {
						console.log(
							`Skipping element with no coordinates or address:`,
							element.type,
							element.id,
						);
						return null;
					}
				}

				if (!validateCoordinates(elementLat, elementLon)) {
					console.log(
						`Skipping resource with invalid coordinates: ${elementLat}, ${elementLon}`,
					);
					return null;
				}

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

				const osmTags = extractOSMTags(element.tags);

				let addressResult: ReverseGeocodeResult;
				try {
					addressResult = await reverseGeocode(
						elementLat,
						elementLon,
						element.tags,
					);
				} catch (error) {
					console.log(
						`Reverse geocoding failed for ${element.tags.name}, using fallback ${error}`,
					);
					addressResult = {
						address: generateBasicAddress(
							elementLat,
							elementLon,
							osmTags,
							element.tags.name,
						),
						confidence: 0.4,
						verified: false,
					};
				}

				const confidence = calculateResourceConfidence(
					element,
					addressResult,
					osmTags,
				);

				console.log(
					`Resource: ${element.tags.name || "Unknown"} - Address: ${addressResult.address} - Confidence: ${confidence}`,
				);
				console.log(
					`Element coordinates: lat=${elementLat}, lon=${elementLon}`,
				);

				if (confidence < 0.05) {
					console.log(
						`Skipping very low-confidence resource: ${element.tags.name || "Unknown"} (confidence: ${confidence})`,
					);
					return null;
				}

				const resource = {
					type: resourceType,
					name:
						element.tags.name ||
						`${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} Service`,
					color,
					icon,
					lat: Number(elementLat),
					lon: Number(elementLon),
					address: addressResult.address,
					verified: addressResult.verified,
					confidence,
					osmTags,
				};

				console.log(
					`Created resource object:`,
					JSON.stringify(resource, null, 2),
				);
				return resource;
			}),
		);

		const resources = validatedResources.filter(
			(resource) => resource !== null,
		);

		console.log(
			`Final resources to cache (${resources.length}):`,
			JSON.stringify(resources, null, 2),
		);

		await convex.mutation(api.myFunctions.cacheResources, {
			lat,
			lon,
			zoom,
			resourceType,
			resources,
		});

		console.log(
			`Cached ${resources.length} ${resourceType} resources for 24 hours`,
		);

		return NextResponse.json({
			resources,
			fromCache: false,
			cached: true,
		});
	} catch (error: unknown) {
		console.error("Error fetching resources:", error);

		const isAxiosError = (
			err: unknown,
		): err is { response?: { status: number } } => {
			return typeof err === "object" && err !== null && "response" in err;
		};

		if (isAxiosError(error) && error.response?.status === 429) {
			return NextResponse.json(
				{ error: "Rate limited by Overpass API" },
				{ status: 429 },
			);
		}

		return NextResponse.json(
			{ error: "Failed to fetch resources" },
			{ status: 500 },
		);
	}
}
