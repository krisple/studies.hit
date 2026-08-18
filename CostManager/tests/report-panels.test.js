import { jest } from '@jest/globals';
import { initializeBarChartPanel } from '../js/bar-chart-panel.js';
import { initializeDetailedReportPanel } from '../js/detailed-report-panel.js';
import { initializePieChartPanel } from '../js/pie-chart-panel.js';

const firstRates = { USD: 1, ILS: 4, GBP: 0.5, EURO: 0.8 };
const secondRates = { USD: 1, ILS: 5, GBP: 0.6, EURO: 0.9 };

// A task tick allows asynchronous submit handlers to complete after mocked Fetch resolution.
function waitForOperation() {
    return new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}

// Shared selection markup mirrors the named controls used by all production panels.
function createMonthlyForm(formId) {
    const form = document.createElement('form');
    form.id = formId;
    form.innerHTML = [
        // All months allow initialization to select the real current month in every test run.
        '<select name="month">',
        '<option value="1">Jan</option><option value="2">Feb</option><option value="3">Mar</option>',
        '<option value="4">Apr</option><option value="5">May</option><option value="6">Jun</option>',
        '<option value="7">Jul</option><option value="8">Aug</option><option value="9">Sep</option>',
        '<option value="10">Oct</option><option value="11">Nov</option><option value="12">Dec</option>',
        '</select>',
        // Year and currency complete the same named selection boundary as the production forms.
        '<input name="year" type="number">',
        '<select name="currency"><option value="USD">USD</option><option value="ILS">ILS</option></select>',
        // A real submit control exposes the disabled loading state used by the handler.
        '<button type="submit">Submit</button>'
    ].join('');
    document.body.append(form);
    return form;
}

// Chart fixtures provide only nodes and renderer methods owned by chart panel modules.
function createChartElements(formId) {
    const form = createMonthlyForm(formId);
    form.querySelector('button[type="submit"]').remove();
    const statusElement = document.createElement('p');
    const canvasContainer = document.createElement('div');

    // Appending the nodes gives visibility properties normal browser-backed behavior.
    document.body.append(statusElement, canvasContainer);
    return { form, statusElement, canvasContainer };
}

describe('report and chart operations', () => {
    beforeEach(() => {
        document.body.replaceChildren();
    });

    // The repeated submission in this case makes cross-operation rate retention observable.
    test('detailed report fetches fresh rates on every submit and renders converted rows', async () => {
        const form = createMonthlyForm('detailed-report-form');
        // The panel receives explicit DOM dependencies, matching the application wiring contract.
        const reportElements = {
            form,
            statusElement: document.createElement('p'),
            emptyElement: document.createElement('div'),
            outputElement: document.createElement('div'),
            tableBody: document.createElement('tbody'),
            // The total is updated independently from the row collection.
            totalElement: document.createElement('strong')
        };
        const fetchRates = jest.fn()
            .mockResolvedValueOnce(firstRates)
            .mockResolvedValueOnce(secondRates);
        // This DB mock derives totals from the exact rates object passed by the panel.
        const costsDb = {
            getReport: jest.fn((currency, year, month, rates) => ({
                costs: [{ sum: 40, currency: 'ILS', category: 'Food', description: 'Lunch', date: { day: 8 } }],
                // Different fetched rates produce visibly different totals across operations.
                total: { currency, sum: 40 / rates.ILS }
            }))
        };

        // Explicit selection values represent one requested monthly report operation.
        initializeDetailedReportPanel(reportElements, costsDb, fetchRates);
        form.elements.month.value = '5';
        form.elements.year.value = '2026';
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await waitForOperation();

        // First-operation assertions cover request arguments and both monetary columns.
        expect(fetchRates).toHaveBeenCalledTimes(1);
        expect(costsDb.getReport).toHaveBeenLastCalledWith('USD', 2026, 5, firstRates);
        expect(reportElements.tableBody.textContent).toContain('40.00 ILS');
        expect(reportElements.tableBody.textContent).toContain('10.00 USD');

        // A later submission must fetch again rather than retaining firstRates in the panel.
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await waitForOperation();
        expect(fetchRates).toHaveBeenCalledTimes(2);
        expect(costsDb.getReport).toHaveBeenLastCalledWith('USD', 2026, 5, secondRates);
        expect(reportElements.tableBody.textContent).toContain('8.00 USD');
    });

    test('pie chart loads immediately and updates automatically after a selection change', async () => {
        // Renderer injection isolates orchestration and aggregation from canvas behavior.
        const chartElements = createChartElements('pie-chart-form');
        const chartRenderer = { render: jest.fn(), clear: jest.fn() };
        const fetchRates = jest.fn().mockResolvedValue(firstRates);
        const costsDb = {
            // Two matching categories must collapse into one converted slice.
            getReport: jest.fn(() => ({
                costs: [
                    { sum: 40, currency: 'ILS', category: 'Food' },
                    { sum: 5, currency: 'USD', category: 'Food' }
                ]
            }))
        };

        // Initialization creates the chart immediately from the current period defaults.
        initializePieChartPanel(chartElements, costsDb, chartRenderer, fetchRates);
        await waitForOperation();
        expect(fetchRates).toHaveBeenCalledTimes(1);
        expect(chartRenderer.render).toHaveBeenCalledTimes(1);

        // Clear initial-load observations before exercising one automatic change update.
        fetchRates.mockClear();
        costsDb.getReport.mockClear();
        chartRenderer.render.mockClear();
        chartElements.form.elements.month.value = '5';
        chartElements.form.elements.year.value = '2025';
        chartElements.form.dispatchEvent(new Event('change', { bubbles: true }));
        await waitForOperation();

        // One selection change performs one rates lookup, report calculation, and render.
        expect(fetchRates).toHaveBeenCalledTimes(1);
        expect(costsDb.getReport).toHaveBeenCalledWith('USD', 2025, 5, firstRates);
        expect(chartRenderer.render).toHaveBeenCalledWith({ labels: ['Food'], values: [15] }, 'USD');
    });

    test('bar chart loads immediately and updates all twelve months after a selection change', async () => {
        // Removing month converts the shared monthly fixture into the production annual shape.
        const chartElements = createChartElements('bar-chart-form');
        chartElements.form.elements.namedItem('month').remove();
        const chartRenderer = { render: jest.fn(), clear: jest.fn() };
        const fetchRates = jest.fn().mockResolvedValue(firstRates);
        const costsDb = {
            // Month-number totals make ordering across all twelve calls directly observable.
            getReport: jest.fn((currency, year, month) => ({
                total: { currency, sum: month }
            }))
        };

        // Initialization creates the twelve-month chart from the current year defaults.
        initializeBarChartPanel(chartElements, costsDb, chartRenderer, fetchRates);
        await waitForOperation();
        expect(fetchRates).toHaveBeenCalledTimes(1);
        expect(costsDb.getReport).toHaveBeenCalledTimes(12);

        // Clear initial-load observations before exercising one automatic year update.
        fetchRates.mockClear();
        costsDb.getReport.mockClear();
        chartRenderer.render.mockClear();
        chartElements.form.elements.year.value = '2024';
        chartElements.form.dispatchEvent(new Event('change', { bubbles: true }));
        await waitForOperation();

        // Fetch and DB call counts distinguish operation-scoped reuse from per-month fetching.
        expect(fetchRates).toHaveBeenCalledTimes(1);
        expect(costsDb.getReport).toHaveBeenCalledTimes(12);
        costsDb.getReport.mock.calls.forEach((reportCall, monthIndex) => {
            // Identity comparison proves that no second fetch occurs inside monthly aggregation.
            expect(reportCall).toEqual(['USD', 2024, monthIndex + 1, firstRates]);
        });
        expect(chartRenderer.render.mock.calls[0][0].values).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });
});
