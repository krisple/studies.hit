import db from './db.module.js';
import { applicationConfig } from './config.js';
import { exchangeRateManager } from './exchange-rate-manager.js';
import { initializeAddCostForm } from './add-cost-form.js';
import { initializeBarChartPanel } from './bar-chart-panel.js';
import { createBarChartRenderer, createPieChartRenderer } from './chart-renderer.js';
import { initializeDropdowns } from './dropdown.js';
// Panel imports keep document orchestration separate from each UI responsibility.
import { initializeDetailedReportPanel } from './detailed-report-panel.js';
import { initializePieChartPanel } from './pie-chart-panel.js';
import { initializeSettingsForm } from './settings-form.js';
import { getExchangeRatesUrl } from './settings.js';

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
        // One shared dialog serves every expandable description in the report table.
        dialogElement: getRequiredElement('description-dialog'),
        dialogTextElement: getRequiredElement('description-dialog-text'),
        dialogCloseButton: getRequiredElement('description-dialog-close'),
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
    // Fetch starts before UI wiring; consumers may keep using an earlier valid snapshot.
    const initialRatesLoad = exchangeRateManager.start(getExchangeRatesUrl());
    const costsDb = db.openCostsDB(applicationConfig.databaseName, applicationConfig.databaseVersion);
    const addCostForm = getRequiredElement('add-cost-form');
    const addCostStatus = getRequiredElement('add-cost-status');

    // Settings nodes are resolved together before their dedicated form is initialized.
    const settingsForm = getRequiredElement('settings-form');
    const defaultRatesButton = getRequiredElement('use-default-rates');
    const settingsStatus = getRequiredElement('settings-status');
    const currentRatesSource = getRequiredElement('current-rates-source');

    // Settings changes persist their URL and immediately tell the shared manager to fetch it.
    initializeSettingsForm(settingsForm, defaultRatesButton, settingsStatus, currentRatesSource);

    const detailedReportElements = getDetailedReportElements();
    initializeDetailedReportPanel(detailedReportElements, costsDb);

    // Chart.js is a rendering dependency only; business transformations never access it.
    const pieChartElements = getChartElements('pie');
    const pieChartRenderer = createPieChartRenderer(pieChartElements.canvas, window.Chart);
    const pieChartPanel = initializePieChartPanel(pieChartElements, costsDb, pieChartRenderer);

    const barChartElements = getChartElements('bar');
    const barChartRenderer = createBarChartRenderer(barChartElements.canvas, window.Chart);
    // The annual panel owns its operation, while its renderer owns only the canvas instance.
    const barChartPanel = initializeBarChartPanel(barChartElements, costsDb, barChartRenderer);

    // Successful additions refresh only charts whose selections include the current month.
    function refreshCurrentCharts() {
        pieChartPanel.refreshIfCurrentPeriod();
        barChartPanel.refreshIfCurrentPeriod();
    }

    // Cost creation owns form work and reports successful persistence to chart orchestration.
    initializeAddCostForm(addCostForm, addCostStatus, costsDb, refreshCurrentCharts);
    // Enhancement runs last so visible dropdowns reflect every form's initialized defaults.
    initializeDropdowns(document);

    // Charts refresh whenever startup, replacement, or periodic loading activates new rates.
    exchangeRateManager.subscribe(() => {
        pieChartPanel.update();
        barChartPanel.update();
    });
    void initialRatesLoad.catch((error) => {
        // UI controls remain usable so a corrected settings URL can start another request.
        console.error('Initial exchange-rate loading failed:', error);
    });
}

if (document.readyState === 'loading') {
    // Defer wiring until every form element from index.html exists.
    document.addEventListener('DOMContentLoaded', initializeApplication, { once: true });
} else {
    initializeApplication();
}
