// Central application constants keep deployment and timing choices easy to tune.
export const applicationConfig = Object.freeze({
    databaseName: 'cost-manager',
    databaseVersion: 1,
    // The bundled file is the fallback until deployment provides another default endpoint.
    defaultRatesUrl: 'rates.json',
    exchangeRatesRefreshIntervalMs: 60_000
});
