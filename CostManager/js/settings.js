// The default relative source ships with the application and requires no saved setting.
export const defaultRatesUrl = 'rates.json';
const ratesUrlStorageKey = 'costManager_ratesUrl';

// Custom sources must be absolute web URLs because Fetch will contact an external server.
function validateCustomRatesUrl(customRatesUrl) {
    let parsedRatesUrl;

    try {
        // URL construction rejects malformed values before protocol rules are considered.
        parsedRatesUrl = new URL(customRatesUrl);
    } catch {
        throw new Error('Enter a valid HTTP or HTTPS URL');
    }

    // Restrict the setting to protocols supported by the expected remote JSON endpoint.
    if (parsedRatesUrl.protocol !== 'http:' && parsedRatesUrl.protocol !== 'https:') {
        throw new Error('Enter a valid HTTP or HTTPS URL');
    }
}

// The application layer calls this for each rate-dependent operation.
export function getExchangeRatesUrl(storage = localStorage) {
    const storedRatesUrl = storage.getItem(ratesUrlStorageKey);

    // Absence of a custom setting always falls back to the bundled default source.
    if (storedRatesUrl === null || storedRatesUrl.trim() === '') {
        return defaultRatesUrl;
    }

    const normalizedRatesUrl = storedRatesUrl.trim();

    // Revalidate persisted state because localStorage can be corrupted outside this form.
    validateCustomRatesUrl(normalizedRatesUrl);
    return normalizedRatesUrl;
}

// Saving a blank URL deliberately restores default-source behavior.
export function saveExchangeRatesUrl(providedRatesUrl, storage = localStorage) {
    const normalizedRatesUrl = String(providedRatesUrl).trim();

    if (normalizedRatesUrl === '') {
        storage.removeItem(ratesUrlStorageKey);
        return defaultRatesUrl;
    }

    // Validate immediately at the form boundary, before the setting reaches later fetch calls.
    validateCustomRatesUrl(normalizedRatesUrl);
    storage.setItem(ratesUrlStorageKey, normalizedRatesUrl);
    return normalizedRatesUrl;
}
