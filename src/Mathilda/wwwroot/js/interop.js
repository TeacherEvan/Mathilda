// Mathilda browser interop. Loaded before the Blazor WASM bootstrap.
window.mathilda = window.mathilda || {};

// ==================== GEOLOCATION ====================
// Resolves to { lat, lng } on success, or { error } when unavailable/denied.
// C# (LocationPromptModal) reads the lat/lng properties directly.
window.mathilda.geolocation = window.mathilda.geolocation || {};
window.mathilda.geolocation.request = function (options) {
    const opts = options || { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 };
    return new Promise(function (resolve) {
        if (!navigator.geolocation) {
            resolve({ error: "denied:unsupported" });
            return;
        }
        navigator.geolocation.getCurrentPosition(
            function (pos) {
                resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            },
            function (err) {
                resolve({ error: "denied:" + (err && err.code) });
            },
            opts
        );
    });
};

// ==================== PWA INSTALL ====================
window.mathilda.pwa = window.mathilda.pwa || {};
let deferredPrompt = null;
let platformInfo = null;
// DotNetObjectReference registered from C# (no eval). Null until registered.
let installDotNetRef = null;

window.mathilda.pwa.registerCallbacks = function (dotNetRef) {
    installDotNetRef = dotNetRef;
};

function notifyInstallPromptReady() {
    if (installDotNetRef) {
        installDotNetRef.invokeMethodAsync('OnInstallPromptReady', platformInfo);
    }
}

function notifyAppInstalled() {
    installDotNetRef && installDotNetRef.invokeMethodAsync('OnAppInstalled');
}

// Initialize platform detection and install prompt listener
window.mathilda.pwa.init = function () {
    // Detect platform
    const ua = navigator.userAgent;
    let platform = 'Other';
    if (/iPhone|iPad|iPod/i.test(ua) && /Safari/i.test(ua)) platform = 'iOS';
    else if (/Android/i.test(ua)) platform = 'Android';
    else if (/Chrome|Edg|Chromium/i.test(ua)) platform = 'DesktopChromium';

    // Detect standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         window.navigator.standalone === true;

    platformInfo = { platform, isStandalone, canInstall: false };
    console.log('[PWA] Platform:', platformInfo);

    // Listen for beforeinstallprompt (Chromium desktop & Android)
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        platformInfo.canInstall = true;
        console.log('[PWA] Install prompt deferred');
        notifyInstallPromptReady();
    });

    // Listen for appinstalled
    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        platformInfo.canInstall = false;
        platformInfo.isStandalone = true;
        console.log('[PWA] App installed');
        notifyAppInstalled();
    });
};

// Trigger the native install prompt
window.mathilda.pwa.promptInstall = function () {
    return new Promise(async (resolve) => {
        if (!deferredPrompt) {
            resolve({ success: false, reason: 'no_prompt' });
            return;
        }
        try {
            await deferredPrompt.prompt();
            const choice = await deferredPrompt.userChoice;
            deferredPrompt = null;
            platformInfo.canInstall = false;
            if (choice.outcome === 'accepted') {
                resolve({ success: true });
            } else {
                resolve({ success: false, reason: 'dismissed' });
            }
        } catch (err) {
            resolve({ success: false, reason: err.message });
        }
    });
};

// Get platform info
window.mathilda.pwa.getPlatformInfo = function () {
    if (!platformInfo) {
        window.mathilda.pwa.init();
    }
    return platformInfo;
};

// ==================== STORAGE ====================
window.mathilda.storage = window.mathilda.storage || {};

// Keys owned by Mathilda. Clear is scoped to these so we never wipe unrelated
// localStorage entries (e.g. third-party libs).
const MATHILDA_STORAGE_KEYS = [
    "mathilda.settings",
    "mathilda.privacy.consent"
];

window.mathilda.storage.getItem = function (key) {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        console.warn('[Storage] getItem failed:', e);
        return null;
    }
};

window.mathilda.storage.setItem = function (key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        console.warn('[Storage] setItem failed:', e);
        return false;
    }
};

window.mathilda.storage.clear = function () {
    try {
        MATHILDA_STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
        return true;
    } catch (e) {
        console.warn('[Storage] clear failed:', e);
        return false;
    }
};

// ==================== SERVICE WORKER ====================
window.mathilda.sw = window.mathilda.sw || {};

// Triggers a real service-worker update: ask the active worker to skipWaiting
// and ask the browser to check for a new worker.
window.mathilda.sw.update = function () {
    return new Promise(async (resolve) => {
        try {
            const reg = await navigator.serviceWorker.getRegistration();
            if (!reg) {
                resolve({ success: false, reason: 'no_registration' });
                return;
            }
            // Request the waiting/installing worker to activate immediately.
            if (reg.waiting) {
                reg.waiting.postMessage('skipWaiting');
            }
            await reg.update();
            resolve({ success: true });
        } catch (err) {
            resolve({ success: false, reason: err.message });
        }
    });
};

// Initialize on load
window.mathilda.pwa.init();
