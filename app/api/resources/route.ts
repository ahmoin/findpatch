import { type NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { createSignedPlacesUrl } from "../../../lib/url-signing";

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
	types?: string[];
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
	const signingSecret = process.env.GOOGLE_URL_SIGNING_SECRET;

	if (!apiKey) {
		console.log("Google Places API key not found, skipping Google search");
		return [];
	}

	let searchQuery = "";
	switch (resourceType) {
		case "legal":
			searchQuery = "lawyer";
			break;
		case "shelter":
			searchQuery = "homeless shelter emergency shelter transitional housing";
			break;
		case "healthcare":
			searchQuery = "hospital";
			break;
		case "food":
			searchQuery = "restaurant";
			break;
		default:
			return [];
	}

	try {
		const searchRadius = Math.max(Math.min(radius * 111000, 50000), 10000);

		console.log(
			`Testing Google Places API for ${resourceType} at ${lat},${lon} within ${(searchRadius / 1000).toFixed(1)}km`,
		);

		const testUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=${searchRadius}&type=restaurant&key=${apiKey}`;
		console.log(
			`Test URL (no signature): ${testUrl.replace(apiKey, "API_KEY_HIDDEN")}`,
		);

		const testResponse = await axios.get(testUrl, { timeout: 10000 });
		console.log(`Test response status: ${testResponse.data.status}`);
		console.log(
			`Test response results count: ${testResponse.data.results?.length || 0}`,
		);

		if (testResponse.data.error_message) {
			console.log(`Test API error: ${testResponse.data.error_message}`);
		}

		if (resourceType === "shelter") {
			const baseUrl =
				"https://maps.googleapis.com/maps/api/place/textsearch/json";
			const params = {
				query: searchQuery,
				location: `${lat},${lon}`,
				radius: searchRadius.toString(),
			};

			const signedUrl = createSignedPlacesUrl(
				baseUrl,
				params,
				apiKey,
				signingSecret,
			);
			console.log(
				`Shelter text search URL: ${signedUrl.replace(apiKey, "API_KEY_HIDDEN")}`,
			);

			const response = await axios.get(signedUrl, { timeout: 10000 });
			let results = response.data.results || [];

			console.log(`API response status: ${response.data.status}`);
			if (response.data.error_message) {
				console.log(`API error: ${response.data.error_message}`);
			}

			const excludeKeywords = [
				"hotel",
				"motel",
				"inn",
				"resort",
				"lodge",
				"suites",
				"extended stay",
				"marriott",
				"hilton",
				"holiday inn",
				"best western",
				"comfort inn",
				"hampton inn",
				"courtyard",
				"residence inn",
				"fairfield inn",
			];

			results = results.filter((place: GooglePlaceResult) => {
				const name = place.name.toLowerCase();
				const types = place.types || [];

				const hasExcludedKeyword = excludeKeywords.some((keyword) =>
					name.includes(keyword),
				);

				const hasCommercialType = types.some((type: string) =>
					["lodging", "hotel", "motel", "resort"].includes(type),
				);

				const isShelterType =
					types.some((type: string) =>
						["establishment", "point_of_interest"].includes(type),
					) &&
					(name.includes("shelter") ||
						name.includes("homeless") ||
						name.includes("transitional") ||
						name.includes("emergency housing") ||
						name.includes("social service"));

				return (!hasExcludedKeyword && !hasCommercialType) || isShelterType;
			});

			console.log(
				`Filtered shelter results: ${results.length} (excluded commercial lodging)`,
			);
			return results;
		}

		let placeType = "";
		switch (resourceType) {
			case "legal":
				placeType = "lawyer";
				break;
			case "healthcare":
				placeType = "hospital";
				break;
			case "food":
				placeType = "restaurant";
				break;
			default:
				return [];
		}

		const baseUrl =
			"https://maps.googleapis.com/maps/api/place/nearbysearch/json";
		const params = {
			location: `${lat},${lon}`,
			radius: searchRadius.toString(),
			type: placeType,
		};

		const signedUrl = createSignedPlacesUrl(
			baseUrl,
			params,
			apiKey,
			signingSecret,
		);
		console.log(
			`${resourceType} nearby search URL: ${signedUrl.replace(apiKey, "API_KEY_HIDDEN")}`,
		);

		const response = await axios.get(signedUrl, { timeout: 10000 });
		const results = response.data.results || [];

		console.log(`API response status: ${response.data.status}`);
		if (response.data.error_message) {
			console.log(`API error: ${response.data.error_message}`);
		}

		console.log(
			`Google Places returned ${results.length} total results for ${resourceType}${signingSecret ? " (with URL signature)" : " (no signature)"}`,
		);
		return results;
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
		console.log(
			`Search radius: ${radius} degrees (approximately ${(radius * 111).toFixed(2)} km)`,
		);

		console.log(`Searching Google Places for ${resourceType}...`);
		const googleResults = await searchGooglePlaces(
			lat,
			lon,
			resourceType,
			radius,
		);

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
			`Found and cached ${resources.length} ${resourceType} resources from Google Places`,
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
				{ error: "Rate limited by Google Places API" },
				{ status: 429 },
			);
		}

		return NextResponse.json(
			{ error: "Failed to fetch resources" },
			{ status: 500 },
		);
	}
}
