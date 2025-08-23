import crypto from "crypto";

/**
 * Signs a Google Maps API URL with the provided secret key
 * This increases rate limits from default to 25,000+ requests per day
 */
export function signUrl(url: string, secret: string): string {
	const urlObj = new URL(url);
	const pathAndQuery = urlObj.pathname + urlObj.search;

	const decodedSecret = Buffer.from(secret, "base64");

	const signature = crypto
		.createHmac("sha1", decodedSecret)
		.update(pathAndQuery)
		.digest("base64");

	const urlSafeSignature = signature.replace(/\+/g, "-").replace(/\//g, "_");

	const separator = urlObj.search ? "&" : "?";
	return url + separator + "signature=" + urlSafeSignature;
}

/**
 * Creates a signed Google Places API URL
 */
export function createSignedPlacesUrl(
	baseUrl: string,
	params: Record<string, string | number>,
	apiKey: string,
	secret?: string,
): string {
	const allParams = { ...params, key: apiKey };

	const queryString = Object.entries(allParams)
		.map(
			([key, value]) =>
				`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
		)
		.join("&");

	const fullUrl = `${baseUrl}?${queryString}`;

	if (secret) {
		return signUrl(fullUrl, secret);
	}

	return fullUrl;
}
