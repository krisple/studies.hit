import db from './db.module.js';
import { initializeAddCostForm } from './add-cost-form.js';
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
}

if (document.readyState === 'loading') {
    // Defer wiring until every form element from index.html exists.
    document.addEventListener('DOMContentLoaded', initializeApplication, { once: true });
} else {
    initializeApplication();
}
