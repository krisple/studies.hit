import { readAnnualSelection, setDefaultPeriodSelection } from './period-selection.js';
import { buildAnnualChartData } from './report-data.js';

// Bar operation feedback is scoped to its own accessible live region.
function showBarStatus(statusElement, message, state) {
    statusElement.textContent = message;
    statusElement.dataset.state = state;
}

// The chart loads immediately and every selection change starts a new annual operation.
export function initializeBarChartPanel(chartElements, costsDb, chartRenderer) {
    setDefaultPeriodSelection(chartElements.form);

    function updateBarChart() {
        showBarStatus(chartElements.statusElement, 'Creating chart…', 'pending');

        // Each update reads the latest retained rates through synchronous DB reports.
        try {
            const selection = readAnnualSelection(chartElements.form);

            // The annual transformation makes all twelve calls without any Fetch operation.
            const chartData = buildAnnualChartData(costsDb, selection.year, selection.currency);

            // Rendering replaces the previous chart only when this is still the newest update.
            chartRenderer.render(chartData, selection.currency);
            showBarStatus(chartElements.statusElement, 'Bar chart updated.', 'success');
        } catch (error) {
            // Failed synchronous updates clear a chart that no longer matches its controls.
            chartRenderer.clear();
            showBarStatus(chartElements.statusElement, error.message, 'error');
        }
    }

    // Form submission is still prevented if the user presses Enter in the year input.
    function handleBarSubmit(event) {
        event.preventDefault();
        updateBarChart();
    }

    // An annual chart needs refreshing when it includes the newly changed current month.
    function refreshIfCurrentPeriod(today = new Date()) {
        const selectedYear = Number(chartElements.form.elements.namedItem('year').value);
        const isCurrentYear = selectedYear === today.getFullYear();

        if (isCurrentYear) {
            updateBarChart();
        }
    }

    // Change covers the currency select and year field after a new value is committed.
    chartElements.form.addEventListener('change', updateBarChart);
    chartElements.form.addEventListener('submit', handleBarSubmit);
    // Initial execution makes the current-year chart visible without user interaction.
    updateBarChart();
    return { update: updateBarChart, refreshIfCurrentPeriod };
}
