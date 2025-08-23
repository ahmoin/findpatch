import axios from "axios";

export interface ReverseGeocodeResult {
	address: string;
	confidence: number;
	verified: boolean;
}

interface OSMTags {
	phone?: string;
	website?: string;
	opening_hours?: string;
	addr_street?: string;
	addr_city?: string;
	addr_postcode?: string;
}

interface OSMElementTags {
	[key: string]: string | undefined;
	name?: string;
	phone?: string;
	website?: string;
	opening_hours?: string;
	"addr:housenumber"?: string;
	"addr:street"?: string;
	"addr:city"?: string;
	"addr:postcode"?: string;
	"contact:phone"?: string;
	"contact:website"?: string;
}

interface OSMElement {
	tags: OSMElementTags;
}

export function extractAddressFromOSM(tags: OSMElementTags): string | null {
	const parts: string[] = [];

	if (tags["addr:housenumber"]) parts.push(tags["addr:housenumber"]);
	if (tags["addr:street"]) parts.push(tags["addr:street"]);
	if (tags["addr:city"]) parts.push(tags["addr:city"]);
	if (tags["addr:postcode"]) parts.push(tags["addr:postcode"]);

	if (parts.length >= 2) {
		return parts.join(", ");
	}

	return null;
}

export async function reverseGeocode(
	lat: number,
	lon: number,
	osmTags?: OSMElementTags,
): Promise<ReverseGeocodeResult> {
	if (osmTags) {
		const osmAddress = extractAddressFromOSM(osmTags);
		if (osmAddress) {
			return {
				address: osmAddress,
				confidence: 0.8,
				verified: true,
			};
		}
	}

	try {
		const response = await axios.get(
			`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`,
			{
				headers: {
					"User-Agent": "FindPatch/1.0 (Resource Verification)",
				},
				timeout: 3000,
			},
		);

		const data = response.data;

		if (!data || !data.display_name) {
			return {
				address: `Coordinates: ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
				confidence: 0.3,
				verified: false,
			};
		}

		let confidence = 0.5;

		if (data.address) {
			if (data.address.house_number) confidence += 0.2;
			if (data.address.road) confidence += 0.2;
			if (data.address.city || data.address.town || data.address.village)
				confidence += 0.1;
		}

		if (data.type === "building" || data.type === "house") confidence += 0.1;
		if (data.class === "amenity" || data.class === "office") confidence += 0.1;

		return {
			address: data.display_name,
			confidence: Math.min(confidence, 1.0),
			verified: confidence > 0.7,
		};
	} catch (error) {
		console.error("Reverse geocoding failed:", error);
		return {
			address: `Near ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
			confidence: 0.2,
			verified: false,
		};
	}
}

export function validateCoordinates(lat: number, lon: number): boolean {
	if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) {
		return false;
	}

	return true;
}

export function extractOSMTags(tags: OSMElementTags): OSMTags {
	return {
		phone: tags.phone || tags["contact:phone"],
		website: tags.website || tags["contact:website"],
		opening_hours: tags.opening_hours,
		addr_street: tags["addr:street"],
		addr_city: tags["addr:city"],
		addr_postcode: tags["addr:postcode"],
	};
}

export function generateBasicAddress(
	lat: number,
	lon: number,
	osmTags?: OSMTags,
	name?: string,
): string {
	if (osmTags) {
		const parts: string[] = [];
		if (osmTags.addr_street) parts.push(osmTags.addr_street);
		if (osmTags.addr_city) parts.push(osmTags.addr_city);
		if (parts.length > 0) {
			return parts.join(", ");
		}
	}

	if (name && lat != null && lon != null) {
		return `${name} (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
	}

	if (name) {
		return name;
	}

	if (lat != null && lon != null) {
		return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
	}

	return "Unknown Location";
}

export function calculateResourceConfidence(
	element: OSMElement,
	addressResult: ReverseGeocodeResult,
	osmTags: OSMTags,
): number {
	let confidence = Math.max(0.3, addressResult.confidence);

	if (element.tags.name && element.tags.name.length > 3) confidence += 0.1;
	if (osmTags.phone) confidence += 0.1;
	if (osmTags.website) confidence += 0.1;
	if (osmTags.addr_street) confidence += 0.1;
	if (osmTags.opening_hours) confidence += 0.05;

	if (element.tags.name && element.tags.name.length < 3) confidence -= 0.1;
	if (!element.tags.name) confidence -= 0.05;

	return Math.max(0.2, Math.min(1, confidence));
}

export async function forwardGeocode(
	address: string,
): Promise<{ lat: number; lon: number } | null> {
	try {
		const response = await axios.get(
			`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
			{
				headers: {
					"User-Agent": "FindPatch/1.0 (https://findpatch.com)",
				},
				timeout: 5000,
			},
		);

		if (response.data && response.data.length > 0) {
			const result = response.data[0];
			return {
				lat: parseFloat(result.lat),
				lon: parseFloat(result.lon),
			};
		}

		return null;
	} catch (error) {
		console.log(`Forward geocoding failed for address: ${address}`, error);
		return null;
	}
}
