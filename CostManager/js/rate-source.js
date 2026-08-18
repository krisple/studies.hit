import { fetchExchangeRates } from './exchange.js';
import { getExchangeRatesUrl } from './settings.js';

// Each application operation resolves the current setting and performs its own fresh fetch.
export async function fetchConfiguredExchangeRates(storage = localStorage) {
    const activeRatesUrl = getExchangeRatesUrl(storage);
    return fetchExchangeRates(activeRatesUrl);
}
