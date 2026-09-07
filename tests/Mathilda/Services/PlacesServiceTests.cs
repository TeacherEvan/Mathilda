using System.Net;
using System.Text.Json;
using Mathilda.Models;
using Mathilda.Services;
using Xunit;

namespace Mathilda.Tests.Services;

public class PlacesServiceTests
{
    [Fact]
    public async Task FetchNearby_NoConvex_ReturnsMockThree()
    {
        var svc = new PlacesService();
        var list = await svc.FetchNearby(10, 13.75, 100.5);
        Assert.Equal(3, list.Count);
    }

    // F1 regression (REVIEW-FINDINGS-2026-09-07.md): the live path must
    // include { radiusKm, lat, lng } in the wire payload so the Convex
    // backend can apply a haversine filter. Previously the args were
    // silently dropped, making the "within N km" UI headline a lie.
    [Fact]
    public async Task FetchNearby_WithConvex_PassesRadiusAndCoordsInEnvelope()
    {
        var handler = new CapturingHandler(
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    "{\"status\":\"success\",\"value\":[]}",
                    System.Text.Encoding.UTF8, "application/json"),
            });
        using var http = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://example.convex.cloud"),
        };
        var convex = new ConvexClient(http, "https://example.convex.cloud");
        var svc = new PlacesService(convex);

        await svc.FetchNearby(7.5, 13.7563, 100.5018);

        Assert.NotNull(handler.LastBody);
        var args = JsonSerializer.Deserialize<JsonElement>(handler.LastBody!)
            .GetProperty("args");
        Assert.Equal(7.5, args.GetProperty("radiusKm").GetDouble());
        Assert.Equal(13.7563, args.GetProperty("lat").GetDouble(), 4);
        Assert.Equal(100.5018, args.GetProperty("lng").GetDouble(), 4);
    }

    private sealed class CapturingHandler : HttpMessageHandler
    {
        private readonly HttpResponseMessage _resp;
        public string? LastBody;
        public CapturingHandler(HttpResponseMessage resp) => _resp = resp;
        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken ct)
        {
            if (request.Content is not null)
            {
                LastBody = await request.Content.ReadAsStringAsync(ct);
            }
            return _resp;
        }
    }
}
