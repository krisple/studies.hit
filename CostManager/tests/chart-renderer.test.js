import { jest } from '@jest/globals';
import { createBarChartRenderer, createPieChartRenderer } from '../js/chart-renderer.js';

// The fake constructor records configurations without requiring canvas support in JSDOM.
function createChartConstructor() {
    return jest.fn(function MockChart(canvas, configuration) {
        this.canvas = canvas;
        this.configuration = configuration;
        // Destruction is observable when a panel replaces an existing chart.
        this.destroy = jest.fn();
    });
}

// Each chart type is inspected through the same isolated constructor boundary.
describe('Chart.js rendering boundary', () => {
    test('pie renderer creates a pie configuration and destroys the replaced chart', () => {
        const canvas = document.createElement('canvas');
        const chartConstructor = createChartConstructor();
        const renderer = createPieChartRenderer(canvas, chartConstructor);
        const chartData = { labels: ['Food'], values: [25] };

        // Two renders exercise both initial construction and replacement lifecycle behavior.
        renderer.render(chartData, 'USD');
        renderer.render(chartData, 'ILS');

        // Re-rendering must release the Chart.js instance already attached to the canvas.
        expect(chartConstructor).toHaveBeenCalledTimes(2);
        expect(chartConstructor.mock.instances[0].destroy).toHaveBeenCalledTimes(1);
        expect(chartConstructor.mock.calls[0][1]).toMatchObject({
            type: 'pie',
            data: { labels: ['Food'] }
        });
    });

    // Bar configuration receives its own case because it adds axes and ordered values.
    test('bar renderer passes all ordered monthly values to a zero-based chart', () => {
        const canvas = document.createElement('canvas');
        const chartConstructor = createChartConstructor();
        const renderer = createBarChartRenderer(canvas, chartConstructor);
        const chartData = { labels: ['January', 'February'], values: [10, 20] };

        // Rendering captures the production configuration on the fake constructor call.
        renderer.render(chartData, 'EURO');

        // The rendering layer adds configuration but leaves transformed values unchanged.
        const configuration = chartConstructor.mock.calls[0][1];
        expect(configuration.type).toBe('bar');
        expect(configuration.data.datasets[0].data).toEqual([10, 20]);
        expect(configuration.options.scales.y.beginAtZero).toBe(true);
    });

    // Empty data needs a dedicated assertion because the canvas must remain visible.
    test('pie renderer keeps an empty period visible as a neutral chart', () => {
        const chartConstructor = createChartConstructor();
        const renderer = createPieChartRenderer(document.createElement('canvas'), chartConstructor);

        // No category values should produce a visible neutral slice without a misleading legend.
        renderer.render({ labels: [], values: [] }, 'USD');
        const configuration = chartConstructor.mock.calls[0][1];
        expect(configuration.data.labels).toEqual(['No costs']);
        expect(configuration.data.datasets[0].data).toEqual([1]);
        expect(configuration.options.plugins.legend.display).toBe(false);
        expect(configuration.options.plugins.tooltip.enabled).toBe(false);
    });

    // Script-load failure remains independent from valid empty-data rendering.
    test('rendering reports a missing Chart.js script clearly', () => {
        const renderer = createPieChartRenderer(document.createElement('canvas'), undefined);

        // Other application panels can initialize even when the external CDN did not load.
        expect(() => renderer.render({ labels: [], values: [] }, 'USD')).toThrow('Chart.js failed to load');
    });
});
