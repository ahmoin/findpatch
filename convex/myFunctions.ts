import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

const RESOURCE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

function generateResourceId(
	name: string,
	address: string,
	type: string,
): string {
	const cleanName = name.toLowerCase().trim();
	const cleanAddress = address.toLowerCase().trim();
	return `${type}_${cleanName}_${cleanAddress}`.replace(/[^a-z0-9_]/g, "_");
}

function calculateDistance(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number,
): number {
	const R = 6371;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

export const getResourcesInArea = query({
	args: {
		lat: v.number(),
		lon: v.number(),
		radiusKm: v.number(),
		resourceType: v.string(),
	},
	handler: async (ctx, { lat, lon, radiusKm, resourceType }) => {
		const now = Date.now();

		const allResources = await ctx.db
			.query("resources")
			.withIndex("by_type", (q) => q.eq("type", resourceType))
			.filter((q) => q.gt(q.field("expiresAt"), now))
			.collect();

		const resourcesInArea = allResources.filter((resource) => {
			const distance = calculateDistance(lat, lon, resource.lat, resource.lon);
			return distance <= radiusKm;
		});

		console.log(
			`Found ${resourcesInArea.length} cached ${resourceType} resources within ${radiusKm}km`,
		);

		return resourcesInArea.map((resource) => ({
			type: resource.type,
			name: resource.name,
			color: resource.color,
			icon: resource.icon,
			lat: resource.lat,
			lon: resource.lon,
			address: resource.address,
			verified: resource.verified,
			confidence: resource.confidence,
			osmTags: resource.osmTags,
		}));
	},
});

export const upsertResources = mutation({
	args: {
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
				osmTags: v.optional(
					v.object({
						phone: v.optional(v.string()),
						website: v.optional(v.string()),
						opening_hours: v.optional(v.string()),
						addr_street: v.optional(v.string()),
						addr_city: v.optional(v.string()),
						addr_postcode: v.optional(v.string()),
					}),
				),
			}),
		),
	},
	handler: async (ctx, { resources }) => {
		const now = Date.now();
		const expiresAt = now + RESOURCE_LIFETIME_MS;
		let newCount = 0;
		let updatedCount = 0;

		for (const resource of resources) {
			const resourceId = generateResourceId(
				resource.name,
				resource.address || "",
				resource.type,
			);

			const existing = await ctx.db
				.query("resources")
				.withIndex("by_resource_id", (q) => q.eq("resourceId", resourceId))
				.first();

			if (existing) {
				await ctx.db.patch(existing._id, {
					...resource,
					lastUpdated: now,
					expiresAt,
				});
				updatedCount++;
			} else {
				await ctx.db.insert("resources", {
					resourceId,
					...resource,
					firstSeen: now,
					lastUpdated: now,
					expiresAt,
				});
				newCount++;
			}
		}

		console.log(`Upserted resources: ${newCount} new, ${updatedCount} updated`);
		return { newCount, updatedCount };
	},
});

export const cleanupExpiredResources = mutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();
		const expiredResources = await ctx.db
			.query("resources")
			.withIndex("by_expires", (q) => q.lt("expiresAt", now))
			.collect();

		for (const resource of expiredResources) {
			await ctx.db.delete(resource._id);
		}

		return { cleaned: expiredResources.length };
	},
});

export const scheduledCleanup = internalMutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();
		const expiredResources = await ctx.db
			.query("resources")
			.withIndex("by_expires", (q) => q.lt("expiresAt", now))
			.collect();

		for (const resource of expiredResources) {
			await ctx.db.delete(resource._id);
		}

		console.log(`Cleaned up ${expiredResources.length} expired resources`);
		return { cleaned: expiredResources.length };
	},
});

export const getAllResourcesByType = query({
	args: {
		resourceType: v.string(),
	},
	handler: async (ctx, { resourceType }) => {
		const now = Date.now();

		const resources = await ctx.db
			.query("resources")
			.withIndex("by_type", (q) => q.eq("type", resourceType))
			.filter((q) => q.gt(q.field("expiresAt"), now))
			.collect();

		return resources.map((resource) => ({
			type: resource.type,
			name: resource.name,
			color: resource.color,
			icon: resource.icon,
			lat: resource.lat,
			lon: resource.lon,
			address: resource.address,
			verified: resource.verified,
			confidence: resource.confidence,
			osmTags: resource.osmTags,
		}));
	},
});

export const getCachedResources = query({
	args: {
		lat: v.number(),
		lon: v.number(),
		zoom: v.number(),
		resourceType: v.string(),
	},
	handler: async (ctx, { lat, lon, zoom, resourceType }) => {
		const baseRadius = 0.01;
		const radius = baseRadius * 2 ** (14 - zoom);
		const radiusKm = radius * 111;

		const now = Date.now();

		const allResources = await ctx.db
			.query("resources")
			.withIndex("by_type", (q) => q.eq("type", resourceType))
			.filter((q) => q.gt(q.field("expiresAt"), now))
			.collect();

		const resources = allResources
			.filter((resource) => {
				const distance = calculateDistance(
					lat,
					lon,
					resource.lat,
					resource.lon,
				);
				return distance <= radiusKm;
			})
			.map((resource) => ({
				type: resource.type,
				name: resource.name,
				color: resource.color,
				icon: resource.icon,
				lat: resource.lat,
				lon: resource.lon,
				address: resource.address,
				verified: resource.verified,
				confidence: resource.confidence,
				osmTags: resource.osmTags,
			}));

		if (resources.length > 0) {
			return {
				resources,
				fromCache: true,
				cacheAge: 0,
			};
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
				osmTags: v.optional(
					v.object({
						phone: v.optional(v.string()),
						website: v.optional(v.string()),
						opening_hours: v.optional(v.string()),
						addr_street: v.optional(v.string()),
						addr_city: v.optional(v.string()),
						addr_postcode: v.optional(v.string()),
					}),
				),
			}),
		),
	},
	handler: async (ctx, { resources }) => {
		const now = Date.now();
		const expiresAt = now + RESOURCE_LIFETIME_MS;
		let newCount = 0;
		let updatedCount = 0;

		for (const resource of resources) {
			const resourceId = generateResourceId(
				resource.name,
				resource.address || "",
				resource.type,
			);

			const existing = await ctx.db
				.query("resources")
				.withIndex("by_resource_id", (q) => q.eq("resourceId", resourceId))
				.first();

			if (existing) {
				await ctx.db.patch(existing._id, {
					...resource,
					lastUpdated: now,
					expiresAt,
				});
				updatedCount++;
			} else {
				await ctx.db.insert("resources", {
					resourceId,
					...resource,
					firstSeen: now,
					lastUpdated: now,
					expiresAt,
				});
				newCount++;
			}
		}

		return { newCount, updatedCount };
	},
});
