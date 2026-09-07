import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Haversine great-circle distance in km between two lat/lng pairs.
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Returns saved places within `radiusKm` of the user's coordinates.
// Called by C# PlacesService.FetchNearby(radiusKm, lat, lng) via POST
// {DEPLOY_URL}/api/query body
// { "path": "places/list", "args": { radiusKm, lat, lng }, "format": "json" }.
// Places without stored lat/lng are passed through with distanceKm=0 so
// legacy fixtures (e.g. "Mock Cafe") still surface.
export const list = query({
  args: {
    radiusKm: v.number(),
    lat: v.number(),
    lng: v.number(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("places").collect();
    return rows
      .map((r) => {
        const distanceKm =
          r.lat !== undefined && r.lng !== undefined
            ? haversineKm(args.lat, args.lng, r.lat, r.lng)
            : 0;
        return {
          name: r.name,
          type: r.type,
          distanceKm,
          openNow: true,
        };
      })
      .filter((p) => p.distanceKm <= args.radiusKm);
  },
});

// Adds a place. Called by C# via POST {DEPLOY_URL}/api/mutation
// body { "path": "places/add", "args": { name, type }, "format": "json" }.
export const add = mutation({
  args: { name: v.string(), type: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("places", { name: args.name, type: args.type });
  },
});
