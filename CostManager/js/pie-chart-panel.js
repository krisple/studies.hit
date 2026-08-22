import { readMonthlySelection, setDefaultPeriodSelection } from './period-selection.js';
import { buildPieChartData } from './report-data.js';
import { exchangeRateManager } from './exchange-rate-manager.js';

// Pie operation status shares one live region without storing any calculation state.
function showPieStatus(statusElement, message, state) {
    statusElement.textContent = message;
    statusElement.dataset.state = state;
}

// The chart loads immediately and every selection change starts a new update operation.
export function initializePieChartPanel(chartElements, costsDb, chartRenderer) {
    setDefaultPeriodSelection(chartElements.form);

    function updatePieChart() {
        showPieStatus(chartElements.statusElement, 'Creating chart…', 'pending');

        // Each update reads the latest retained rates through synchronous business logic.
        try {
            const selection = readMonthlySelection(chartElements.form);
            const report = costsDb.getReport(selection.currency, selection.year, selection.month);
            const hasCurrencyConversion = report.costs.some((cost) => cost.currency !== selection.currency);

            // Pure aggregation receives rates only when at least one cost needs conversion.
            const rates = hasCurrencyConversion ? exchangeRateManager.getRates() : null;
            const chartData = buildPieChartData(report.costs, selection.currency, rates);

            // Rendering replaces the previous chart only when this is still the newest update.
            chartRenderer.render(chartData, selection.currency);
            if (chartData.values.length > 0) {
                // A visible chart is sufficient success feedback without redundant text.
                chartElements.statusElement.textContent = '';
                delete chartElements.statusElement.dataset.state;
            } else {
                showPieStatus(chartElements.statusElement, 'No costs were found for the selected month.', 'success');
            }
        } catch (error) {
            // Failed synchronous updates clear a chart that no longer matches its controls.
            chartRenderer.clear();
            showPieStatus(chartElements.statusElement, error.message, 'error');
        }
    }

    // Form submission is still prevented if the user presses Enter in the year input.
    function handlePieSubmit(event) {
        event.preventDefault();
        updatePieChart();
    }

    // Added costs affect this chart only while it displays the current calendar month.
    function refreshIfCurrentPeriod(today = new Date()) {
        const selectedYear = Number(chartElements.form.elements.namedItem('year').value);
        const selectedMonth = Number(chartElements.form.elements.namedItem('month').value);
        const isCurrentPeriod = selectedYear === today.getFullYear() && selectedMonth === today.getMonth() + 1;

        // Historical selections stay visually stable when current-month storage changes.
        if (isCurrentPeriod) {
            updatePieChart();
        }
    }

    // Change covers selects and the year field once its edited value is committed.
    chartElements.form.addEventListener('change', updatePieChart);
    chartElements.form.addEventListener('submit', handlePieSubmit);
    // Initial execution makes the default-period chart visible without user interaction.
    updatePieChart();
    return { update: updatePieChart, refreshIfCurrentPeriod };
}
