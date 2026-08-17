import db from '../js/db.module.js';

describe('db.js logic', () => {
    // Clear the localStorage before each run to ensure isolated testing.
    beforeEach(() => {
        localStorage.clear();
    });

    test('openCostsDB returns an object with addCost and getReport methods', () => {
        const ob = db.openCostsDB('testdb', 1);
        
        // Assert the contract returns the expected API interface.
        expect(ob.addCost).toBeDefined();
        expect(typeof ob.addCost).toBe('function');
        expect(ob.getReport).toBeDefined();
        expect(typeof ob.getReport).toBe('function');
    });

    test('addCost adds a cost and returns the correct subset of properties', () => {
        const ob = db.openCostsDB('testdb', 1);
        const newCost = {
            sum: 200,
            currency: 'USD',
            category: 'FOOD',
            description: 'pizza'
        };

        const result = ob.addCost(newCost);
        
        // Ensure that date information and internal fields are not leaked in the return value.
        expect(result).toEqual({
            sum: 200,
            currency: 'USD',
            category: 'FOOD',
            description: 'pizza'
        });

        const storedData = JSON.parse(localStorage.getItem('costsdb_testdb'));
        // Verify internal storage contains the full date necessary for filtering.
        expect(storedData.length).toBe(1);
        expect(storedData[0].date.day).toBeDefined();
        expect(storedData[0].date.month).toBeDefined();
        expect(storedData[0].date.year).toBeDefined();
    });

    test('getReport returns current month data matching the required contract when dates are omitted', () => {
        const ob = db.openCostsDB('testdb', 1);
        ob.addCost({ sum: 300, currency: 'USD', category: 'CAR', description: 'fuel' });

        // Retrieve report relying on internal fallback to the current date.
        const report = ob.getReport('USD');
        
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1;

        // Verify top-level report properties and structure constraints.
        expect(report.year).toBe(currentYear);
        expect(report.month).toBe(currentMonth);
        expect(report.costs.length).toBe(1);
        
        // Ensure returned items only contain the day property in the date object.
        expect(report.costs[0].date).toEqual({ day: today.getDate() });
        // Ensure month and year fields are hidden from the returned report.
        expect(report.costs[0].date.month).toBeUndefined();
        expect(report.total.currency).toBe('USD');
        expect(report.total.sum).toBe(300);
    });

    test('getReport accurately filters by specific year and month', () => {
        const ob = db.openCostsDB('testdb', 1);
        ob.addCost({ sum: 100, currency: 'USD', category: 'TEST', description: 'test1' });
        
        // Seed past data directly to simulate older entries in storage.
        const pastCost = {
            sum: 50,
            currency: 'USD',
            category: 'PAST',
            description: 'past1',
            date: { day: 1, month: 5, year: 2020 }
        };
        const currentData = JSON.parse(localStorage.getItem('costsdb_testdb'));
        currentData.push(pastCost);
        localStorage.setItem('costsdb_testdb', JSON.stringify(currentData));

        // Request a historical report and verify correct record extraction.
        const report = ob.getReport('USD', 2020, 5);
        expect(report.costs.length).toBe(1);
        expect(report.costs[0].description).toBe('past1');
        expect(report.total.sum).toBe(50);
        // Again verify the date omission for historical data outputs.
        expect(report.costs[0].date).toEqual({ day: 1 });
        expect(report.costs[0].date.month).toBeUndefined();
    });

    test('maintains isolation between multiple databases', () => {
        // Open first database and add a cost.
        const db1 = db.openCostsDB('firstdb', 1);
        db1.addCost({ sum: 100, currency: 'USD', category: 'FOOD', description: 'apple' });

        // Open second database and add a different cost.
        const db2 = db.openCostsDB('seconddb', 1);
        db2.addCost({ sum: 200, currency: 'USD', category: 'CAR', description: 'fuel' });

        // Retrieve report from the second database specifically.
        const report = db2.getReport('USD');

        // Verify the report only contains data from the second database.
        expect(report.costs.length).toBe(1);
        expect(report.costs[0].description).toBe('fuel');
        expect(report.total.sum).toBe(200);

        // Verify isolation directly in localStorage as well.
        const firstDbData = JSON.parse(localStorage.getItem('costsdb_firstdb'));
        const secondDbData = JSON.parse(localStorage.getItem('costsdb_seconddb'));
        expect(firstDbData.length).toBe(1);
        expect(firstDbData[0].description).toBe('apple');
        expect(secondDbData.length).toBe(1);
        expect(secondDbData[0].description).toBe('fuel');
    });

    test('opens two database objects simultaneously and verifies independent reading/writing', () => {
        const dbA = db.openCostsDB('dbA', 1);
        const dbB = db.openCostsDB('dbB', 1);

        dbA.addCost({ sum: 10, currency: 'USD', category: 'A', description: 'descA' });
        dbB.addCost({ sum: 20, currency: 'USD', category: 'B', description: 'descB' });

        // Generate reports from both db instances independently
        const reportA = dbA.getReport('USD');
        const reportB = dbB.getReport('USD');

        // Each instance should only access its own distinct storage
        expect(reportA.costs.length).toBe(1);
        expect(reportA.costs[0].description).toBe('descA');
        expect(reportA.total.sum).toBe(10);
        
        expect(reportB.costs.length).toBe(1);
        expect(reportB.costs[0].description).toBe('descB');
        expect(reportB.total.sum).toBe(20);
    });
});
