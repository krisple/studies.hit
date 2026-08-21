import { jest } from '@jest/globals';
import {
    aggregateCostsByCategory,
    buildAnnualChartData,
    buildDetailedReportView,
    // Both chart transformation exports are tested without a Chart.js dependency.
    buildPieChartData,
    monthLabels
} from '../js/report-data.js';

const rates = { USD: 1, ILS: 4, GBP: 0.5, EURO: 0.8 };

// Report transformations are verified independently from DOM and Chart.js behavior.
describe('report and chart data transformations', () => {
    test('detailed report rows convert display amounts and preserve original cost values', () => {
        // Report-level period metadata combines with the item-level day for display.
        const report = {
            year: 2026,
            month: 5,
            costs: [{
                sum: 80,
                currency: 'ILS',
                category: 'Food',
                // Descriptive and date fields must pass through into the display row.
                description: 'Groceries',
                // Public reports expose only the insertion day on each cost.
                date: { day: 12 }
            }],
            total: { currency: 'USD', sum: 20 }
        };

        const reportView = buildDetailedReportView(report, 'USD', rates);

        // Conversion is added to the view while the report object remains unchanged.
        expect(reportView.rows[0]).toEqual({
            date: { year: 2026, month: 5, day: 12 },
            category: 'Food',
            description: 'Groceries',
            originalSum: 80,
            originalCurrency: 'ILS',
            // The selected-currency amount is calculated only for display.
            convertedSum: 20,
            targetCurrency: 'USD'
        });
        expect(reportView.total).toBe(20);
        expect(report.costs[0].sum).toBe(80);
        expect(report.costs[0].currency).toBe('ILS');
    });

    // Grouping is checked independently from the later labels-and-values transformation.
    test('category aggregation combines converted totals and does not mutate costs', () => {
        // Mixed currencies and a repeated category expose both conversion and grouping errors.
        const costs = [
            { sum: 40, currency: 'ILS', category: 'Food' },
            { sum: 5, currency: 'USD', category: 'Education' },
            // A repeated category must be merged after its own currency conversion.
            { sum: 10, currency: 'USD', category: 'Food' }
        ];
        const originalCosts = JSON.parse(JSON.stringify(costs));

        const categoryTotals = aggregateCostsByCategory(costs, 'USD', rates);

        // Stable alphabetical categories align with the chart labels and numeric values.
        expect(categoryTotals).toEqual([
            { category: 'Education', total: 5 },
            { category: 'Food', total: 20 }
        ]);
        expect(costs).toEqual(originalCosts);
    });

    test('pie chart transformation separates category labels from converted values', () => {
        // Two distinct categories make label order and converted value alignment observable.
        const costs = [
            { sum: 1, currency: 'GBP', category: 'Travel' },
            { sum: 8, currency: 'ILS', category: 'Food' }
        ];

        // GBP 0.5 and ILS 4 are both normalized through the documented USD base.
        expect(buildPieChartData(costs, 'USD', rates)).toEqual({
            labels: ['Food', 'Travel'],
            values: [2, 2]
        });
    });

    test('annual chart requests every month with the synchronous DB signature', () => {
        const costsDb = {
            // The mock total uses month so omitted or duplicated report requests remain visible.
            getReport: jest.fn((currency, year, month) => {
                // The fixture makes each month observable in the final ordered totals.
                return { total: { currency, sum: month } };
            })
        };

        const annualData = buildAnnualChartData(costsDb, 2026, 'USD');

        expect(costsDb.getReport).toHaveBeenCalledTimes(12);
        expect(annualData.labels).toEqual(monthLabels);
        expect(annualData.values).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

        // Every call uses exactly the original three report arguments.
        costsDb.getReport.mock.calls.forEach((reportCall, monthIndex) => {
            expect(reportCall).toEqual(['USD', 2026, monthIndex + 1]);
        });
    });
});
