import { applicationConfig } from './config.js';

// Module validating exchange-rate payloads and performing pure conversions.

// Validates the structure and content of fetched exchange rates.
export function validateRates(rates) {
    /* The rate-map data structure requires one positive finite numeric value for
       every supported currency before any fetched payload enters conversion logic. */
    const supportedCurrencies = ['USD', 'ILS', 'GBP', 'EURO'];

    // The rates payload from the network must be structurally valid before we process it.
    if (!rates || typeof rates !== 'object') {
        throw new Error('Rates must be an object');
    }

    // Validate every required key instead of accepting a partial server payload.
    for (const currency of supportedCurrencies) {
        const rate = rates[currency];

        // Negative, zero, or non-finite rates would break our conversion formulas.
        if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
            throw new Error(`Invalid or missing rate for ${currency}`);
        }
    }
}

// Pure function to convert an amount between two currencies based on provided rates.
export function convertCurrency(amount, fromCurrency, toCurrency, rates) {
    /* The conversion algorithm normalizes the calculation by converting the source
       amount into the base currency (USD) first. It then multiplies the base amount
       by the target currency rate. This allows conversion between any two supported
       currencies without maintaining an exhaustive matrix of direct exchange rates. */

    // Identity conversion is inherently safe and requires no external rates dependency.
    if (fromCurrency === toCurrency) {
        return Number(amount);
    }

    // We must abort conversion if the required exchange rates object is absent or invalid.
    if (!rates || typeof rates !== 'object') {
        throw new Error(`Exchange rates are missing or invalid for requested currencies: ${fromCurrency} to ${toCurrency}`);
    }

    // Validate the required source and target rates dynamically before using them.
    const fromRate = rates[fromCurrency];
    const toRate = rates[toCurrency];

    // We reject non-numeric, non-finite, zero, or negative rates to prevent corrupt math.
    if (typeof fromRate !== 'number' || !Number.isFinite(fromRate) || fromRate <= 0 ||
        typeof toRate !== 'number' || !Number.isFinite(toRate) || toRate <= 0) {
        throw new Error(`Exchange rates are missing or invalid for requested currencies: ${fromCurrency} to ${toCurrency}`);
    }

    // Convert source amount to base currency (USD) then multiply by target rate.
    const amountInUsd = Number(amount) / fromRate;
    return amountInUsd * toRate;
}

// Every invocation performs one fresh request and returns validated rates without retaining them.
export async function fetchExchangeRates(ratesUrl = applicationConfig.defaultRatesUrl) {
    try {
        // The browser may apply its normal HTTP cache optimization to this network request.
        const ratesResponse = await fetch(ratesUrl);

        // We reject the promise directly on HTTP failure to avoid parsing invalid bodies.
        if (!ratesResponse.ok) {
            throw new Error(`Failed to fetch rates: ${ratesResponse.statusText}`);
        }

        const fetchedRates = await ratesResponse.json();
        validateRates(fetchedRates);

        // Only a fully validated payload may leave the network boundary.
        return fetchedRates;
    } catch (error) {
        // Logging at this boundary helps pinpoint network or parsing issues quickly.
        console.error('Error fetching exchange rates:', error);
        throw error;
    }
}
