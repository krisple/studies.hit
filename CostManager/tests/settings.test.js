import { jest } from '@jest/globals';
import { defaultRatesUrl, getExchangeRatesUrl, saveExchangeRatesUrl } from '../js/settings.js';
import { initializeSettingsForm } from '../js/settings-form.js';

// Two promise turns allow the async settings status handler to finish after a mock resolves.
async function waitForSettingsUpdate() {
    await Promise.resolve();
    await Promise.resolve();
}

// Settings tests use the same named input and feedback elements as index.html.
function renderSettingsForm() {
    document.body.innerHTML = [
        '<section class="settings-panel">',
        // The form exposes the same named URL boundary used by the production handler.
        '<form id="settings-form">',
        '<input name="ratesUrl" type="url">',
        '<button type="submit">Save Settings</button>',
        '</form>',
        // Separate elements expose reset behavior and both accessible feedback outputs.
        '<button id="use-default-rates" type="button">Use Default</button>',
        '<p id="settings-status"></p>',
        '<strong id="current-rates-source"></strong>',
        '</section>',
        '<button id="outside-settings" type="button">Outside</button>'
    ].join('');

    // Returning all settings-owned nodes keeps handler dependencies explicit.
    return {
        settingsForm: document.getElementById('settings-form'),
        defaultButton: document.getElementById('use-default-rates'),
        // Feedback and source nodes complete the dependencies used by both handlers.
        statusElement: document.getElementById('settings-status'),
        sourceElement: document.getElementById('current-rates-source'),
        outsideButton: document.getElementById('outside-settings')
    };
}

// Each settings case starts with isolated persistence and manager mocks where needed.
describe('exchange-rate settings', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        // Network mocks must not leak into the independent exchange module tests.
        jest.restoreAllMocks();
    });

    test('the configured source falls back to the bundled rates when no custom URL exists', () => {
        // No storage entry is necessary for the application's required default behavior.
        expect(getExchangeRatesUrl()).toBe(defaultRatesUrl);
        expect(defaultRatesUrl).toBe('https://cost-2-cost.onrender.com/rates/default/rates.json');
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

    test('saveExchangeRatesUrl rejects invalid or unsupported URLs', () => {
        // Only external HTTP and HTTPS endpoints match the project settings contract.
        expect(() => saveExchangeRatesUrl('not a url')).toThrow('Enter a valid HTTP or HTTPS URL');
        expect(() => saveExchangeRatesUrl('file:///tmp/rates.json')).toThrow('Enter a valid HTTP or HTTPS URL');
        expect(getExchangeRatesUrl()).toBe(defaultRatesUrl);
    });

    // Submission coverage starts from a clean manager and a fully rendered form fixture.
    test('submitting settings immediately starts loading the saved source', async () => {
        const settingsElements = renderSettingsForm();
        const rateManager = { setRatesUrl: jest.fn().mockResolvedValue({ USD: 1 }) };
        const onExplicitRatesLoaded = jest.fn();

        // Bind the complete production dependency set before custom-source submission.
        initializeSettingsForm(
            settingsElements.settingsForm,
            settingsElements.defaultButton,
            settingsElements.statusElement,
            settingsElements.sourceElement,
            localStorage,
            rateManager,
            onExplicitRatesLoaded
        );

        // A valid custom address should become both stored and visibly active.
        const customRatesUrl = 'https://rates.example.org/current.json';
        settingsElements.settingsForm.elements.ratesUrl.value = customRatesUrl;

        // Submitting is the only point at which an edited URL becomes active.
        settingsElements.settingsForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        expect(getExchangeRatesUrl()).toBe(customRatesUrl);
        expect(settingsElements.sourceElement.textContent).toBe(customRatesUrl);
        expect(rateManager.setRatesUrl).toHaveBeenCalledWith(customRatesUrl);
        expect(settingsElements.statusElement.dataset.state).toBe('pending');

        // Successful replacement becomes visible after the manager activates its response.
        await waitForSettingsUpdate();
        expect(settingsElements.statusElement.dataset.state).toBe('success');
        expect(onExplicitRatesLoaded).toHaveBeenCalledTimes(1);

        // Success survives interactions inside Settings and clears on the first outside click.
        settingsElements.settingsForm.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(settingsElements.statusElement.textContent).toContain('saved and loaded');
        settingsElements.outsideButton.click();
        expect(settingsElements.statusElement.textContent).toBe('');
        expect(settingsElements.statusElement.dataset.state).toBeUndefined();
    });

    // Reset behavior covers both storage removal and visible form synchronization.
    test('Use Default removes the custom source and immediately reloads the default', async () => {
        const settingsElements = renderSettingsForm();
        const rateManager = { setRatesUrl: jest.fn().mockResolvedValue({ USD: 1 }) };
        const onExplicitRatesLoaded = jest.fn();
        saveExchangeRatesUrl('https://example.com/rates.json');

        // Initialization must observe the existing custom source before reset removes it.
        initializeSettingsForm(
            settingsElements.settingsForm,
            settingsElements.defaultButton,
            settingsElements.statusElement,
            settingsElements.sourceElement,
            localStorage,
            rateManager,
            onExplicitRatesLoaded
        );

        // Initialization shows the stored source in both the editable and read-only views.
        expect(settingsElements.settingsForm.elements.ratesUrl.value).toBe('https://example.com/rates.json');
        settingsElements.defaultButton.click();
        expect(settingsElements.settingsForm.elements.ratesUrl.value).toBe('');
        expect(settingsElements.sourceElement.textContent).toBe(defaultRatesUrl);
        expect(rateManager.setRatesUrl).toHaveBeenCalledWith(defaultRatesUrl);

        // Both the effective getter and status text must confirm the reset.
        expect(getExchangeRatesUrl()).toBe(defaultRatesUrl);
        await waitForSettingsUpdate();
        expect(settingsElements.statusElement.textContent).toContain('restored');
        expect(onExplicitRatesLoaded).toHaveBeenCalledTimes(1);
    });

    // Invalid form input must stop before persistence or manager activation.
    test('an invalid form URL does not replace the active source', () => {
        const settingsElements = renderSettingsForm();
        const rateManager = { setRatesUrl: jest.fn() };
        initializeSettingsForm(
            // The same fixture verifies that validation errors leave active state untouched.
            settingsElements.settingsForm,
            settingsElements.defaultButton,
            settingsElements.statusElement,
            settingsElements.sourceElement,
            localStorage,
            rateManager
        );

        // An unsupported protocol reaches the shared validation boundary on submit.
        settingsElements.settingsForm.elements.ratesUrl.value = 'ftp://example.com/rates.json';
        settingsElements.settingsForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

        // Failed validation is visible while the already active default remains unchanged.
        expect(getExchangeRatesUrl()).toBe(defaultRatesUrl);
        expect(settingsElements.sourceElement.textContent).toBe(defaultRatesUrl);
        expect(settingsElements.statusElement.dataset.state).toBe('error');
        expect(rateManager.setRatesUrl).not.toHaveBeenCalled();
    });
});
