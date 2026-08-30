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
    // The complete monthly selection fixture includes all months and a real submit control.
    form.innerHTML = [
        '<select name="month">',
        '<option value="1">Jan</option><option value="2">Feb</option><option value="3">Mar</option>',
        '<option value="4">Apr</option><option value="5">May</option><option value="6">Jun</option>',
        '<option value="7">Jul</option><option value="8">Aug</option><option value="9">Sep</option>',
        '<option value="10">Oct</option><option value="11">Nov</option><option value="12">Dec</option>',
        '</select>',
        // Build the test fixture required for this scenario.
        '<input name="year" type="number">',
        '<select name="currency"><option value="USD">USD</option><option value="ILS">ILS</option></select>',
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
        // Explicit dependencies mirror the application output, dialog, row, and total nodes.
        const reportElements = {
            form,
            statusElement: document.createElement('p'),
            emptyElement: document.createElement('div'),
            outputElement: document.createElement('div'),
            ...createDescriptionDialogElements(),
            // Build the test fixture required for this scenario.
            tableBody: document.createElement('tbody'),
            totalElement: document.createElement('strong')
        };
        // The synchronous DB mock calculates totals from the current shared rate source.
        const costsDb = {
            // Configure the valid baseline state before exercising the targeted case.
            getReport: jest.fn((currency, year, month) => ({
                year,
                month,
                costs: [{ sum: 40, currency: 'ILS', category: 'Food', description: 'Lunch', date: { day: 8 } }],
                total: { currency, sum: 40 / exchangeRateManager.getRates().ILS }
            }))
        };

        // Explicit selection values represent one requested monthly report operation.
        const detailedReportPanel = initializeDetailedReportPanel(reportElements, costsDb);
        form.elements.month.value = '5';
        form.elements.year.value = '2026';
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

        // Report calls use only currency, year, and month while rows retain original values.
        expect(costsDb.getReport).toHaveBeenLastCalledWith('USD', 2026, 5);
        expect(reportElements.tableBody.textContent).toContain('2026-05-08');
        expect(reportElements.tableBody.querySelector('tr').children).toHaveLength(4);
        expect(reportElements.tableBody.textContent).toContain('40.00 ILS');
        expect(reportElements.tableBody.textContent).not.toContain('10.00 USD');
        // The aggregate remains the only value displayed in the requested currency.
        expect(reportElements.totalElement.textContent).toBe('10.00 USD');
        expect(reportElements.statusElement.textContent).toBe('');
        expect(reportElements.statusElement.dataset.state).toBeUndefined();

        // A manager refresh alone must not mutate the report already rendered in the DOM.
        global.fetch.mockResolvedValueOnce({ ok: true, json: async () => secondRates });
        await exchangeRateManager.setRatesUrl('https://example.com/new-rates.json');
        expect(reportElements.tableBody.textContent).toContain('40.00 ILS');
        expect(reportElements.tableBody.textContent).not.toContain('10.00 USD');
        expect(reportElements.totalElement.textContent).toBe('10.00 USD');
        expect(costsDb.getReport).toHaveBeenCalledTimes(1);

        // An explicit Settings callback refreshes the displayed report with active rates.
        detailedReportPanel.refreshIfDisplayed();
        expect(costsDb.getReport).toHaveBeenCalledTimes(2);
        expect(reportElements.tableBody.textContent).toContain('40.00 ILS');
        expect(reportElements.tableBody.textContent).not.toContain('8.00 USD');
        expect(reportElements.totalElement.textContent).toBe('8.00 USD');

        // A later submission reuses the same snapshot without starting another Fetch.
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        expect(costsDb.getReport).toHaveBeenCalledTimes(3);
        expect(reportElements.tableBody.textContent).toContain('40.00 ILS');
        expect(reportElements.tableBody.textContent).not.toContain('8.00 USD');
        expect(reportElements.totalElement.textContent).toBe('8.00 USD');
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    // A guarded refresh must remain inert until the user creates the first report.
    test('an explicit rates change does not create a report before one is displayed', () => {
        const form = createMonthlyForm('detailed-report-form');
        // The guarded refresh uses the same complete dependency shape as production.
        const reportElements = {
            form,
            statusElement: document.createElement('p'),
            emptyElement: document.createElement('div'),
            outputElement: document.createElement('div'),
            ...createDescriptionDialogElements(),
            // Build the test fixture required for this scenario.
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
        // Explicit dependencies include the row and total nodes used by production rendering.
        const reportElements = {
            form,
            statusElement: document.createElement('p'),
            emptyElement: document.createElement('div'),
            outputElement: document.createElement('div'),
            ...createDescriptionDialogElements(),
            // Build the test fixture required for this scenario.
            tableBody: document.createElement('tbody'),
            totalElement: document.createElement('strong')
        };
        // Repetition creates text well beyond the chosen eighty-character preview boundary.
        const longDescription = 'A deliberately long cost description '.repeat(5).trim();
        // Identity currency keeps this test focused entirely on report presentation.
        const costsDb = {
            // Configure the valid baseline state before exercising the targeted case.
            getReport: jest.fn((currency, year, month) => ({
                year,
                month,
                costs: [{ sum: 12, currency, category: 'Food', description: longDescription, date: { day: 9 } }],
                total: { currency, sum: 12 }
            }))
        };

        // Execute the operation under the configured test conditions.
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
        // Two matching categories must collapse into one converted slice.
        const costsDb = {
            // Configure the valid baseline state before exercising the targeted case.
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
        // Month-number totals make ordering across all twelve calls directly observable.
        const costsDb = {
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
        // Stable empty totals isolate refresh eligibility from annual calculations.
        const costsDb = {
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
