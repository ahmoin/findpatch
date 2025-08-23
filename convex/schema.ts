import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
// The schema provides more precise TypeScript types.
export default defineSchema({
	...authTables,
	resources: defineTable({
		resourceId: v.string(),
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
		firstSeen: v.number(),
		lastUpdated: v.number(),
		expiresAt: v.number(),
	})
		.index("by_resource_id", ["resourceId"])
		.index("by_type", ["type"])
		.index("by_location", ["lat", "lon"])
		.index("by_expires", ["expiresAt"]),
});
