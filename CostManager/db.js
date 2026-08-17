// Standalone vanilla JS version of the db library.

// We use an immediately invoked function expression to isolate internal state.
(function () {
    // --- Data Access Helpers ---

    // Internal helper to read existing data or initialize a new array.
    // Placed outside the exported object to hide implementation details.
    function getCostsFromStorage(databaseName) {
        const storageKey = `costsdb_${databaseName}`;
        const rawData = localStorage.getItem(storageKey);
        return rawData ? JSON.parse(rawData) : [];
    }

    // Appends a new item into the specified database storage.
    function saveCostToStorage(databaseName, costData) {
        const storageKey = `costsdb_${databaseName}`;
        const allCosts = getCostsFromStorage(databaseName);
        
        // We update the entire array string in localStorage on every insert.
        allCosts.push(costData);
        localStorage.setItem(storageKey, JSON.stringify(allCosts));
    }

    // --- Domain Logic Helpers ---

    // Enriches a new cost with the current date for storage.
    function buildStoredCost(cost) {
        const today = new Date();
        return {
            sum: Number(cost.sum),
            currency: String(cost.currency),
            category: String(cost.category),
            description: String(cost.description),
            // Month is 1-indexed to align with human readability and expected API params.
            date: {
                day: today.getDate(),
                month: today.getMonth() + 1,
                year: today.getFullYear()
            }
        };
    }

    // Extracts the strict properties required for the addCost public contract.
    function extractPublicAddedCost(storedCost) {
        return {
            sum: storedCost.sum,
            currency: storedCost.currency,
            category: storedCost.category,
            description: storedCost.description
        };
    }

    // Determines the correct year and month to query based on inputs or defaults.
    function resolveTargetPeriod(year, month) {
        const today = new Date();
        const targetYear = year !== undefined ? Number(year) : today.getFullYear();
        const targetMonth = month !== undefined ? Number(month) : (today.getMonth() + 1);
        
        return { targetYear, targetMonth };
    }

    // Filters a list of costs matching the requested year and month.
    function filterCostsByPeriod(costs, targetYear, targetMonth) {
        return costs.filter((item) => {
            return item.date.year === targetYear && item.date.month === targetMonth;
        });
    }

    // Maps a stored item to match the strict report output requirements.
    function mapToReportCost(item) {
        return {
            sum: item.sum,
            currency: item.currency,
            category: item.category,
            description: item.description,
            // Omit month and year from the public structure as requested.
            date: {
                day: item.date.day
            }
        };
    }

    // Calculates a naive total sum. Cross-currency conversion is deferred to Phase 2.
    function calculateNaiveTotal(costs) {
        return costs.reduce((total, item) => {
            return total + Number(item.sum);
        }, 0);
    }

    // --- Public API ---

    // Initializes context and provides access to database manipulation.
    function openCostsDB(databaseName, databaseVersion) {
        
        // Creates a new cost record and stores it in the database.
        function addCost(cost) {
            const storedCost = buildStoredCost(cost);
            saveCostToStorage(databaseName, storedCost);
            
            return extractPublicAddedCost(storedCost);
        }

        // Generates a report aggregated by the selected or current time period.
        function getReport(currency, year, month) {
            const { targetYear, targetMonth } = resolveTargetPeriod(year, month);
            
            const allCosts = getCostsFromStorage(databaseName);
            const periodCosts = filterCostsByPeriod(allCosts, targetYear, targetMonth);
            
            const publicCosts = periodCosts.map(mapToReportCost);
            const accumulatedTotal = calculateNaiveTotal(periodCosts);

            return {
                year: targetYear,
                month: targetMonth,
                costs: publicCosts,
                total: {
                    currency: String(currency),
                    sum: accumulatedTotal
                }
            };
        }

        return {
            addCost,
            getReport
        };
    }

    const db = {
        openCostsDB
    };

    // Attach the single public entry point to the global object.
    window.db = db;
})();
