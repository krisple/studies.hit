import { readFileSync } from 'node:fs';
import { jest } from '@jest/globals';

const vanillaSource = readFileSync(new URL('../db.js', import.meta.url), 'utf8');
const rates = { USD: 1, ILS: 4, GBP: 0.5, EURO: 0.8 };

// Promise turns complete both the response and asynchronous JSON parsing boundaries.
async function finishRatesLoad() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

// The classic-script fixture remains isolated from the application's module manager.
describe('standalone Vanilla db.js', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.useFakeTimers();
    });

    // Timer restoration removes the classic script's browser-test scheduling state.
    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
        delete window.db;
    });

    // Script evaluation must initiate exactly one request for the fixed default source.
    test('loads default rates on script evaluation and keeps getReport synchronous', async () => {
        let resolveFetch;
        const pendingFetch = new Promise((resolve) => {
            resolveFetch = resolve;
        });
        // A fallback response makes any accidental extra Fetch visible without test noise.
        global.fetch = jest.fn().mockReturnValueOnce(pendingFetch)
            .mockResolvedValue({ ok: true, json: async () => rates });
        window.fetch = global.fetch;

        // Evaluating the classic script must expose db and start Fetch immediately.
        window.eval(vanillaSource);
        expect(window.db).toBeDefined();
        expect(global.fetch).toHaveBeenCalledWith('rates.json');
        const costsDb = window.db.openCostsDB('vanilla-test', 1);
        costsDb.addCost({ sum: 40, currency: 'ILS', category: 'Food', description: 'Lunch' });

        // Before the first successful load, cross-currency reporting may fail synchronously.
        expect(costsDb.getReport.length).toBe(3);
        expect(() => costsDb.getReport('USD')).toThrow('Exchange rates have not loaded yet');
        resolveFetch({ ok: true, json: async () => rates });
        await finishRatesLoad();

        // The same method now reuses memory and returns a plain report object.
        const report = costsDb.getReport('USD');
        expect(report).not.toBeInstanceOf(Promise);
        expect(report.total.sum).toBe(10);
        expect(global.fetch).toHaveBeenCalledTimes(1);

        // Advancing time proves the standalone file does not own a periodic refresh timer.
        jest.advanceTimersByTime(60_000);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });
});
