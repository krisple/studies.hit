const chartColors = [
    '#195f43', '#d6ef7f', '#e7a94d', '#4d7ea8', '#8f6bb3', '#d66a5e',
    // Extra colors prevent category reuse for the common multi-category case.
    '#5b9b78', '#c982a6', '#7a8b52', '#5d6f87', '#bd7b4d', '#7c6f64'
];

// Chart constructors are checked at render time so the rest of the application stays usable.
function requireChartConstructor(ChartConstructor) {
    if (typeof ChartConstructor !== 'function') {
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
function createChartRenderer(canvas, ChartConstructor, createConfiguration) {
    let chartInstance = null;

    function clear() {
        if (chartInstance) {
            chartInstance.destroy();
            // Clearing the reference ensures a later clear cannot destroy it twice.
            chartInstance = null;
        }
    }

    function render(chartData, currency) {
        requireChartConstructor(ChartConstructor);
        clear();

        // Chart-specific configuration is produced only from explicit render arguments.
        chartInstance = new ChartConstructor(canvas, createConfiguration(chartData, currency));
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

    // Both populated and neutral states use one standard Chart.js pie configuration.
    return {
        type: 'pie',
        data: {
            labels: pieLabels,
            datasets: [{
                // Dataset metadata tells the legend which selected currency it represents.
                label: `Costs in ${currency}`,
                data: pieValues,
                backgroundColor: pieColors,
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        // Responsive sizing follows the dedicated fixed-height container in the UI.
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: hasCosts
                },
                // Tooltip formatting adds the selected currency at the presentation boundary.
                tooltip: {
                    enabled: hasCosts,
                    callbacks: {
                        label: (context) => `${context.label}: ${formatTooltipAmount(context, currency)}`
                    }
                }
            }
            // Default legend behavior already communicates each category label clearly.
        }
    };
}

// Bar configuration always consumes the ordered twelve-month transformation.
function createBarConfiguration(chartData, currency) {
    return {
        type: 'bar',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: `Monthly costs in ${currency}`,
                // Values arrive in January-to-December order from the annual transformation.
                data: chartData.values,
                backgroundColor: '#195f43',
                borderRadius: 6
            }]
        },
        // Responsive sizing follows the dedicated fixed-height container in the UI.
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                // A zero baseline keeps monthly totals visually comparable.
                y: {
                    beginAtZero: true
                }
            },
            plugins: {
                // Tooltip formatting adds the selected currency without rounding the dataset.
                tooltip: {
                    callbacks: {
                        label: (context) => formatTooltipAmount(context, currency)
                    }
                }
            }
            // Default legend behavior already communicates the annual dataset clearly.
        }
    };
}

// Public factories bind one canvas to one chart type without sharing chart instances.
export function createPieChartRenderer(canvas, ChartConstructor) {
    return createChartRenderer(canvas, ChartConstructor, createPieConfiguration);
}

// The second factory uses the same lifecycle with the independent bar configuration.
export function createBarChartRenderer(canvas, ChartConstructor) {
    return createChartRenderer(canvas, ChartConstructor, createBarConfiguration);
}
