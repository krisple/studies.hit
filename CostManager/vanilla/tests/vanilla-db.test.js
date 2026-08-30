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
        expect(global.fetch).toHaveBeenCalledWith('https://cost-2-cost.onrender.com/rates/default/rates.json');
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

    // Configure the standalone browser environment before evaluating db.js.
    test('rejects non-positive sums and blank text fields', () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => rates });
        window.fetch = global.fetch;
        window.eval(vanillaSource);
        const costsDb = window.db.openCostsDB('vanilla-validation', 1);

        // The standalone API applies the same strict input contract as the module variant.
        expect(() => costsDb.addCost({ sum: 0, currency: 'USD', category: 'Food', description: 'Lunch' }))
            .toThrow('Cost sum must be a finite number greater than 0');
        expect(() => costsDb.addCost({ sum: -5, currency: 'USD', category: 'Food', description: 'Lunch' }))
            .toThrow('Cost sum must be a finite number greater than 0');
        // Verify invalid input is rejected without changing valid persisted state.
        expect(() => costsDb.addCost({ sum: 10, currency: 'USD', category: '', description: 'Lunch' }))
            .toThrow('Cost category and description must be non-empty strings');
        expect(() => costsDb.addCost({ sum: 10, currency: 'USD', category: '   ', description: 'Lunch' }))
            .toThrow('Cost category and description must be non-empty strings');
        // Verify invalid input is rejected without changing valid persisted state.
        expect(() => costsDb.addCost({ sum: 10, currency: 'USD', category: 'Food', description: '' }))
            .toThrow('Cost category and description must be non-empty strings');
        expect(() => costsDb.addCost({ sum: 10, currency: 'USD', category: 'Food', description: '   ' }))
            .toThrow('Cost category and description must be non-empty strings');
    });

    // Configure the standalone browser environment before evaluating db.js.
    test('rejects blank database names and non-positive or non-integer versions', () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => rates });
        window.fetch = global.fetch;
        window.eval(vanillaSource);
        const identityError = 'databaseName must be a non-empty string and databaseVersion must be a positive integer';

        // The classic-script API enforces the same database identity rules as the module.
        expect(() => window.db.openCostsDB(123, 1)).toThrow(identityError);
        expect(() => window.db.openCostsDB('', 1)).toThrow(identityError);
        expect(() => window.db.openCostsDB('   ', 1)).toThrow(identityError);
        expect(() => window.db.openCostsDB('valid-name', '1')).toThrow(identityError);
        expect(() => window.db.openCostsDB('valid-name', 0)).toThrow(identityError);
        expect(() => window.db.openCostsDB('valid-name', -1)).toThrow(identityError);
        expect(() => window.db.openCostsDB('valid-name', 1.5)).toThrow(identityError);

        // Surrounding whitespace remains part of a valid non-empty database name.
        expect(() => window.db.openCostsDB('  valid-name  ', 1)).not.toThrow();
    });
});
