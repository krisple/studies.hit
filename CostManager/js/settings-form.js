import { defaultRatesUrl, getExchangeRatesUrl, saveExchangeRatesUrl } from './settings.js';
import { exchangeRateManager } from './exchange-rate-manager.js';

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
export function initializeSettingsForm(
    settingsForm,
    defaultButton,
    statusElement,
    sourceElement,
    // Optional boundaries keep storage and rate loading deterministic in tests.
    storage = localStorage,
    rateManager = exchangeRateManager,
    onExplicitRatesLoaded = () => {}
) {
    const ratesUrlInput = settingsForm.elements.namedItem('ratesUrl');
    const settingsCard = settingsForm.closest('.settings-panel') ?? settingsForm;
    const activeRatesUrl = getExchangeRatesUrl(storage);
    let latestSourceChangeId = 0;
    let hasDismissibleSuccess = false;

    // The blank field represents the default source; custom sources remain editable.
    ratesUrlInput.value = activeRatesUrl === defaultRatesUrl ? '' : activeRatesUrl;
    showCurrentRatesSource(sourceElement, activeRatesUrl);

    // Only successful feedback is dismissed, and clicks inside Settings leave it visible.
    function handlePageClick(event) {
        if (!hasDismissibleSuccess || settingsCard.contains(event.target)) {
            return;
        }

        statusElement.textContent = '';
        delete statusElement.dataset.state;
        hasDismissibleSuccess = false;
    }

    async function activateRatesSource(ratesUrl, successMessage) {
        latestSourceChangeId += 1;
        const sourceChangeId = latestSourceChangeId;
        showSettingsStatus(statusElement, 'Loading exchange rates…', 'pending');
        hasDismissibleSuccess = false;

        try {
            // Existing rates remain active inside the manager until this request succeeds.
            await rateManager.setRatesUrl(ratesUrl);
            if (sourceChangeId === latestSourceChangeId) {
                showSettingsStatus(statusElement, successMessage, 'success');
                hasDismissibleSuccess = true;
                // This callback belongs only to explicit Settings actions, never periodic refreshes.
                onExplicitRatesLoaded();
            }
        } catch (error) {
            // A failed replacement leaves both the chosen URL and prior valid rates intact.
            if (sourceChangeId === latestSourceChangeId) {
                showSettingsStatus(statusElement, error.message, 'error');
                hasDismissibleSuccess = false;
            }
        }
    }

    // Submission persists a validated source before beginning its replacement load.
    function handleSettingsSubmit(event) {
        event.preventDefault();

        try {
            // Persistence and Fetch start in the same event turn after validation succeeds.
            const savedRatesUrl = saveExchangeRatesUrl(ratesUrlInput.value, storage);
            showCurrentRatesSource(sourceElement, savedRatesUrl);
            void activateRatesSource(savedRatesUrl, 'Exchange-rate source saved and loaded.');
        } catch (error) {
            // Invalid input remains intact so the user can correct it in place.
            showSettingsStatus(statusElement, error.message, 'error');
            hasDismissibleSuccess = false;
        }
    }

    function handleDefaultSource() {
        const savedRatesUrl = saveExchangeRatesUrl('', storage);
        ratesUrlInput.value = '';

        // Resetting starts an immediate request while the previous snapshot remains available.
        showCurrentRatesSource(sourceElement, savedRatesUrl);
        void activateRatesSource(savedRatesUrl, 'Default exchange-rate source restored and loaded.');
    }

    // Each control receives only the handler for its dedicated settings action.
    document.addEventListener('click', handlePageClick);
    settingsForm.addEventListener('submit', handleSettingsSubmit);
    defaultButton.addEventListener('click', handleDefaultSource);
}
