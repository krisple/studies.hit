import { jest } from '@jest/globals';

const validConfig = {
    databaseName: 'costsdb',
    databaseVersion: 1,
    defaultRatesUrl: 'https://example.com/rates.json',
    exchangeRatesRefreshIntervalMs: 60_000
};

// Reloading the module exercises its private validation through the public loading boundary.
async function loadConfig(databaseVersion) {
    jest.resetModules();
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ...validConfig, databaseVersion })
    });

    return import('../js/config.js');
}

describe('application config validation', () => {
    test.each([0, -1, 1.5])('rejects database version %s', async (databaseVersion) => {
        await expect(loadConfig(databaseVersion)).rejects.toThrow(
            'Application config contains invalid database settings'
        );
    });
});
