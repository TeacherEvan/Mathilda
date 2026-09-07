using System.Text.Json;
using Bunit;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.JSInterop;
using Microsoft.JSInterop.Infrastructure;
using Moq;
using Mathilda.Components;
using Mathilda.Models;
using Mathilda.Services;
using Xunit;

namespace Mathilda.Tests.Services;

/// <summary>
/// Regression coverage for the JS/C# interop contract (surgical-implementation OBJ-01/02/03).
/// These guard against the contract drift that previously left features silently broken:
/// geolocation returning a string instead of {lat,lng}, storage.clear being undefined, and
/// sw.update being undefined.
///
/// F2 (REVIEW-FINDINGS-2026-09-07): the prior StorageClear / ServiceWorkerUpdate tests
/// asserted only that the mocked IJSRuntime fired a Setup callback - they bypassed the
/// production component path and would still pass if PrivacySettingsTab.ClearCacheAsync
/// or AdvancedSettingsPanel.ForceReloadSwAsync were removed. These versions render the
/// real Razor components via bUnit and click the actual button to drive the JS call,
/// so a break in the production code path makes them fail.
/// </summary>
public class InteropContractTests : TestContext
{
    private readonly Mock<IJSRuntime> _jsMock;
    private readonly LocalStore _store;
    private readonly InstallPromptService _install;

    public InteropContractTests()
    {
        _jsMock = new Mock<IJSRuntime>();
        _store = new LocalStore(_jsMock.Object);
        _install = new InstallPromptService(_jsMock.Object, new AppSettingsService(_store));

        // Pre-stage the mathilda.storage.getItem call so PrivacyConsentService.LoadAsync
        // returns a fresh PrivacyConsent (null -> new() fallback) instead of throwing.
        _jsMock.Setup(x => x.InvokeAsync<string?>("mathilda.storage.getItem", It.IsAny<object[]>()))
            .ReturnsAsync((string?)null);

        Services.AddSingleton<IJSRuntime>(_jsMock.Object);
        Services.AddSingleton(_store);
        Services.AddSingleton(_install);
        Services.AddSingleton(new AppSettingsService(_store));
        Services.AddSingleton(new PrivacyConsentService(_store));
    }

    [Fact]
    public async Task LocationService_RequestGpsAsync_ParsesLatLngObject()
    {
        _jsMock.Setup(x => x.InvokeAsync<JsonElement>("mathilda.geolocation.request", It.IsAny<object[]>()))
            .ReturnsAsync(JsonSerializer.Deserialize<JsonElement>("{\"lat\":13.7563,\"lng\":100.5018}"));

        var svc = new LocationService(_jsMock.Object, _store);

        var coords = await svc.RequestGpsAsync();

        Assert.True(coords.HasValue);
        Assert.Equal(13.7563, coords!.Value.Lat, 4);
        Assert.Equal(100.5018, coords!.Value.Lng, 4);
    }

    [Fact]
    public async Task LocationService_RequestGpsAsync_ReturnsNullOnErrorShape()
    {
        _jsMock.Setup(x => x.InvokeAsync<JsonElement>("mathilda.geolocation.request", It.IsAny<object[]>()))
            .ReturnsAsync(JsonSerializer.Deserialize<JsonElement>("{\"error\":\"denied:1\"}"));

        var svc = new LocationService(_jsMock.Object, _store);

        var coords = await svc.RequestGpsAsync();

        Assert.False(coords.HasValue);
    }

    [Fact]
    public async Task PrivacySettingsTab_ClearCacheButton_InvokesStorageClear()
    {
        _jsMock.Setup(x => x.InvokeAsync<IJSVoidResult>("mathilda.storage.clear", It.IsAny<object[]>()))
            .ReturnsAsync(Mock.Of<IJSVoidResult>());

        var cut = RenderComponent<PrivacySettingsTab>();
        var buttons = cut.FindAll("button");
        var clearButton = buttons.First(b => b.TextContent.Contains("Clear Offline Cache"));
        clearButton.Click();

        cut.WaitForState(() => cut.Markup.Contains("Cache cleared") || cut.Markup.Contains("Failed"));

        _jsMock.Verify(
            x => x.InvokeAsync<IJSVoidResult>("mathilda.storage.clear", It.IsAny<object[]>()),
            Times.AtLeastOnce);
        Assert.Contains("Cache cleared", cut.Markup);
    }

    [Fact]
    public async Task AdvancedSettingsPanel_ForceReloadSwButton_InvokesSwUpdate()
    {
        _jsMock.Setup(x => x.InvokeAsync<JsonElement>("mathilda.sw.update", It.IsAny<object[]>()))
            .ReturnsAsync(JsonSerializer.Deserialize<JsonElement>("{\"success\":true}"));

        var cut = RenderComponent<AdvancedSettingsPanel>();
        var buttons = cut.FindAll("button");
        var swButton = buttons.First(b => b.TextContent.Contains("Force Service Worker Reload"));
        swButton.Click();

        cut.WaitForState(() => cut.Markup.Contains("Service worker update triggered") || cut.Markup.Contains("Failed"));

        _jsMock.Verify(
            x => x.InvokeAsync<JsonElement>("mathilda.sw.update", It.IsAny<object[]>()),
            Times.AtLeastOnce);
        Assert.Contains("Service worker update triggered", cut.Markup);
    }

    [Fact]
    public async Task InstallPromptService_Initialize_RegistersTypedCallback_NoEval()
    {
        _jsMock.Setup(x => x.InvokeAsync<JsonElement>("mathilda.pwa.getPlatformInfo", It.IsAny<object[]>()))
            .ReturnsAsync(JsonSerializer.Deserialize<JsonElement>("{\"platform\":\"DesktopChromium\",\"isStandalone\":false,\"canInstall\":true,\"userAgent\":\"test\"}"));

        string? registeredSymbol = null;
        _jsMock.Setup(x => x.InvokeAsync<object?>("mathilda.pwa.registerCallbacks", It.IsAny<object[]>()))
            .Callback<string, object[]>((sym, args) => registeredSymbol = sym)
            .ReturnsAsync(true);

        await _install.InitializeAsync();

        Assert.Equal("mathilda.pwa.registerCallbacks", registeredSymbol);
        Assert.True(_install.CanShowInstallPrompt);
    }
}
