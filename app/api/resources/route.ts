import { NextRequest, NextResponse } from "next/server";
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
  extractAddressFromOSM
} from "../../../lib/address-validation";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

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
			default:
				return NextResponse.json(
					{ error: "Invalid resource type" },
					{ status: 400 },
				);
		}

		const overpassQuery = `[out:json][timeout:30];(${query});out center tags;`;

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

		const validatedResources = await Promise.all(
			response.data.elements.map(async (element: any) => {
				console.log(`Processing element:`, JSON.stringify(element, null, 2));
				
				let elementLat: number, elementLon: number;
				
				if (element.type === 'node') {
					elementLat = element.lat;
					elementLon = element.lon;
					console.log(`Node coordinates: lat=${elementLat}, lon=${elementLon}`);
				} else if (element.type === 'way' && element.center) {
					elementLat = element.center.lat;
					elementLon = element.center.lon;
				} else if (element.type === 'relation' && element.center) {
					elementLat = element.center.lat;
					elementLon = element.center.lon;
				} else {
					const osmAddress = extractAddressFromOSM(element.tags);
					if (osmAddress) {
						console.log(`Trying forward geocoding for address: ${osmAddress}`);
						const coords = await forwardGeocode(osmAddress);
						if (coords) {
							elementLat = coords.lat;
							elementLon = coords.lon;
							console.log(`Forward geocoded ${osmAddress} to ${elementLat}, ${elementLon}`);
						} else {
							console.log(`Forward geocoding failed for: ${osmAddress}`);
							return null;
						}
					} else {
						console.log(`Skipping element with no coordinates or address:`, element.type, element.id);
						return null;
					}
				}

				if (!validateCoordinates(elementLat, elementLon)) {
					console.log(`Skipping resource with invalid coordinates: ${elementLat}, ${elementLon}`);
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

                let addressResult: any;
				try {
					addressResult = await reverseGeocode(elementLat, elementLon, element.tags);
				} catch (error) {
					console.log(`Reverse geocoding failed for ${element.tags.name}, using fallback`);
					addressResult = {
						address: generateBasicAddress(elementLat, elementLon, osmTags, element.tags.name),
						confidence: 0.4,
						verified: false,
					};
				}

				const confidence = calculateResourceConfidence(element, addressResult, osmTags);

				console.log(`Resource: ${element.tags.name || 'Unknown'} - Address: ${addressResult.address} - Confidence: ${confidence}`);
				console.log(`Element coordinates: lat=${elementLat}, lon=${elementLon}`);

				if (confidence < 0.15) {
					console.log(`Skipping very low-confidence resource: ${element.tags.name || 'Unknown'} (confidence: ${confidence})`);
					return null;
				}

				const resource = {
					type: resourceType,
					name: element.tags.name || `${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} Service`,
					color,
					icon,
					lat: Number(elementLat),
					lon: Number(elementLon), 
					address: addressResult.address,
					verified: addressResult.verified,
					confidence,
					osmTags,
				};

				console.log(`Created resource object:`, JSON.stringify(resource, null, 2));
				return resource;
			})
		);

		const resources = validatedResources.filter(resource => resource !== null);
		
		console.log(`Final resources to cache (${resources.length}):`, JSON.stringify(resources, null, 2));

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
	} catch (error: any) {
		console.error("Error fetching resources:", error);

		if (error.response?.status === 429) {
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
