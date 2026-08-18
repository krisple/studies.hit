import { defaultRatesUrl, getExchangeRatesUrl, saveExchangeRatesUrl } from './settings.js';

// Keep the displayed source synchronized with the exact URL future fetch operations will use.
function showCurrentRatesSource(sourceElement, ratesUrl) {
    sourceElement.textContent = ratesUrl;
    sourceElement.title = ratesUrl;
}

// Status text communicates persistence results without blocking the settings workflow.
function showSettingsStatus(statusElement, message, state) {
    statusElement.textContent = message;
    statusElement.dataset.state = state;
}

// Bind storage-backed settings behavior to the dedicated settings panel.
export function initializeSettingsForm(settingsForm, defaultButton, statusElement, sourceElement, storage = localStorage) {
    const ratesUrlInput = settingsForm.elements.namedItem('ratesUrl');
    const activeRatesUrl = getExchangeRatesUrl(storage);

    // The blank field represents the default source; custom sources remain editable.
    ratesUrlInput.value = activeRatesUrl === defaultRatesUrl ? '' : activeRatesUrl;
    showCurrentRatesSource(sourceElement, activeRatesUrl);

    function handleSettingsSubmit(event) {
        event.preventDefault();

        try {
            // A setting becomes active only after the shared storage boundary accepts it.
            const savedRatesUrl = saveExchangeRatesUrl(ratesUrlInput.value, storage);
            showCurrentRatesSource(sourceElement, savedRatesUrl);
            showSettingsStatus(statusElement, 'Exchange-rate source saved.', 'success');
        } catch (error) {
            // Invalid input remains intact so the user can correct it in place.
            showSettingsStatus(statusElement, error.message, 'error');
        }
    }

    function handleDefaultSource() {
        const savedRatesUrl = saveExchangeRatesUrl('', storage);
        ratesUrlInput.value = '';

        // Resetting is an explicit settings action and receives the same accessible feedback.
        showCurrentRatesSource(sourceElement, savedRatesUrl);
        showSettingsStatus(statusElement, 'Default exchange-rate source restored.', 'success');
    }

    // Each control receives only the handler for its dedicated settings action.
    settingsForm.addEventListener('submit', handleSettingsSubmit);
    defaultButton.addEventListener('click', handleDefaultSource);
}
