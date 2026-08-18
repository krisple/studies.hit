import { convertCurrency } from './exchange.js';

// Stable calendar labels keep annual chart output ordered from January through December.
export const monthLabels = [
    'January', 'February', 'March', 'April', 'May', 'June',
    // The second half completes the fixed twelve-month chart contract.
    'July', 'August', 'September', 'October', 'November', 'December'
];

// Detailed rows add a converted display amount without changing report-owned values.
export function buildDetailedReportView(report, targetCurrency, rates) {
    const rows = report.costs.map((cost) => {
        const convertedSum = convertCurrency(cost.sum, cost.currency, targetCurrency, rates);

        // Original values remain available beside the operation-scoped converted amount.
        return {
            day: cost.date.day,
            category: cost.category,
            description: cost.description,
            originalSum: cost.sum,
            originalCurrency: cost.currency,
            // The selected currency is display metadata and is never written to storage.
            convertedSum,
            targetCurrency
        };
    });

    // The database report already calculated its total with the same fetched rates object.
    return {
        rows,
        total: report.total.sum,
        currency: report.total.currency
    };
}

// Category aggregation converts each original cost before adding it to its category total.
export function aggregateCostsByCategory(costs, targetCurrency, rates) {
    const categoryTotals = new Map();

    costs.forEach((cost) => {
        const convertedSum = convertCurrency(cost.sum, cost.currency, targetCurrency, rates);
        const currentTotal = categoryTotals.get(cost.category) ?? 0;

        // Map keys preserve arbitrary category text without treating it as an object property.
        categoryTotals.set(cost.category, currentTotal + convertedSum);
    });

    // Alphabetical output keeps chart colors and labels stable across equivalent report data.
    return Array.from(categoryTotals, ([category, total]) => ({ category, total }))
        .sort((firstCategory, secondCategory) => {
            return firstCategory.category.localeCompare(secondCategory.category);
        });
}

// Pie chart data is kept free of Chart.js configuration and browser state.
export function buildPieChartData(costs, targetCurrency, rates) {
    const categoryTotals = aggregateCostsByCategory(costs, targetCurrency, rates);

    return {
        labels: categoryTotals.map((categoryTotal) => categoryTotal.category),
        // Numeric totals remain unformatted so Chart.js receives calculation-ready values.
        values: categoryTotals.map((categoryTotal) => categoryTotal.total)
    };
}

// One annual operation reuses its explicitly supplied rates across exactly twelve reports.
export function buildAnnualChartData(costsDb, year, targetCurrency, rates) {
    const values = monthLabels.map((monthLabel, monthIndex) => {
        const month = monthIndex + 1;
        const monthlyReport = costsDb.getReport(targetCurrency, year, month, rates);

        // Only the converted monthly total is needed by the annual chart transformation.
        return monthlyReport.total.sum;
    });

    return {
        labels: [...monthLabels],
        values
    };
}
