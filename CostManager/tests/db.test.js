import { jest } from '@jest/globals';
import db from '../js/db.module.js';
import { exchangeRateManager } from '../js/exchange-rate-manager.js';

const activeRates = { USD: 1, ILS: 4, GBP: 0.5, EURO: 0.8 };

// These tests exercise the module variant; the Vanilla file is verified separately through its global API.
describe('db.module.js logic', () => {
    beforeEach(async () => {
        localStorage.clear();
        global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => activeRates });
        await exchangeRateManager.setRatesUrl('rates.json');
    });

    // No mock behavior should survive into the next storage or report case.
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('openCostsDB rejects invalid database identity arguments', () => {
        // The database boundary requires the documented string name and a finite numeric version.
        expect(() => db.openCostsDB(123, 1)).toThrow('databaseName must be a string and databaseVersion must be a finite number');
        expect(() => db.openCostsDB('testdb', '1')).toThrow('databaseName must be a string and databaseVersion must be a finite number');
        expect(() => db.openCostsDB('testdb', NaN)).toThrow('databaseName must be a string and databaseVersion must be a finite number');
        expect(() => db.openCostsDB('testdb', Infinity)).toThrow('databaseName must be a string and databaseVersion must be a finite number');
    });

    // The returned instance must expose both operations from the clarified DB contract.
    test('openCostsDB returns an object with addCost and getReport methods', () => {
        const costsDb = db.openCostsDB('testdb', 1);

        // Both operations remain on the returned database instance under the required contract.
        expect(costsDb.addCost).toBeDefined();
        expect(typeof costsDb.addCost).toBe('function');
        expect(costsDb.getReport).toBeDefined();
        expect(typeof costsDb.getReport).toBe('function');
    });

    // Public and persisted cost shapes are verified together for one insertion.
    test('addCost stores a dated cost and returns only the public cost fields', () => {
        const costsDb = db.openCostsDB('testdb', 1);

        // Use all caller-owned fields to verify the boundary between public and stored shapes.
        const newCost = {
            sum: 200,
            currency: 'USD',
            category: 'FOOD',
            description: 'pizza'
        };

        // Adding the fixture creates both the public response and persisted record.
        const addedCost = costsDb.addCost(newCost);

        // The return contract excludes the internally attached date.
        expect(addedCost).toEqual({
            sum: 200,
            currency: 'USD',
            category: 'FOOD',
            description: 'pizza'
        });

        // Reading storage directly verifies fields intentionally omitted from the response.
        const storedCosts = JSON.parse(localStorage.getItem('costsdb_testdb'));

        // Persistence retains the full date needed for later monthly filtering.
        expect(storedCosts.length).toBe(1);
        expect(storedCosts[0].date.day).toBeDefined();
        expect(storedCosts[0].date.month).toBeDefined();
        expect(storedCosts[0].date.year).toBeDefined();
    });

    // Zero receives its own regression case because falsy storage values must remain valid numbers.
    test('addCost allows a sum of 0', () => {
        const costsDb = db.openCostsDB('testdb', 1);
        const addedCost = costsDb.addCost({ sum: 0, currency: 'USD', category: 'FOOD', description: 'pizza' });

        // Zero is finite and the documented contract does not require a positive sum.
        expect(addedCost.sum).toBe(0);
    });

    test('addCost rejects invalid cost fields and non-finite sums', () => {
        const costsDb = db.openCostsDB('testdb', 1);

        // Input is validated without silently coercing values into the required types.
        expect(() => costsDb.addCost(null)).toThrow('Cost must be an object');
        expect(() => costsDb.addCost({ sum: '200', currency: 'USD', category: 'FOOD', description: 'pizza' })).toThrow('Cost sum must be a finite number');
        expect(() => costsDb.addCost({ sum: NaN, currency: 'USD', category: 'FOOD', description: 'pizza' })).toThrow('Cost sum must be a finite number');
        expect(() => costsDb.addCost({ sum: Infinity, currency: 'USD', category: 'FOOD', description: 'pizza' })).toThrow('Cost sum must be a finite number');

        // Currency and text fields also remain strict at the public boundary.
        expect(() => costsDb.addCost({ sum: 200, currency: 123, category: 'FOOD', description: 'pizza' })).toThrow('Cost currency must be one of the supported currencies');
        expect(() => costsDb.addCost({ sum: 200, currency: 'USD', category: 123, description: 'pizza' })).toThrow('Cost category and description must be strings');
    });

    test('addCost rejects an unsupported currency', () => {
        const costsDb = db.openCostsDB('testdb', 1);

        // Stored currency symbols are limited to the four symbols in the project contract.
        expect(() => costsDb.addCost({ sum: 200, currency: 'YEN', category: 'FOOD', description: 'pizza' })).toThrow('Cost currency must be one of the supported currencies: USD, ILS, GBP, EURO');
    });

    test('getReport rejects a missing or unsupported target currency', () => {
        const costsDb = db.openCostsDB('testdb', 1);

        // A valid target symbol is required even when the selected period contains no costs.
        expect(() => costsDb.getReport()).toThrow('Report currency must be one of the supported currencies');
        expect(() => costsDb.getReport('YEN')).toThrow('Report currency must be one of the supported currencies: USD, ILS, GBP, EURO');
    });

    test('getReport rejects invalid year and month boundaries', () => {
        const costsDb = db.openCostsDB('testdb', 1);

        // Period arguments must already be integers, and months use the public 1–12 range.
        expect(() => costsDb.getReport('USD', '2023', 5)).toThrow('Year must be an integer and month must be between 1 and 12');
        expect(() => costsDb.getReport('USD', 2023, 13)).toThrow('Year must be an integer and month must be between 1 and 12');
        expect(() => costsDb.getReport('USD', 2023, 0)).toThrow('Year must be an integer and month must be between 1 and 12');
        expect(() => costsDb.getReport('USD', 2023.5, 5)).toThrow('Year must be an integer and month must be between 1 and 12');
    });

    // The storage boundary validates the parsed root before inspecting individual costs.
    test('getReport rejects localStorage data that is not an array', () => {
        localStorage.setItem('costsdb_testdb', '{"not":"array"}');
        const costsDb = db.openCostsDB('testdb', 1);

        // Valid JSON is still corrupted database content when its root is not the storage array.
        expect(() => costsDb.getReport('USD')).toThrow('Failed to load costs database: Stored data is not an array');
    });

    test('getReport treats an empty localStorage string as malformed data', () => {
        localStorage.setItem('costsdb_testdb', '');
        const costsDb = db.openCostsDB('testdb', 1);

        // Only a missing key means an empty database; a present empty string must fail JSON parsing.
        expect(() => costsDb.getReport('USD')).toThrow('Failed to load costs database:');
    });

    test('getReport rejects stored costs with corrupted or missing fields', () => {
        const costsDb = db.openCostsDB('testdb', 1);

        // Each assignment isolates a different mandatory storage-field violation.
        localStorage.setItem('costsdb_testdb', '[{"sum":200}]');
        expect(() => costsDb.getReport('USD')).toThrow('Failed to load costs database: Stored item has invalid or unsupported currency');

        localStorage.setItem('costsdb_testdb', '[{"sum":"100", "currency":"USD"}]');
        expect(() => costsDb.getReport('USD')).toThrow('Failed to load costs database: Stored item has invalid sum');

        // Unsupported persisted currencies cannot be converted safely in reports.
        localStorage.setItem('costsdb_testdb', '[{"sum":200, "currency":"YEN"}]');
        expect(() => costsDb.getReport('USD')).toThrow('Failed to load costs database: Stored item has invalid or unsupported currency');

        localStorage.setItem('costsdb_testdb', '[{"sum":200, "currency":"USD", "category":123, "description":"test"}]');
        expect(() => costsDb.getReport('USD')).toThrow('Failed to load costs database: Stored item has invalid category or description');

        // Text fields must retain their original string structure after persistence.
        localStorage.setItem('costsdb_testdb', '[{"sum":200, "currency":"USD", "category":"FOOD", "description":123}]');
        expect(() => costsDb.getReport('USD')).toThrow('Failed to load costs database: Stored item has invalid category or description');
    });

    test('getReport rejects stored costs with an invalid date structure', () => {
        const costsDb = db.openCostsDB('testdb', 1);

        // Reports cannot filter a stored item that has no complete insertion date.
        localStorage.setItem('costsdb_testdb', '[{"sum":200, "currency":"USD", "category":"FOOD", "description":"pizza"}]');
        expect(() => costsDb.getReport('USD')).toThrow('Failed to load costs database: Stored item is missing a valid date structure');

        localStorage.setItem('costsdb_testdb', '[{"sum":200, "currency":"USD", "category":"FOOD", "description":"pizza", "date":{"month":5, "year":2020}}]');
        expect(() => costsDb.getReport('USD')).toThrow('Failed to load costs database: Stored item is missing a valid date structure'); // Missing day.

        localStorage.setItem('costsdb_testdb', '[{"sum":200, "currency":"USD", "category":"FOOD", "description":"pizza", "date":{"day":"1", "month":5, "year":2020}}]');
        expect(() => costsDb.getReport('USD')).toThrow('Failed to load costs database: Stored item is missing a valid date structure'); // Day is not numeric.

        // Calendar bounds use the same 1-based month convention as getReport.
        localStorage.setItem('costsdb_testdb', '[{"sum":200, "currency":"USD", "category":"FOOD", "description":"pizza", "date":{"day":1, "month":13, "year":2020}}]');
        expect(() => costsDb.getReport('USD')).toThrow('Failed to load costs database: Stored item is missing a valid date structure');

        localStorage.setItem('costsdb_testdb', '[{"sum":200, "currency":"USD", "category":"FOOD", "description":"pizza", "date":{"day":0, "month":12, "year":2020}}]');
        expect(() => costsDb.getReport('USD')).toThrow('Failed to load costs database: Stored item is missing a valid date structure');

        // Day validation rejects values outside the broad calendar boundary of 1–31.
        localStorage.setItem('costsdb_testdb', '[{"sum":200, "currency":"USD", "category":"FOOD", "description":"pizza", "date":{"day":32, "month":12, "year":2020}}]');
        expect(() => costsDb.getReport('USD')).toThrow('Failed to load costs database: Stored item is missing a valid date structure');
    });

    test('addCost allows a negative sum', () => {
        const costsDb = db.openCostsDB('testdb', 1);
        const addedCost = costsDb.addCost({ sum: -15, currency: 'USD', category: 'FOOD', description: 'pizza' });

        // Negative values remain valid because the documented contract requires a number, not positivity.
        expect(addedCost.sum).toBe(-15);
    });

    test('getReport defaults omitted dates and returns the required report contract', () => {
        const costsDb = db.openCostsDB('testdb', 1);
        costsDb.addCost({ sum: 300, currency: 'USD', category: 'CAR', description: 'fuel' });
        const report = costsDb.getReport('USD');

        // Omitted year and month resolve at report time to the current period.
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1;
        expect(report.year).toBe(currentYear);
        expect(report.month).toBe(currentMonth);
        expect(report.costs.length).toBe(1);

        // Item dates expose only day because year and month are report-level fields.
        expect(report.costs[0].date).toEqual({ day: today.getDate() });
        expect(report.costs[0].date.month).toBeUndefined();
        expect(report.total.currency).toBe('USD');
        expect(report.total.sum).toBe(300);
    });

    // Function arity and call behavior enforce the clarified three-argument API.
    test('getReport keeps its synchronous three-argument signature', () => {
        const costsDb = db.openCostsDB('testdb', 1);
        costsDb.addCost({ sum: 100, currency: 'ILS', category: 'TEST', description: 'test1' });

        // A direct object result proves the method does not return a Promise.
        expect(costsDb.getReport.length).toBe(3);
        const report = costsDb.getReport('USD');
        expect(report).not.toBeInstanceOf(Promise);
        expect(report.total.sum).toBe(25);
    });

    // Identity conversion verifies that rates remain optional when no exchange is needed.
    test('getReport needs no rates when all costs already use the target currency', () => {
        const costsDb = db.openCostsDB('testdb', 1);
        costsDb.addCost({ sum: 100, currency: 'USD', category: 'TEST', description: 'test1' });

        // The report can bypass rate lookup only because every conversion is an identity.
        const report = costsDb.getReport('USD');

        // Identity conversion has no external rate dependency.
        expect(report.total.sum).toBe(100);
        expect(report.total.currency).toBe('USD');
    });

    test('getReport filters by a specific year and month', () => {
        const costsDb = db.openCostsDB('testdb', 1);
        costsDb.addCost({ sum: 100, currency: 'USD', category: 'TEST', description: 'test1' });

        // Add one fixed historical record to separate it from the current cost during filtering.
        const pastCost = {
            sum: 50,
            currency: 'USD',
            category: 'PAST',
            description: 'past1',
            date: { day: 1, month: 5, year: 2020 }
        };
        const storedCosts = JSON.parse(localStorage.getItem('costsdb_testdb'));
        storedCosts.push(pastCost);
        localStorage.setItem('costsdb_testdb', JSON.stringify(storedCosts));

        // The current-period cost must not leak into the historical report.
        const report = costsDb.getReport('USD', 2020, 5);
        expect(report.costs.length).toBe(1);
        expect(report.costs[0].description).toBe('past1');
        expect(report.total.sum).toBe(50);

        // Public item dates omit period fields already represented by the report.
        expect(report.costs[0].date).toEqual({ day: 1 });
        expect(report.costs[0].date.month).toBeUndefined();
    });

    // Instance isolation guards against introducing a hidden global current-database selection.
    test('open database instances remain isolated', () => {
        const firstCostsDb = db.openCostsDB('firstdb', 1);
        firstCostsDb.addCost({ sum: 100, currency: 'USD', category: 'FOOD', description: 'apple' });

        // A second open database must not replace hidden global current-database state.
        const secondCostsDb = db.openCostsDB('seconddb', 1);
        secondCostsDb.addCost({ sum: 200, currency: 'USD', category: 'CAR', description: 'fuel' });
        const secondReport = secondCostsDb.getReport('USD');
        expect(secondReport.costs.length).toBe(1);
        expect(secondReport.costs[0].description).toBe('fuel');
        expect(secondReport.total.sum).toBe(200);

        // Distinct storage keys provide direct evidence of instance isolation.
        const firstStoredCosts = JSON.parse(localStorage.getItem('costsdb_firstdb'));
        const secondStoredCosts = JSON.parse(localStorage.getItem('costsdb_seconddb'));

        // Direct storage inspection confirms neither instance crossed database keys.
        expect(firstStoredCosts.length).toBe(1);
        expect(firstStoredCosts[0].description).toBe('apple');
        expect(secondStoredCosts.length).toBe(1);
        expect(secondStoredCosts[0].description).toBe('fuel');
    });

    // A mixed-currency period verifies conversion at the report-total boundary.
    test('getReport converts and totals costs using retained active rates', () => {
        const costsDb = db.openCostsDB('exchangedb', 1);
        costsDb.addCost({ sum: 100, currency: 'USD', category: 'TEST', description: 'desc1' });
        costsDb.addCost({ sum: 340, currency: 'ILS', category: 'TEST', description: 'desc2' });

        // DB conversion reads the manager snapshot without Fetch or explicit rate passing.
        const report = costsDb.getReport('EURO');
        expect(report.total.currency).toBe('EURO');
        expect(report.total.sum).toBeCloseTo(148);
    });

    // Repeated reports reuse the retained snapshot instead of performing new requests.
    test('separate getReport calls reuse active rates without Fetch', () => {
        const costsDb = db.openCostsDB('dynamicdb', 1);
        costsDb.addCost({ sum: 100, currency: 'USD', category: 'TEST', description: 'desc' });

        // Both synchronous results use the same rates loaded during test setup.
        const firstReport = costsDb.getReport('ILS');
        const secondReport = costsDb.getReport('ILS');
        expect(firstReport.total.sum).toBeCloseTo(400);
        expect(secondReport.total.sum).toBeCloseTo(400);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // Replacement loading must not interrupt synchronous reports backed by valid memory.
    test('getReport keeps using valid rates while replacement loading is pending', async () => {
        let resolveReplacement;
        const replacementFetch = new Promise((resolve) => {
            resolveReplacement = resolve;
        });
        // The deferred Fetch keeps the replacement unresolved during the first report call.
        global.fetch.mockReturnValueOnce(replacementFetch);
        const replacementLoad = exchangeRateManager.setRatesUrl('https://example.com/rates.json');
        const costsDb = db.openCostsDB('pendingdb', 1);
        costsDb.addCost({ sum: 40, currency: 'ILS', category: 'Food', description: 'Lunch' });

        // The pending replacement cannot make the synchronous report temporarily unavailable.
        expect(costsDb.getReport('USD').total.sum).toBe(10);
        resolveReplacement({
            ok: true,
            json: async () => ({ USD: 1, ILS: 5, GBP: 0.6, EURO: 0.9 })
        });
        await replacementLoad;

        // The next synchronous call uses the newly activated valid snapshot.
        expect(costsDb.getReport('USD').total.sum).toBe(8);
    });

    // Report conversion must never mutate the original values copied into individual cost rows.
    test('getReport preserves original cost values after converting the total', () => {
        const costsDb = db.openCostsDB('testdb', 1);
        costsDb.addCost({ sum: 100, currency: 'ILS', category: 'TEST', description: 'test1' });
        const report = costsDb.getReport('USD');

        // Conversion changes the total only, never the cost values copied into the report.
        expect(report.total.sum).toBe(25);
        expect(report.costs[0].sum).toBe(100);
        expect(report.costs[0].currency).toBe('ILS');
    });
});
