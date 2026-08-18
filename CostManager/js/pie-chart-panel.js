import { fetchConfiguredExchangeRates } from './rate-source.js';
import { readMonthlySelection, setDefaultPeriodSelection } from './period-selection.js';
import { buildPieChartData } from './report-data.js';

// Pie operation status shares one live region without storing any calculation state.
function showPieStatus(statusElement, message, state) {
    statusElement.textContent = message;
    statusElement.dataset.state = state;
}

// The chart loads immediately and every selection change starts a new update operation.
export function initializePieChartPanel(chartElements, costsDb, chartRenderer, fetchRates = fetchConfiguredExchangeRates) {
    let latestOperationId = 0;
    setDefaultPeriodSelection(chartElements.form);

    async function updatePieChart() {
        latestOperationId += 1;
        const operationId = latestOperationId;
        showPieStatus(chartElements.statusElement, 'Loading chart…', 'pending');

        // Each update resolves the currently selected period before requesting its rates.
        try {
            const selection = readMonthlySelection(chartElements.form);
            const rates = await fetchRates();
            const report = costsDb.getReport(selection.currency, selection.year, selection.month, rates);

            // Aggregation converts original values only in the temporary chart data object.
            const chartData = buildPieChartData(report.costs, selection.currency, rates);
            if (operationId !== latestOperationId) {
                return;
            }

            // Rendering replaces the previous chart only when this is still the newest update.
            chartRenderer.render(chartData, selection.currency);
            const statusMessage = chartData.values.length > 0
                ? 'Pie chart updated.'
                : 'No costs were found for the selected month.';
            showPieStatus(chartElements.statusElement, statusMessage, 'success');
        } catch (error) {
            // A superseded request must not replace feedback from a newer selection.
            if (operationId === latestOperationId) {
                showPieStatus(chartElements.statusElement, error.message, 'error');
            }
        }
    }

    // Form submission is still prevented if the user presses Enter in the year input.
    function handlePieSubmit(event) {
        event.preventDefault();
        void updatePieChart();
    }

    // Change covers selects and the year field once its edited value is committed.
    chartElements.form.addEventListener('change', updatePieChart);
    chartElements.form.addEventListener('submit', handlePieSubmit);
    // Initial execution makes the default-period chart visible without user interaction.
    void updatePieChart();
}
