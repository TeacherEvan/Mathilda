using Mathilda.Models;
using System.Net.Http.Json;

namespace Mathilda.Services;

/// <summary>Port of Quicky's PlacesService. Convex-backed when configured, mock otherwise.</summary>
public sealed class PlacesService
{
    private readonly ConvexClient? _convex;

    public PlacesService(ConvexClient? convex = null) => _convex = convex;

    public async Task<IReadOnlyList<Attraction>> FetchNearby(double radiusKm, double lat, double lng)
    {
        if (_convex is null)
        {
            return new List<Attraction>
            {
                new("Mock Cafe", radiusKm * 0.2, "cafe", true),
                new("Mock Temple", radiusKm * 0.5, "temple", true),
                new("Mock Market", radiusKm * 0.8, "market", false),
            };
        }

        // Live path: pass the radius + the user's current coordinates so the
        // Convex backend can apply a haversine filter. Previously the args
        // were silently dropped, which made the UI's "within N km" headline
        // a lie on live data (F1 in REVIEW-FINDINGS-2026-09-07.md).
        var rows = await _convex.QueryAsync<List<Attraction>>(
            "places/list",
            new { radiusKm, lat, lng });
        return rows ?? new List<Attraction>();
    }

    /// <summary>Returns true if a Convex client is registered and available.</summary>
    public bool IsConvexConnected() => _convex != null;
}
