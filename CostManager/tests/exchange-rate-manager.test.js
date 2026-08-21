import { jest } from '@jest/globals';
import { applicationConfig } from '../js/config.js';
import { ExchangeRateManager } from '../js/exchange-rate-manager.js';

const firstRates = { USD: 1, ILS: 4, GBP: 0.5, EURO: 0.8 };
const secondRates = { USD: 1, ILS: 5, GBP: 0.6, EURO: 0.9 };

// Deferred requests make the manager's behavior observable while Fetch is pending.
function createDeferredRequest() {
    let resolveRequest;
    const promise = new Promise((resolve) => {
        resolveRequest = resolve;
    });

    // Tests control completion without exposing Promise construction details at each call site.
    return { promise, resolveRequest };
}

describe('ExchangeRateManager', () => {
    // Every test restores timer and mock state used by its isolated manager instance.
    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    // Startup owns both the immediate request and recurring application timer.
    test('startup fetches immediately and refreshes every configured sixty seconds', async () => {
        jest.useFakeTimers();
        const fetchRates = jest.fn()
            .mockResolvedValueOnce(firstRates)
            .mockResolvedValueOnce(secondRates);
        const rateManager = new ExchangeRateManager(fetchRates, applicationConfig.exchangeRatesRefreshIntervalMs);

        // Calling start performs the first request before the interval can elapse.
        const initialLoad = rateManager.start(applicationConfig.defaultRatesUrl);
        expect(fetchRates).toHaveBeenCalledWith(applicationConfig.defaultRatesUrl);
        expect(fetchRates).toHaveBeenCalledTimes(1);
        await initialLoad;

        // Exactly one configured interval initiates exactly one new request.
        jest.advanceTimersByTime(60_000);
        expect(applicationConfig.exchangeRatesRefreshIntervalMs).toBe(60_000);
        expect(fetchRates).toHaveBeenCalledTimes(2);
        await Promise.resolve();
        await Promise.resolve();
        expect(rateManager.getRates()).toEqual(secondRates);
        // Explicit cleanup prevents the fake interval from leaking beyond this case.
        rateManager.stop();
    });

    // Synchronous reads must never initiate network activity of their own.
    test('reuses one retained snapshot without extra requests', async () => {
        const fetchRates = jest.fn().mockResolvedValue(firstRates);
        const rateManager = new ExchangeRateManager(fetchRates);
        await rateManager.setRatesUrl('rates.json');

        // Multiple synchronous consumers share one immutable in-memory object.
        const firstRead = rateManager.getRates();
        const secondRead = rateManager.getRates();
        expect(firstRead).toBe(secondRead);
        expect(Object.isFrozen(firstRead)).toBe(true);
        expect(fetchRates).toHaveBeenCalledTimes(1);
    });

    // Pending replacement state must preserve the last fully validated snapshot.
    test('keeps valid rates available while a replacement source is pending', async () => {
        const replacementRequest = createDeferredRequest();
        const fetchRates = jest.fn()
            .mockResolvedValueOnce(firstRates)
            .mockReturnValueOnce(replacementRequest.promise);
        const rateManager = new ExchangeRateManager(fetchRates);
        await rateManager.setRatesUrl('rates.json');

        // The new URL takes effect by starting Fetch synchronously from setRatesUrl.
        const replacementLoad = rateManager.setRatesUrl('https://example.com/rates.json');
        expect(fetchRates).toHaveBeenLastCalledWith('https://example.com/rates.json');
        expect(rateManager.getRates()).toEqual(firstRates);

        // Only a successful replacement swaps the active snapshot.
        replacementRequest.resolveRequest(secondRates);
        await replacementLoad;
        expect(rateManager.getRates()).toEqual(secondRates);
    });

    // Replacement failures are observable without clearing the usable snapshot.
    test('retains valid rates when a replacement request fails', async () => {
        const fetchRates = jest.fn()
            .mockResolvedValueOnce(firstRates)
            .mockRejectedValueOnce(new Error('Network error'));
        const rateManager = new ExchangeRateManager(fetchRates);
        await rateManager.setRatesUrl('rates.json');

        // Fetch failure rejects the change operation but does not clear usable memory.
        await expect(rateManager.setRatesUrl('https://example.com/rates.json'))
            .rejects.toThrow('Network error');
        expect(rateManager.getRates()).toEqual(firstRates);
    });

    // Source-version ordering prevents obsolete URLs from winning a response race.
    test('does not activate a late response from a superseded URL', async () => {
        const oldRequest = createDeferredRequest();
        const newRequest = createDeferredRequest();
        const fetchRates = jest.fn()
            .mockReturnValueOnce(oldRequest.promise)
            .mockReturnValueOnce(newRequest.promise);
        const rateManager = new ExchangeRateManager(fetchRates);

        // Starting a newer source invalidates the pending response identity of the old one.
        const oldLoad = rateManager.setRatesUrl('https://old.example/rates.json');
        const newLoad = rateManager.setRatesUrl('https://new.example/rates.json');
        oldRequest.resolveRequest(firstRates);
        await oldLoad;
        expect(() => rateManager.getRates()).toThrow('Exchange rates have not loaded yet');

        // The still-current source becomes active when its valid response arrives.
        newRequest.resolveRequest(secondRates);
        await newLoad;
        expect(rateManager.getRates()).toEqual(secondRates);
    });
});
