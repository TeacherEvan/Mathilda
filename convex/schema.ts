import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  places: defineTable({
    name: v.string(),
    type: v.string(),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    addedBy: v.optional(v.string()),
  }),
  settings: defineTable({
    userId: v.string(),
    skipStartupVideo: v.optional(v.boolean()),
    showInstallPrompt: v.optional(v.boolean()),
    customConvexUrl: v.optional(v.string()),
  }),
});
