import { jest } from '@jest/globals';
import { convertCurrency, fetchExchangeRates, validateRates } from '../js/exchange.js';

// Exchange behavior is tested without retaining fetched rates between calls.
describe('exchange.js logic', () => {
    beforeEach(() => {
        global.fetch = jest.fn();
    });

    // Restore spies so network-boundary assertions remain independent between cases.
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('convertCurrency returns the same amount for identical currencies', () => {
        const rates = { USD: 1, ILS: 3.4 };

        // Identity conversion intentionally works without performing rate arithmetic.
        expect(convertCurrency(100, 'USD', 'USD', rates)).toBe(100);
        expect(convertCurrency(250.5, 'ILS', 'ILS', rates)).toBe(250.5);
    });

    test('convertCurrency converts between every supported currency pair', () => {
        const rates = { USD: 1, ILS: 3.4, GBP: 0.6, EURO: 0.7 };
        const currencies = ['USD', 'ILS', 'GBP', 'EURO'];

        // Exhausting the small supported set verifies the shared USD-normalization formula.
        for (const sourceCurrency of currencies) {
            for (const targetCurrency of currencies) {
                const amount = 100;

                // Compute the expected pair directly from the documented USD-relative rates.
                const expectedAmount = (amount / rates[sourceCurrency]) * rates[targetCurrency];
                const convertedAmount = convertCurrency(amount, sourceCurrency, targetCurrency, rates);
                expect(convertedAmount).toBeCloseTo(expectedAmount);
            }
        }
    });

    // Invalid-rate coverage exercises each constraint used by the normalized conversion formula.
    test('convertCurrency rejects missing or invalid explicitly provided rates', () => {
        const partialRates = { USD: 1, ILS: 3.4 };

        // Missing source or target entries include unsupported currency symbols.
        expect(() => convertCurrency(100, 'USD', 'GBP', partialRates)).toThrow('Exchange rates are missing or invalid');
        expect(() => convertCurrency(100, 'GBP', 'USD', partialRates)).toThrow('Exchange rates are missing or invalid');
        expect(() => convertCurrency(100, 'YEN', 'USD', partialRates)).toThrow('Exchange rates are missing or invalid');
        expect(() => convertCurrency(100, 'USD', 'ILS', null)).toThrow('Exchange rates are missing or invalid');

        // Rates must be positive because zero or negative divisors invalidate normalization.
        expect(() => convertCurrency(100, 'USD', 'ILS', { USD: 1, ILS: -1 })).toThrow('Exchange rates are missing or invalid');
        expect(() => convertCurrency(100, 'USD', 'ILS', { USD: 1, ILS: 0 })).toThrow('Exchange rates are missing or invalid');

        // Non-finite and non-numeric values are rejected before conversion arithmetic.
        expect(() => convertCurrency(100, 'USD', 'ILS', { USD: 1, ILS: NaN })).toThrow('Exchange rates are missing or invalid');
        expect(() => convertCurrency(100, 'USD', 'ILS', { USD: 1, ILS: Infinity })).toThrow('Exchange rates are missing or invalid');
        expect(() => convertCurrency(100, 'USD', 'ILS', { USD: 1, ILS: '3.4' })).toThrow('Exchange rates are missing or invalid');
    });

    // Omitting the source selects the local default without storing that choice in the module.
    test('fetchExchangeRates uses the default URL when no URL is provided', async () => {
        // Include the complete server contract so validation succeeds after fetch.
        const ratePayload = {
            USD: 1,
            ILS: 3.4,
            GBP: 0.6,
            EURO: 0.7
        };

        // The fetch boundary returns the payload only after JSON parsing and validation.
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ratePayload
        });

        // The default path is asserted alongside the validated object returned to the caller.
        const fetchedRates = await fetchExchangeRates();
        expect(global.fetch).toHaveBeenCalledWith('https://cost-2-cost.onrender.com/rates/default/rates.json');
        expect(fetchedRates).toEqual(ratePayload);
    });

    // A custom source must affect only this fetch call and must not become module state.
    test('fetchExchangeRates uses a custom URL when provided', async () => {
        const customUrl = 'https://example.com/rates.json';
        // Custom and default sources share the same required payload structure.
        const ratePayload = {
            USD: 1,
            ILS: 3.4,
            GBP: 0.6,
            EURO: 0.7
        };

        // URL selection is explicit per call; exchange.js owns no Settings or cached URL state.
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ratePayload
        });

        // The caller-provided URL must pass through unchanged to this fetch invocation.
        const fetchedRates = await fetchExchangeRates(customUrl);
        expect(global.fetch).toHaveBeenCalledWith(customUrl);
        expect(fetchedRates).toEqual(ratePayload);
    });

    // Explicit calls to this stateless helper each cross the Fetch boundary independently.
    test('fetchExchangeRates performs a fresh request for each separate invocation', async () => {
        const localRatesUrl = 'rates/default/rates.json';
        const firstRatePayload = { USD: 1, ILS: 3.4, GBP: 0.6, EURO: 0.7 };
        const secondRatePayload = { USD: 1, ILS: 3.5, GBP: 0.61, EURO: 0.71 };

        // Distinct responses make retained results observable if a later call skips fetch.
        global.fetch
            .mockResolvedValueOnce({ ok: true, json: async () => firstRatePayload })
            .mockResolvedValueOnce({ ok: true, json: async () => secondRatePayload });

        const firstFetchedRates = await fetchExchangeRates(localRatesUrl);
        const secondFetchedRates = await fetchExchangeRates(localRatesUrl);

        // Two direct helper invocations must produce two network requests.
        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(global.fetch).toHaveBeenNthCalledWith(1, localRatesUrl);
        expect(global.fetch).toHaveBeenNthCalledWith(2, localRatesUrl);
        expect(firstFetchedRates).toEqual(firstRatePayload);
        expect(secondFetchedRates).toEqual(secondRatePayload);
    });

    // HTTP failures are rejected before attempting to parse a response body.
    test('fetchExchangeRates reports an unsuccessful HTTP response', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: false,
            statusText: 'Not Found'
        });

        // The error log marks the network boundary while callers still receive the rejection.
        const errorLogSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        await expect(fetchExchangeRates()).rejects.toThrow('Failed to fetch rates: Not Found');
        expect(errorLogSpy).toHaveBeenCalled();
        errorLogSpy.mockRestore();
    });

    // A rejected fetch must remain observable to the operation that requested rates.
    test('fetchExchangeRates preserves a fetch rejection', async () => {
        global.fetch.mockRejectedValueOnce(new Error('Network error'));

        // Network exceptions are logged and rethrown rather than replaced with hidden fallback data.
        const errorLogSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        await expect(fetchExchangeRates()).rejects.toThrow('Network error');
        expect(errorLogSpy).toHaveBeenCalled();
        errorLogSpy.mockRestore();
    });

    // Parsing failures are part of the same stateless fetch boundary as network failures.
    test('fetchExchangeRates preserves a JSON parsing rejection', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => {
                // Simulate malformed server content at the response parsing boundary.
                throw new Error('Invalid JSON');
            }
        });

        // The parsing exception should remain the rejection observed by the caller.
        const errorLogSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        await expect(fetchExchangeRates()).rejects.toThrow('Invalid JSON');
        expect(errorLogSpy).toHaveBeenCalled();
        errorLogSpy.mockRestore();
    });

    // Root-shape validation runs before individual required currencies are read.
    test('validateRates rejects a payload that is not an object', () => {
        // Fetched JSON must be a keyed rate map before currency entries can be inspected.
        expect(() => validateRates(null)).toThrow('Rates must be an object');
        expect(() => validateRates('rates')).toThrow('Rates must be an object');
        expect(() => validateRates(123)).toThrow('Rates must be an object');
    });

    // Every supported currency is mandatory in a fetched rate payload.
    test('validateRates rejects missing or invalid required currencies', () => {
        const missingCurrencyRates = { USD: 1, ILS: 3.4, EURO: 0.7 };
        expect(() => validateRates(missingCurrencyRates)).toThrow('Invalid or missing rate for GBP');

        // Required entries cannot rely on string coercion at the network boundary.
        const stringRatePayload = { USD: 1, ILS: 3.4, GBP: '0.6', EURO: 0.7 };
        expect(() => validateRates(stringRatePayload)).toThrow('Invalid or missing rate for GBP');

        const negativeRatePayload = { USD: 1, ILS: 3.4, GBP: -0.6, EURO: 0.7 };
        expect(() => validateRates(negativeRatePayload)).toThrow('Invalid or missing rate for GBP');

        // Zero and non-finite rates cannot participate in safe conversion math.
        const zeroRatePayload = { USD: 1, ILS: 3.4, GBP: 0, EURO: 0.7 };
        expect(() => validateRates(zeroRatePayload)).toThrow('Invalid or missing rate for GBP');

        const nanRatePayload = { USD: 1, ILS: 3.4, GBP: NaN, EURO: 0.7 };
        expect(() => validateRates(nanRatePayload)).toThrow('Invalid or missing rate for GBP');

        // Infinity is numeric by type but still unusable as an exchange rate.
        const infiniteRatePayload = { USD: 1, ILS: 3.4, GBP: Infinity, EURO: 0.7 };
        expect(() => validateRates(infiniteRatePayload)).toThrow('Invalid or missing rate for GBP');
    });
});
