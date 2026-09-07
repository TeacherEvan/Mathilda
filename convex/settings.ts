import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get the persisted settings snapshot for a user (single-row).
// Called by C# via POST {DEPLOY_URL}/api/query
// body { "path": "settings/get", "args": { userId }, "format": "json" }.
// Fields match the C# AppSettings model (src/Mathilda/Models/AppSettings.cs):
// skipStartupVideo, showInstallPrompt, customConvexUrl.
export const get = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("settings")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();
  },
});

// Persist the three settings C# actually uses (AppSettings.cs).
// All other fields previously declared (lang, theme, currency, units,
// highAccuracyGps, mockLocationEnabled, mockCoordinates, enableDebugTelemetry)
// were stripped in OBJ-08 because no UI binds them and no C# code calls
// this endpoint yet. Grow back when a real C# -> Convex settings sync lands.
export const save = mutation({
  args: {
    userId: v.string(),
    skipStartupVideo: v.optional(v.boolean()),
    showInstallPrompt: v.optional(v.boolean()),
    customConvexUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        skipStartupVideo: args.skipStartupVideo,
        showInstallPrompt: args.showInstallPrompt,
        customConvexUrl: args.customConvexUrl,
      });
      return existing._id;
    }
    return await ctx.db.insert("settings", {
      userId: args.userId,
      skipStartupVideo: args.skipStartupVideo,
      showInstallPrompt: args.showInstallPrompt,
      customConvexUrl: args.customConvexUrl,
    });
  },
});
