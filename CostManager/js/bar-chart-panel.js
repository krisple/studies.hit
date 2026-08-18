import { fetchConfiguredExchangeRates } from './rate-source.js';
import { readAnnualSelection, setDefaultPeriodSelection } from './period-selection.js';
import { buildAnnualChartData } from './report-data.js';

// Bar operation feedback is scoped to its own accessible live region.
function showBarStatus(statusElement, message, state) {
    statusElement.textContent = message;
    statusElement.dataset.state = state;
}

// The chart loads immediately and every selection change starts a new annual operation.
export function initializeBarChartPanel(chartElements, costsDb, chartRenderer, fetchRates = fetchConfiguredExchangeRates) {
    let latestOperationId = 0;
    setDefaultPeriodSelection(chartElements.form);

    async function updateBarChart() {
        latestOperationId += 1;
        const operationId = latestOperationId;
        showBarStatus(chartElements.statusElement, 'Loading chart…', 'pending');

        // Each update resolves the selected year and currency before requesting its rates.
        try {
            const selection = readAnnualSelection(chartElements.form);
            const rates = await fetchRates();

            // The annual transformation passes this operation's rates to all twelve DB calls.
            const chartData = buildAnnualChartData(costsDb, selection.year, selection.currency, rates);
            if (operationId !== latestOperationId) {
                return;
            }

            // Rendering replaces the previous chart only when this is still the newest update.
            chartRenderer.render(chartData, selection.currency);
            showBarStatus(chartElements.statusElement, 'Bar chart updated.', 'success');
        } catch (error) {
            // A superseded request must not replace feedback from a newer selection.
            if (operationId === latestOperationId) {
                showBarStatus(chartElements.statusElement, error.message, 'error');
            }
        }
    }

    // Form submission is still prevented if the user presses Enter in the year input.
    function handleBarSubmit(event) {
        event.preventDefault();
        void updateBarChart();
    }

    // Change covers the currency select and year field after a new value is committed.
    chartElements.form.addEventListener('change', updateBarChart);
    chartElements.form.addEventListener('submit', handleBarSubmit);
    // Initial execution makes the current-year chart visible without user interaction.
    void updateBarChart();
}
