import { jest } from '@jest/globals';
import { fetchConfiguredExchangeRates } from '../js/rate-source.js';
import { defaultRatesUrl, getExchangeRatesUrl, saveExchangeRatesUrl } from '../js/settings.js';
import { initializeSettingsForm } from '../js/settings-form.js';

// Settings tests use the same named input and feedback elements as index.html.
function renderSettingsForm() {
    document.body.innerHTML = [
        // The form exposes the same named URL boundary used by the production handler.
        '<form id="settings-form">',
        '<input name="ratesUrl" type="url">',
        '<button type="submit">Save Settings</button>',
        '</form>',
        // Separate elements expose reset behavior and both accessible feedback outputs.
        '<button id="use-default-rates" type="button">Use Default</button>',
        '<p id="settings-status"></p>',
        '<strong id="current-rates-source"></strong>'
    ].join('');

    // Returning all settings-owned nodes keeps handler dependencies explicit.
    return {
        settingsForm: document.getElementById('settings-form'),
        defaultButton: document.getElementById('use-default-rates'),
        // Feedback and source nodes complete the dependencies used by both handlers.
        statusElement: document.getElementById('settings-status'),
        sourceElement: document.getElementById('current-rates-source')
    };
}

// Each settings case starts with isolated persistence and a fresh network boundary.
describe('exchange-rate settings', () => {
    beforeEach(() => {
        localStorage.clear();
        global.fetch = jest.fn();
    });

    afterEach(() => {
        // Network mocks must not leak into the independent exchange module tests.
        jest.restoreAllMocks();
    });

    test('the configured source falls back to rates.json when no custom URL exists', () => {
        // No storage entry is necessary for the application's required default behavior.
        expect(getExchangeRatesUrl()).toBe(defaultRatesUrl);
        expect(defaultRatesUrl).toBe('rates.json');
    });

    test('saveExchangeRatesUrl trims and persists a valid custom source', () => {
        const customRatesUrl = 'https://example.com/rates.json';

        // Whitespace is a form concern and must not become part of a later Fetch URL.
        expect(saveExchangeRatesUrl(`  ${customRatesUrl}  `)).toBe(customRatesUrl);
        expect(getExchangeRatesUrl()).toBe(customRatesUrl);
    });

    test('getExchangeRatesUrl rejects an invalid custom URL found in storage', () => {
        localStorage.setItem('costManager_ratesUrl', 'ftp://example.com/rates.json');

        // Read-time validation prevents corrupted persisted state from reaching Fetch.
        expect(() => getExchangeRatesUrl()).toThrow('Enter a valid HTTP or HTTPS URL');
    });

    test('configured rate fetching connects the default setting to a fresh request', async () => {
        const rates = { USD: 1, ILS: 3.4, GBP: 0.6, EURO: 0.7 };
        global.fetch.mockResolvedValueOnce({ ok: true, json: async () => rates });

        // The application service resolves the default before delegating to stateless exchange logic.
        await expect(fetchConfiguredExchangeRates()).resolves.toEqual(rates);
        expect(global.fetch).toHaveBeenCalledWith(defaultRatesUrl);
    });

    test('configured rate fetching uses the custom URL saved by Settings', async () => {
        const rates = { USD: 1, ILS: 3.5, GBP: 0.62, EURO: 0.72 };
        const customRatesUrl = 'https://example.com/custom-rates.json';

        // Persist the source before starting the independent fetch operation.
        saveExchangeRatesUrl(customRatesUrl);
        global.fetch.mockResolvedValueOnce({ ok: true, json: async () => rates });

        // A separate operation reads the current setting without retaining fetched rates.
        await fetchConfiguredExchangeRates();
        expect(global.fetch).toHaveBeenCalledWith(customRatesUrl);
    });

    test('saveExchangeRatesUrl rejects invalid or unsupported URLs', () => {
        // Only external HTTP and HTTPS endpoints match the project settings contract.
        expect(() => saveExchangeRatesUrl('not a url')).toThrow('Enter a valid HTTP or HTTPS URL');
        expect(() => saveExchangeRatesUrl('file:///tmp/rates.json')).toThrow('Enter a valid HTTP or HTTPS URL');
        expect(getExchangeRatesUrl()).toBe(defaultRatesUrl);
    });

    test('submitting settings updates storage, feedback, and the displayed source', () => {
        const settingsElements = renderSettingsForm();

        // Bind production handlers before simulating the custom-source submission.
        initializeSettingsForm(
            // Bind all production dependencies to this isolated settings fixture.
            settingsElements.settingsForm,
            settingsElements.defaultButton,
            settingsElements.statusElement,
            settingsElements.sourceElement
        );

        // A valid custom address should become both stored and visibly active.
        const customRatesUrl = 'https://rates.example.org/current.json';
        settingsElements.settingsForm.elements.ratesUrl.value = customRatesUrl;

        // Submitting is the only point at which an edited URL becomes active.
        settingsElements.settingsForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        expect(getExchangeRatesUrl()).toBe(customRatesUrl);
        expect(settingsElements.sourceElement.textContent).toBe(customRatesUrl);
        expect(settingsElements.statusElement.dataset.state).toBe('success');
    });

    // Reset behavior covers both storage removal and visible form synchronization.
    test('Use Default removes the custom source and clears the input', () => {
        const settingsElements = renderSettingsForm();
        saveExchangeRatesUrl('https://example.com/rates.json');
        initializeSettingsForm(
            // Initialization must read the custom URL before reset behavior is exercised.
            settingsElements.settingsForm,
            settingsElements.defaultButton,
            settingsElements.statusElement,
            settingsElements.sourceElement
        );

        // Initialization shows the stored source in both the editable and read-only views.
        expect(settingsElements.settingsForm.elements.ratesUrl.value).toBe('https://example.com/rates.json');
        settingsElements.defaultButton.click();
        expect(settingsElements.settingsForm.elements.ratesUrl.value).toBe('');
        expect(settingsElements.sourceElement.textContent).toBe(defaultRatesUrl);

        // Both the effective getter and status text must confirm the reset.
        expect(getExchangeRatesUrl()).toBe(defaultRatesUrl);
        expect(settingsElements.statusElement.textContent).toContain('restored');
    });

    test('an invalid form URL does not replace the active source', () => {
        const settingsElements = renderSettingsForm();
        initializeSettingsForm(
            // The same fixture verifies that validation errors leave active state untouched.
            settingsElements.settingsForm,
            settingsElements.defaultButton,
            settingsElements.statusElement,
            settingsElements.sourceElement
        );

        // An unsupported protocol reaches the shared validation boundary on submit.
        settingsElements.settingsForm.elements.ratesUrl.value = 'ftp://example.com/rates.json';
        settingsElements.settingsForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

        // Failed validation is visible while the already active default remains unchanged.
        expect(getExchangeRatesUrl()).toBe(defaultRatesUrl);
        expect(settingsElements.sourceElement.textContent).toBe(defaultRatesUrl);
        expect(settingsElements.statusElement.dataset.state).toBe('error');
    });
});
