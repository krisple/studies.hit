import db from './db.module.js';
import { initializeAddCostForm } from './add-cost-form.js';
import { initializeBarChartPanel } from './bar-chart-panel.js';
import { createBarChartRenderer, createPieChartRenderer } from './chart-renderer.js';
import { initializeDetailedReportPanel } from './detailed-report-panel.js';
import { initializePieChartPanel } from './pie-chart-panel.js';
import { initializeSettingsForm } from './settings-form.js';

// Required-element lookup makes an incomplete application document fail with useful context.
function getRequiredElement(elementId) {
    const element = document.getElementById(elementId);

    if (!element) {
        throw new Error(`Missing required application element: ${elementId}`);
    }

    // Returning the resolved node keeps all later wiring free of repeated lookups.
    return element;
}

// Report element collection keeps the panel initializer independent from document queries.
function getDetailedReportElements() {
    return {
        form: getRequiredElement('detailed-report-form'),
        statusElement: getRequiredElement('detailed-report-status'),
        emptyElement: getRequiredElement('detailed-report-empty'),
        outputElement: getRequiredElement('detailed-report-output'),
        // Table content and total are the only mutable nodes inside report output.
        tableBody: getRequiredElement('detailed-report-body'),
        totalElement: getRequiredElement('detailed-report-total')
    };
}

// Both charts expose the same UI dependency shape while keeping separate DOM nodes.
function getChartElements(chartName) {
    return {
        form: getRequiredElement(`${chartName}-chart-form`),
        statusElement: getRequiredElement(`${chartName}-chart-status`),
        canvasContainer: getRequiredElement(`${chartName}-chart-container`),
        // Canvas lookup remains explicit so each renderer can own exactly one chart.
        canvas: getRequiredElement(`${chartName}-chart-canvas`)
    };
}

// The entry point wires UI modules to one explicit database instance.
export function initializeApplication() {
    const costsDb = db.openCostsDB('cost-manager', 1);
    const addCostForm = getRequiredElement('add-cost-form');
    const addCostStatus = getRequiredElement('add-cost-status');

    // Cost creation owns only form parsing, persistence, and user feedback.
    initializeAddCostForm(addCostForm, addCostStatus, costsDb);

    const settingsForm = getRequiredElement('settings-form');
    const defaultRatesButton = getRequiredElement('use-default-rates');
    const settingsStatus = getRequiredElement('settings-status');
    const currentRatesSource = getRequiredElement('current-rates-source');

    // Settings remain independent from the stateless exchange and database modules.
    initializeSettingsForm(settingsForm, defaultRatesButton, settingsStatus, currentRatesSource);

    const detailedReportElements = getDetailedReportElements();
    initializeDetailedReportPanel(detailedReportElements, costsDb);

    // Chart.js is a rendering dependency only; business transformations never access it.
    const pieChartElements = getChartElements('pie');
    const pieChartRenderer = createPieChartRenderer(pieChartElements.canvas, window.Chart);
    initializePieChartPanel(pieChartElements, costsDb, pieChartRenderer);

    const barChartElements = getChartElements('bar');
    const barChartRenderer = createBarChartRenderer(barChartElements.canvas, window.Chart);
    // The annual panel owns its operation, while its renderer owns only the canvas instance.
    initializeBarChartPanel(barChartElements, costsDb, barChartRenderer);
}

if (document.readyState === 'loading') {
    // Defer wiring until every form element from index.html exists.
    document.addEventListener('DOMContentLoaded', initializeApplication, { once: true });
} else {
    initializeApplication();
}
