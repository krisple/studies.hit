import { jest } from '@jest/globals';
import { initializeBarChartPanel } from '../js/bar-chart-panel.js';
import { initializeDetailedReportPanel } from '../js/detailed-report-panel.js';
import { initializePieChartPanel } from '../js/pie-chart-panel.js';
import { exchangeRateManager } from '../js/exchange-rate-manager.js';

const firstRates = { USD: 1, ILS: 4, GBP: 0.5, EURO: 0.8 };
const secondRates = { USD: 1, ILS: 5, GBP: 0.6, EURO: 0.9 };

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
        // A real submit control supports the Detailed Report form submission fixture.
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

// The report fixture mirrors the reusable production dialog and its mutable child nodes.
function createDescriptionDialogElements() {
    const dialogElement = document.createElement('dialog');
    const dialogTextElement = document.createElement('p');
    const dialogCloseButton = document.createElement('button');
    dialogCloseButton.type = 'button';

    // Appending the fixture enables focus restoration and the dialog open-state property.
    dialogElement.append(dialogCloseButton, dialogTextElement);
    document.body.append(dialogElement);
    return { dialogElement, dialogTextElement, dialogCloseButton };
}

// Panel setup loads one shared snapshot before exercising synchronous UI operations.
describe('report and chart operations', () => {
    beforeEach(async () => {
        document.body.replaceChildren();
        global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => firstRates });
        await exchangeRateManager.setRatesUrl('rates.json');
    });

    // Repeated submissions prove the panel stays synchronous and never owns rate fetching.
    test('detailed report changes rates only when the user generates it again', async () => {
        const form = createMonthlyForm('detailed-report-form');
        // The panel receives explicit DOM dependencies, matching the application wiring contract.
        const reportElements = {
            form,
            statusElement: document.createElement('p'),
            emptyElement: document.createElement('div'),
            // The output host and dialog mirror the nodes passed by application orchestration.
            outputElement: document.createElement('div'),
            ...createDescriptionDialogElements(),
            tableBody: document.createElement('tbody'),
            // The total is updated independently from the row collection.
            totalElement: document.createElement('strong')
        };
        // The DB mock exposes only the clarified synchronous report contract.
        const costsDb = {
            getReport: jest.fn((currency, year, month) => ({
                year,
                month,
                costs: [{ sum: 40, currency: 'ILS', category: 'Food', description: 'Lunch', date: { day: 8 } }],
                // The mock mirrors DB totals by reading the current shared source internally.
                total: { currency, sum: 40 / exchangeRateManager.getRates().ILS }
            }))
        };

        // Explicit selection values represent one requested monthly report operation.
        const detailedReportPanel = initializeDetailedReportPanel(reportElements, costsDb);
        form.elements.month.value = '5';
        form.elements.year.value = '2026';
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

        // Report calls use only currency, year, and month while rows use manager rates.
        expect(costsDb.getReport).toHaveBeenLastCalledWith('USD', 2026, 5);
        expect(reportElements.tableBody.textContent).toContain('2026-05-08');
        expect(reportElements.tableBody.textContent).toContain('40.00 ILS');
        expect(reportElements.tableBody.textContent).toContain('10.00 USD');
        expect(reportElements.totalElement.textContent).toBe('10.00 USD');
        expect(reportElements.statusElement.textContent).toBe('');
        expect(reportElements.statusElement.dataset.state).toBeUndefined();

        // A manager refresh alone must not mutate the report already rendered in the DOM.
        global.fetch.mockResolvedValueOnce({ ok: true, json: async () => secondRates });
        await exchangeRateManager.setRatesUrl('https://example.com/new-rates.json');
        expect(reportElements.tableBody.textContent).toContain('10.00 USD');
        expect(reportElements.totalElement.textContent).toBe('10.00 USD');
        expect(costsDb.getReport).toHaveBeenCalledTimes(1);

        // An explicit Settings callback refreshes the displayed report with active rates.
        detailedReportPanel.refreshIfDisplayed();
        expect(costsDb.getReport).toHaveBeenCalledTimes(2);
        expect(reportElements.tableBody.textContent).toContain('8.00 USD');
        expect(reportElements.totalElement.textContent).toBe('8.00 USD');

        // A later user submission remains an independent request using the same snapshot.
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        expect(costsDb.getReport).toHaveBeenCalledTimes(3);
        expect(reportElements.tableBody.textContent).toContain('8.00 USD');
        expect(reportElements.totalElement.textContent).toBe('8.00 USD');
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    test('an explicit rates change does not create a report before one is displayed', () => {
        const form = createMonthlyForm('detailed-report-form');
        const reportElements = {
            form,
            statusElement: document.createElement('p'),
            emptyElement: document.createElement('div'),
            // The guarded refresh uses the same complete dependency shape as production.
            outputElement: document.createElement('div'),
            ...createDescriptionDialogElements(),
            tableBody: document.createElement('tbody'),
            totalElement: document.createElement('strong')
        };
        const costsDb = { getReport: jest.fn() };
        const detailedReportPanel = initializeDetailedReportPanel(reportElements, costsDb);

        // Settings must leave the untouched initial report prompt unchanged.
        detailedReportPanel.refreshIfDisplayed();
        expect(costsDb.getReport).not.toHaveBeenCalled();
        expect(reportElements.statusElement.textContent).toBe('');
    });

    // Description disclosure is a report-only presentation behavior with no DB shape changes.
    test('long report descriptions open from a bounded and clearly labeled preview', () => {
        const form = createMonthlyForm('detailed-report-form');
        // Explicit element injection keeps the panel independent from document queries.
        const reportElements = {
            form,
            statusElement: document.createElement('p'),
            emptyElement: document.createElement('div'),
            outputElement: document.createElement('div'),
            ...createDescriptionDialogElements(),
            // Row and total nodes receive the same rendered content as the production table.
            tableBody: document.createElement('tbody'),
            totalElement: document.createElement('strong')
        };
        // Repetition creates text well beyond the chosen eighty-character preview boundary.
        const longDescription = 'A deliberately long cost description '.repeat(5).trim();
        const costsDb = {
            getReport: jest.fn((currency, year, month) => ({
                year,
                month,
                costs: [{ sum: 12, currency, category: 'Food', description: longDescription, date: { day: 9 } }],
                // Identity currency keeps this test focused entirely on report presentation.
                total: { currency, sum: 12 }
            }))
        };

        initializeDetailedReportPanel(reportElements, costsDb);
        form.elements.month.value = '5';
        form.elements.year.value = '2026';
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

        // The table exposes an explicit action but omits the unbounded full description.
        const previewButton = reportElements.tableBody.querySelector('.description-preview-button');
        expect(previewButton.textContent).toContain('View full description');
        expect(reportElements.tableBody.textContent).not.toContain(longDescription);
        previewButton.click();

        // The dialog receives the exact stored text and its close button dismisses the overlay.
        expect(reportElements.dialogTextElement.textContent).toBe(longDescription);
        expect(reportElements.dialogElement.open).toBe(true);
        reportElements.dialogCloseButton.click();
        expect(reportElements.dialogElement.open).toBe(false);
    });

    test('pie chart loads immediately and updates automatically after a selection change', () => {
        // Renderer injection isolates orchestration and aggregation from canvas behavior.
        const chartElements = createChartElements('pie-chart-form');
        const chartRenderer = { render: jest.fn(), clear: jest.fn() };
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
        initializePieChartPanel(chartElements, costsDb, chartRenderer);
        expect(chartRenderer.render).toHaveBeenCalledTimes(1);
        expect(chartElements.statusElement.textContent).toBe('');
        expect(chartElements.statusElement.dataset.state).toBeUndefined();

        // Clear initial-load observations before exercising one automatic change update.
        costsDb.getReport.mockClear();
        chartRenderer.render.mockClear();
        chartElements.form.elements.month.value = '5';
        chartElements.form.elements.year.value = '2025';
        chartElements.form.dispatchEvent(new Event('change', { bubbles: true }));

        // One selection change performs a three-argument report call and one render.
        expect(costsDb.getReport).toHaveBeenCalledWith('USD', 2025, 5);
        expect(chartRenderer.render).toHaveBeenCalledWith({ labels: ['Food'], values: [15] }, 'USD');
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // Added-cost refresh eligibility is independent from manual selection-change behavior.
    test('pie chart refreshes added costs only for its current-month selection', () => {
        const chartElements = createChartElements('pie-chart-form');
        const chartRenderer = { render: jest.fn(), clear: jest.fn() };
        const costsDb = { getReport: jest.fn(() => ({ costs: [] })) };
        const pieChartPanel = initializePieChartPanel(chartElements, costsDb, chartRenderer);
        const today = new Date(2026, 4, 10);

        // The current month and year should trigger one new report and render.
        costsDb.getReport.mockClear();
        chartRenderer.render.mockClear();
        chartElements.form.elements.month.value = '5';
        chartElements.form.elements.year.value = '2026';
        pieChartPanel.refreshIfCurrentPeriod(today);
        expect(costsDb.getReport).toHaveBeenCalledTimes(1);

        // A historical month remains unchanged after a newly added current cost.
        costsDb.getReport.mockClear();
        chartElements.form.elements.month.value = '4';
        pieChartPanel.refreshIfCurrentPeriod(today);
        expect(costsDb.getReport).not.toHaveBeenCalled();
    });

    test('bar chart loads immediately and updates all twelve months after a selection change', () => {
        // Removing month converts the shared monthly fixture into the production annual shape.
        const chartElements = createChartElements('bar-chart-form');
        chartElements.form.elements.namedItem('month').remove();
        const chartRenderer = { render: jest.fn(), clear: jest.fn() };
        const costsDb = {
            // Month-number totals make ordering across all twelve calls directly observable.
            getReport: jest.fn((currency, year, month) => ({
                total: { currency, sum: month }
            }))
        };

        // Initialization creates the twelve-month chart from the current year defaults.
        initializeBarChartPanel(chartElements, costsDb, chartRenderer);
        expect(costsDb.getReport).toHaveBeenCalledTimes(12);
        expect(chartElements.statusElement.textContent).toBe('');
        expect(chartElements.statusElement.dataset.state).toBeUndefined();

        // Clear initial-load observations before exercising one automatic year update.
        costsDb.getReport.mockClear();
        chartRenderer.render.mockClear();
        chartElements.form.elements.year.value = '2024';
        chartElements.form.dispatchEvent(new Event('change', { bubbles: true }));

        // DB call arguments distinguish the clarified contract from explicit rate passing.
        expect(costsDb.getReport).toHaveBeenCalledTimes(12);
        costsDb.getReport.mock.calls.forEach((reportCall, monthIndex) => {
            // Every monthly report call contains exactly the clarified three arguments.
            expect(reportCall).toEqual(['USD', 2024, monthIndex + 1]);
        });
        expect(chartRenderer.render.mock.calls[0][0].values).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // The annual chart uses current-year membership as its current-month eligibility check.
    test('bar chart refreshes added costs only when it includes the current year', () => {
        const chartElements = createChartElements('bar-chart-form');
        chartElements.form.elements.namedItem('month').remove();
        const chartRenderer = { render: jest.fn(), clear: jest.fn() };
        const costsDb = {
            // Stable empty totals isolate refresh eligibility from annual calculations.
            getReport: jest.fn((currency) => ({ total: { currency, sum: 0 } }))
        };
        const barChartPanel = initializeBarChartPanel(chartElements, costsDb, chartRenderer);
        const today = new Date(2026, 4, 10);

        // The current year contains the changed month and requires twelve fresh totals.
        costsDb.getReport.mockClear();
        chartElements.form.elements.year.value = '2026';
        barChartPanel.refreshIfCurrentPeriod(today);
        expect(costsDb.getReport).toHaveBeenCalledTimes(12);

        // A historical annual chart must remain untouched by a current-month addition.
        costsDb.getReport.mockClear();
        chartElements.form.elements.year.value = '2025';
        barChartPanel.refreshIfCurrentPeriod(today);
        expect(costsDb.getReport).not.toHaveBeenCalled();
    });
});
