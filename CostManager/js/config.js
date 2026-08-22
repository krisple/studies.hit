const configUrl = new URL('../config.json', import.meta.url);

// Runtime validation prevents an edited configuration from failing later without context.
function validateApplicationConfig(config) {
    if (!config || typeof config !== 'object') {
        throw new Error('Application config must be an object');
    }

    // Database settings must satisfy the same boundary used by openCostsDB.
    if (typeof config.databaseName !== 'string' || config.databaseName.trim() === '' ||
        typeof config.databaseVersion !== 'number' || !Number.isFinite(config.databaseVersion)) {
        throw new Error('Application config contains invalid database settings');
    }

    // Rate loading requires a source and a positive refresh interval.
    if (typeof config.defaultRatesUrl !== 'string' || config.defaultRatesUrl.trim() === '' ||
        typeof config.exchangeRatesRefreshIntervalMs !== 'number' ||
        !Number.isFinite(config.exchangeRatesRefreshIntervalMs) || config.exchangeRatesRefreshIntervalMs <= 0) {
        throw new Error('Application config contains invalid exchange-rate settings');
    }
}

// Loading with no-store makes a deployed config edit visible on the next page refresh.
async function loadApplicationConfig() {
    const configResponse = await fetch(configUrl, { cache: 'no-store' });

    if (!configResponse.ok) {
        throw new Error(`Failed to load application config: ${configResponse.statusText}`);
    }

    const loadedConfig = await configResponse.json();
    validateApplicationConfig(loadedConfig);

    // Freezing protects the loaded snapshot without restricting later file edits and reloads.
    return Object.freeze({ ...loadedConfig });
}

export const applicationConfig = await loadApplicationConfig();
