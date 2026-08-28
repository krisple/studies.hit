// Extra colors prevent category reuse for the common multi-category case.
const chartColors = [
    '#195f43', '#d6ef7f', '#e7a94d', '#4d7ea8', '#8f6bb3', '#d66a5e',
    '#5b9b78', '#c982a6', '#7a8b52', '#5d6f87', '#bd7b4d', '#7c6f64'
];

// Chart constructors are checked at render time so the rest of the application stays usable.
function requireChartConstructor(chartConstructor) {
    if (typeof chartConstructor !== 'function') {
        throw new Error('Chart.js failed to load');
    }
}

// Tooltips format calculated values without changing the numeric dataset.
function formatTooltipAmount(context, currency) {
    const amount = Number(context.raw).toLocaleString('en-US', {
        maximumFractionDigits: 2
    });

    return `${amount} ${currency}`;
}

// A renderer owns only the chart attached to its canvas and destroys it before replacement.
function createChartRenderer(canvas, chartConstructor, createConfiguration) {
    let chartInstance = null;

    function clear() {
        if (chartInstance) {
            chartInstance.destroy();
            // Clearing the reference ensures a later clear cannot destroy it twice.
            chartInstance = null;
        }
    }

    function render(chartData, currency) {
        requireChartConstructor(chartConstructor);
        clear();

        // Chart-specific configuration is produced only from explicit render arguments.
        chartInstance = new chartConstructor(canvas, createConfiguration(chartData, currency));
    }

    return { render, clear };
}

// Pie configuration stays separate from category aggregation and exchange calculations.
function createPieConfiguration(chartData, currency) {
    const hasCosts = chartData.values.length > 0;
    const pieLabels = hasCosts ? chartData.labels : ['No costs'];
    const pieValues = hasCosts ? chartData.values : [1];

    // An empty period remains a visible neutral pie instead of a separate placeholder panel.
    const pieColors = hasCosts
        ? chartData.labels.map((label, index) => chartColors[index % chartColors.length])
        : ['#dce3da'];

    // Metadata and tooltips identify the selected currency while preserving raw values.
    return {
        type: 'pie',

        // Data contains the category labels and values used by the pie.
        data: {
            labels: pieLabels,
            datasets: [{
                label: `Costs in ${currency}`,
                data: pieValues,

                // Dataset styling distinguishes slices without affecting their numeric values.
                backgroundColor: pieColors,
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },

        // Rendering options control responsive sizing and plugin behavior.
        options: {
            responsive: true,
            maintainAspectRatio: false,

            plugins: {
                legend: {
                    display: hasCosts
                },

                // Tooltips hide empty-state UI and add the selected currency at display time.
                tooltip: {
                    enabled: hasCosts,
                    callbacks: { label: (context) => `${context.label}: ${formatTooltipAmount(context, currency)}` }
                }
            }
        }
        // Return the completed configuration without changing the source chart data.
    };
}

// Bar configuration always consumes the ordered twelve-month transformation.
function createBarConfiguration(chartData, currency) {
    return {
        type: 'bar',

        // Data preserves the January-to-December values produced by the annual transformation.
        data: {
            labels: chartData.labels,
            datasets: [{
                label: `Monthly costs in ${currency}`,
                data: chartData.values,

                // Dataset styling affects presentation only.
                backgroundColor: '#195f43',
                borderRadius: 6
            }]
        },

        // Rendering options keep monthly totals visually comparable.
        options: {
            responsive: true,
            maintainAspectRatio: false,

            // A zero-based Y axis preserves a meaningful comparison between months.
            scales: {
                y: { beginAtZero: true }
            },

            // Tooltip formatting adds the selected currency without altering raw data.
            plugins: {
                tooltip: {
                    callbacks: { label: (context) => formatTooltipAmount(context, currency) }
                }
            }
        }
        // Return the completed configuration without changing the source chart data.
    };
}

// Public factories bind one canvas to one chart type without sharing chart instances.
export function createPieChartRenderer(canvas, chartConstructor) {
    return createChartRenderer(canvas, chartConstructor, createPieConfiguration);
}

// The second factory uses the same lifecycle with the independent bar configuration.
export function createBarChartRenderer(canvas, chartConstructor) {
    return createChartRenderer(canvas, chartConstructor, createBarConfiguration);
}
