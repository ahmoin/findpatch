import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

const CACHE_LIFETIME_MS = 24 * 60 * 60 * 1000;

function generateCacheKey(
	lat: number,
	lon: number,
	zoom: number,
	resourceType: string,
): string {
	const roundedLat = Math.round(lat * 1000) / 1000; // ~111m precision
	const roundedLon = Math.round(lon * 1000) / 1000;
	const roundedZoom = Math.round(zoom);

	return `${resourceType}_${roundedLat}_${roundedLon}_${roundedZoom}`;
}

export const getCachedResources = query({
	args: {
		lat: v.number(),
		lon: v.number(),
		zoom: v.number(),
		resourceType: v.string(),
	},
	handler: async (ctx, { lat, lon, zoom, resourceType }) => {
		const cacheKey = generateCacheKey(lat, lon, zoom, resourceType);
		const now = Date.now();

		const cached = await ctx.db
			.query("resourceCache")
			.withIndex("by_cache_key", (q) => q.eq("cacheKey", cacheKey))
			.first();

		if (cached && cached.expiresAt > now) {
			return {
				resources: cached.resources,
				fromCache: true,
				cacheAge: now - cached.createdAt,
			};
		}

		if (cached && cached.expiresAt <= now) {
			return null;
		}

		return null;
	},
});

export const cacheResources = mutation({
	args: {
		lat: v.number(),
		lon: v.number(),
		zoom: v.number(),
		resourceType: v.string(),
		resources: v.array(
			v.object({
				type: v.string(),
				name: v.string(),
				color: v.string(),
				icon: v.string(),
				lat: v.number(),
				lon: v.number(),
				address: v.optional(v.string()),
				verified: v.optional(v.boolean()),
				confidence: v.optional(v.number()),
				osmTags: v.optional(v.object({
					phone: v.optional(v.string()),
					website: v.optional(v.string()),
					opening_hours: v.optional(v.string()),
					addr_street: v.optional(v.string()),
					addr_city: v.optional(v.string()),
					addr_postcode: v.optional(v.string()),
				})),
			}),
		),
	},
	handler: async (ctx, { lat, lon, zoom, resourceType, resources }) => {
		const cacheKey = generateCacheKey(lat, lon, zoom, resourceType);
		const now = Date.now();
		const expiresAt = now + CACHE_LIFETIME_MS;

		const existing = await ctx.db
			.query("resourceCache")
			.withIndex("by_cache_key", (q) => q.eq("cacheKey", cacheKey))
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, {
				resources,
				expiresAt,
				createdAt: now,
			});
		} else {
			await ctx.db.insert("resourceCache", {
				cacheKey,
				resources,
				expiresAt,
				createdAt: now,
			});
		}

		return { cached: true, expiresAt };
	},
});

export const cleanupExpiredCache = mutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();
		const expiredEntries = await ctx.db
			.query("resourceCache")
			.filter((q) => q.lt(q.field("expiresAt"), now))
			.collect();

		for (const entry of expiredEntries) {
			await ctx.db.delete(entry._id);
		}

		return { cleaned: expiredEntries.length };
	},
});

export const scheduledCleanup = internalMutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();
		const expiredEntries = await ctx.db
			.query("resourceCache")
			.filter((q) => q.lt(q.field("expiresAt"), now))
			.collect();

		for (const entry of expiredEntries) {
			await ctx.db.delete(entry._id);
		}

		console.log(`Cleaned up ${expiredEntries.length} expired cache entries`);
		return { cleaned: expiredEntries.length };
	},
});
export const clearResourceCache = mutation({
	args: {
		lat: v.number(),
		lon: v.number(),
		zoom: v.number(),
		resourceType: v.string(),
	},
	handler: async (ctx, { lat, lon, zoom, resourceType }) => {
		const cacheKey = generateCacheKey(lat, lon, zoom, resourceType);

		const existing = await ctx.db
			.query("resourceCache")
			.withIndex("by_cache_key", (q) => q.eq("cacheKey", cacheKey))
			.first();

		if (existing) {
			await ctx.db.delete(existing._id);
			return { cleared: true, cacheKey };
		}

		return { cleared: false, message: "No cache entry found" };
	},
});