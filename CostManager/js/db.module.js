import { convertCurrency } from './exchange.js';
import { exchangeRateManager } from './exchange-rate-manager.js';

// The module API exposes only the factory; each returned object retains its own database name.
const supportedCurrencies = ['USD', 'ILS', 'GBP', 'EURO'];

// Storage reads distinguish a missing database from present but corrupted content.
function getCostsFromStorage(databaseName) {
    const storageKey = `costsdb_${databaseName}`;
    const storedJson = localStorage.getItem(storageKey);

    // A missing key represents an empty database, while every present value must be valid JSON.
    if (storedJson === null) {
        return [];
    }

    try {
        const storedCosts = JSON.parse(storedJson);

        // Reports and writes both reject storage that no longer has the collection shape.
        if (!Array.isArray(storedCosts)) {
            throw new Error('Stored data is not an array');
        }

        storedCosts.forEach((storedCost) => {
            // Every persisted entry must remain a complete cost object before it is trusted.
            if (!storedCost || typeof storedCost !== 'object') {
                throw new Error('Stored item is corrupted or missing mandatory fields');
            }

            if (typeof storedCost.sum !== 'number' || !Number.isFinite(storedCost.sum)) {
                throw new Error('Stored item has invalid sum');
            }

            // Currency validation prevents report conversion from indexing an unsupported rate.
            if (typeof storedCost.currency !== 'string' || !supportedCurrencies.includes(storedCost.currency)) {
                throw new Error('Stored item has invalid or unsupported currency');
            }

            if (typeof storedCost.category !== 'string' || typeof storedCost.description !== 'string') {
                throw new Error('Stored item has invalid category or description');
            }

            // Stored dates include the full period even though reports expose only the day.
            // Broad day bounds reject corrupted storage before period filtering.
            if (!storedCost.date || typeof storedCost.date.year !== 'number' || !Number.isInteger(storedCost.date.year) ||
                typeof storedCost.date.month !== 'number' || !Number.isInteger(storedCost.date.month) ||
                storedCost.date.month < 1 || storedCost.date.month > 12 ||
                typeof storedCost.date.day !== 'number' || !Number.isInteger(storedCost.date.day) ||
                storedCost.date.day < 1 || storedCost.date.day > 31) {
                throw new Error('Stored item is missing a valid date structure');
            }
        });

        // Only the fully validated collection may leave the storage boundary.
        return storedCosts;
    } catch (error) {
        // Surface malformed JSON and structural corruption through one storage-boundary error.
        throw new Error(`Failed to load costs database: ${error.message}`);
    }
}

// Writes validate the existing collection first so an add cannot conceal prior corruption.
function saveCostToStorage(databaseName, storedCost) {
    const storageKey = `costsdb_${databaseName}`;
    const storedCosts = getCostsFromStorage(databaseName);
    storedCosts.push(storedCost);

    // localStorage persists the complete database collection as one JSON array.
    localStorage.setItem(storageKey, JSON.stringify(storedCosts));
}

// Validate cost input before adding application-managed date information.
function validateCostInput(cost) {
    if (!cost || typeof cost !== 'object') {
        throw new Error('Cost must be an object');
    }

    // Non-finite sums cannot be represented reliably after JSON serialization.
    if (typeof cost.sum !== 'number' || !Number.isFinite(cost.sum)) {
        throw new Error('Cost sum must be a finite number');
    }

    if (typeof cost.currency !== 'string' || !supportedCurrencies.includes(cost.currency)) {
        throw new Error(`Cost currency must be one of the supported currencies: ${supportedCurrencies.join(', ')}`);
    }

    // Text fields stay strings at the public boundary instead of being coerced silently.
    if (typeof cost.category !== 'string' || typeof cost.description !== 'string') {
        throw new Error('Cost category and description must be strings');
    }
}

// The storage model owns the insertion date; callers provide only the public cost fields.
function buildStoredCost(cost) {
    const today = new Date();

    // Copy caller fields before attaching the full insertion date with public 1–12 month numbering.
    return {
        sum: cost.sum,
        currency: cost.currency,
        category: cost.category,
        description: cost.description,
        date: {
            day: today.getDate(),
            month: today.getMonth() + 1,
            year: today.getFullYear()
        }
    };
}

// addCost deliberately omits the application-managed date from its return contract.
function extractPublicAddedCost(storedCost) {
    // Preserve the caller's text exactly; storage enrichment must not rewrite public fields.
    return {
        sum: storedCost.sum,
        currency: storedCost.currency,
        category: storedCost.category,
        description: storedCost.description
    };
}

// Omitted period parts default independently to the current calendar year and month.
function resolveTargetPeriod(year, month) {
    if (year !== undefined && (typeof year !== 'number' || !Number.isInteger(year))) {
        throw new Error('Year must be an integer and month must be between 1 and 12');
    }

    // Month validation is independent because either period argument may be omitted.
    if (month !== undefined && (typeof month !== 'number' || !Number.isInteger(month) || month < 1 || month > 12)) {
        throw new Error('Year must be an integer and month must be between 1 and 12');
    }

    const today = new Date();
    const targetYear = year !== undefined ? year : today.getFullYear();
    const targetMonth = month !== undefined ? month : today.getMonth() + 1;

    // Keeping the resolved period explicit makes filtering independent of hidden date state.
    return { targetYear, targetMonth };
}

// Period filtering uses the full stored date and leaves the original collection unchanged.
function filterCostsByPeriod(costs, targetYear, targetMonth) {
    return costs.filter((cost) => {
        return cost.date.year === targetYear && cost.date.month === targetMonth;
    });
}

// Reports preserve original sums and currencies but expose only the required date.day field.
function mapToReportCost(storedCost) {
    // Preserve text while omitting the report-level month and year from each public item.
    return {
        sum: storedCost.sum,
        currency: storedCost.currency,
        category: storedCost.category,
        description: storedCost.description,
        date: {
            day: storedCost.date.day
        }
    };
}

// Conversion reads the manager's retained snapshot only when currencies differ.
function calculateConvertedTotal(costs, targetCurrency) {
    return costs.reduce((total, cost) => {
        const rates = cost.currency === targetCurrency ? null : exchangeRateManager.getRates();
        const convertedAmount = convertCurrency(Number(cost.sum), cost.currency, targetCurrency, rates);
        return total + convertedAmount;
    }, 0);
}

// Opens a named storage database and returns its instance-bound operations.
function openCostsDB(databaseName, databaseVersion) {
    /* The returned methods close over only this database name, which supports multiple
       simultaneous database objects without hidden global current-database state. */
    // Reject an invalid database identity before creating instance-bound methods.
    if (typeof databaseName !== 'string' || typeof databaseVersion !== 'number' || !Number.isFinite(databaseVersion)) {
        throw new Error('databaseName must be a string and databaseVersion must be a finite number');
    }

    function addCost(cost) {
        validateCostInput(cost);
        const storedCost = buildStoredCost(cost);

        // Persist the dated record, then return the narrower public addCost result.
        saveCostToStorage(databaseName, storedCost);
        return extractPublicAddedCost(storedCost);
    }

    function getReport(currency, year, month) {
        // The original three-argument report contract remains fully synchronous.
        if (typeof currency !== 'string' || !supportedCurrencies.includes(currency)) {
            throw new Error(`Report currency must be one of the supported currencies: ${supportedCurrencies.join(', ')}`);
        }

        const { targetYear, targetMonth } = resolveTargetPeriod(year, month);
        const storedCosts = getCostsFromStorage(databaseName);

        // Filtering precedes conversion so rates are needed only for costs in the requested period.
        const periodCosts = filterCostsByPeriod(storedCosts, targetYear, targetMonth);
        const reportCosts = periodCosts.map(mapToReportCost);
        const convertedTotal = calculateConvertedTotal(periodCosts, currency);

        // Resolved period metadata and converted total share one report response.
        // Only the total is converted; each report cost retains its stored amount and currency.
        return {
            year: targetYear,
            month: targetMonth,
            costs: reportCosts,
            total: {
                currency,
                sum: convertedTotal
            }
        };
    }

    // Methods are bound to this database name through the factory closure.
    return {
        addCost,
        getReport
    };
}

// The factory is the module's only public entry point.
const db = {
    openCostsDB
};

export default db;
