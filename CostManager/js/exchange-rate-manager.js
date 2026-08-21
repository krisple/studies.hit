import { applicationConfig } from './config.js';
import { fetchExchangeRates } from './exchange.js';

/* The manager owns the application-wide rate snapshot, source changes, and refresh timer.
   A source version prevents late responses from an older URL replacing newer rates. */
export class ExchangeRateManager {
    // Constructor injection keeps Fetch and timer cadence independently testable.
    constructor(fetchRates = fetchExchangeRates, refreshIntervalMs = applicationConfig.exchangeRatesRefreshIntervalMs) {
        this.fetchRates = fetchRates;
        this.refreshIntervalMs = refreshIntervalMs;
        this.activeRates = null;
        this.ratesUrl = applicationConfig.defaultRatesUrl;
        // The source counter makes asynchronous response ordering explicit.
        this.sourceVersion = 0;
        this.refreshTimerId = null;
        this.listeners = new Set();
    }

    // Consumers receive the retained valid snapshot synchronously without starting Fetch.
    getRates() {
        if (this.activeRates === null) {
            throw new Error('Exchange rates have not loaded yet');
        }

        return this.activeRates;
    }

    // One request captures its source identity before yielding to the network.
    async refresh() {
        const requestedUrl = this.ratesUrl;
        const requestedSourceVersion = this.sourceVersion;
        const fetchedRates = await this.fetchRates(requestedUrl);

        // Any valid response from the still-current source may replace active rates.
        if (requestedSourceVersion === this.sourceVersion) {
            this.activeRates = Object.freeze({ ...fetchedRates });
            this.listeners.forEach((listener) => listener());
        }

        return this.activeRates;
    }

    // Changing a source starts its first request before control returns to the caller.
    setRatesUrl(ratesUrl) {
        this.ratesUrl = ratesUrl;
        this.sourceVersion += 1;
        return this.refresh();
    }

    // Subscribers can refresh visible calculations whenever a new snapshot becomes active.
    subscribe(listener) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    // Startup combines immediate loading with the single application refresh schedule.
    start(ratesUrl = applicationConfig.defaultRatesUrl) {
        this.stop();
        const initialLoad = this.setRatesUrl(ratesUrl);

        // Periodic failures are isolated so the last successful snapshot remains usable.
        this.refreshTimerId = setInterval(() => {
            void this.refresh().catch(() => {});
        }, this.refreshIntervalMs);
        return initialLoad;
    }

    // Timer cleanup supports application teardown and deterministic unit tests.
    stop() {
        if (this.refreshTimerId !== null) {
            clearInterval(this.refreshTimerId);
            this.refreshTimerId = null;
        }
    }
}

// The application and DB share one manager so all rate-dependent work reuses one snapshot.
export const exchangeRateManager = new ExchangeRateManager();
