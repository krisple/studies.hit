import { convertCurrency } from './exchange.js';

// Stable twelve-month labels keep annual chart output ordered from January through December.
export const monthLabels = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// Detailed rows add converted display amounts without changing report-owned values.
export function buildDetailedReportView(report, targetCurrency, rates) {
    const rows = report.costs.map((cost) => {
        const convertedSum = convertCurrency(cost.sum, cost.currency, targetCurrency, rates);

        // Rows combine the report-level period with stored and display-only values.
        return {
            date: {
                year: report.year,
                month: report.month,
                day: cost.date.day
            },

            // Stored values remain unchanged in the detailed report view.
            category: cost.category,
            description: cost.description,
            originalSum: cost.sum,
            originalCurrency: cost.currency,

            // Conversion fields are display-only and are never persisted.
            convertedSum,
            targetCurrency
        };
    });

    // The database report already calculated its total from the active retained snapshot.
    return {
        rows,
        total: report.total.sum,
        currency: report.total.currency
    };
}

// Category aggregation converts each original cost before adding it to its category total.
export function aggregateCostsByCategory(costs, targetCurrency, rates) {
    /* A Map groups totals by arbitrary category text without treating category names as
       object properties. The grouped entries are converted to a sorted array for charts. */
    const categoryTotals = new Map();

    costs.forEach((cost) => {
        const convertedSum = convertCurrency(cost.sum, cost.currency, targetCurrency, rates);
        const currentTotal = categoryTotals.get(cost.category) ?? 0;

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

    // Numeric totals remain unformatted so Chart.js receives calculation-ready values.
    return {
        labels: categoryTotals.map((categoryTotal) => categoryTotal.category),
        values: categoryTotals.map((categoryTotal) => categoryTotal.total)
    };
}

// Annual data uses twelve synchronous reports backed by the manager's retained snapshot.
export function buildAnnualChartData(costsDb, year, targetCurrency) {
    const values = monthLabels.map((monthLabel, monthIndex) => {
        const month = monthIndex + 1;
        const monthlyReport = costsDb.getReport(targetCurrency, year, month);

        // Only the converted monthly total is needed by the annual chart transformation.
        return monthlyReport.total.sum;
    });

    return {
        labels: [...monthLabels],
        values
    };
}
