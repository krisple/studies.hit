const supportedCurrencies = ['USD', 'ILS', 'GBP', 'EURO'];

// Status updates share one accessible region while preserving success and error styling.
function showFormStatus(statusElement, message, state) {
    statusElement.textContent = message;
    statusElement.dataset.state = state;
}

// Convert browser-owned string fields into the exact object expected by addCost.
export function buildCostFromForm(costForm) {
    const formFields = new FormData(costForm);
    const sumText = String(formFields.get('sum') ?? '').trim();
    const currency = String(formFields.get('currency') ?? '');
    const category = String(formFields.get('category') ?? '').trim();
    const description = String(formFields.get('description') ?? '').trim();

    // Empty numeric input must not become zero through Number's implicit blank conversion.
    if (sumText === '') {
        throw new Error('Enter a cost sum');
    }

    // Explicit conversion keeps the numeric type stable at the application boundary.
    const sum = Number(sumText);
    if (!Number.isFinite(sum)) {
        throw new Error('Enter a valid cost sum');
    }

    // UI validation mirrors the database currency contract before persistence is attempted.
    if (!supportedCurrencies.includes(currency)) {
        throw new Error('Select a supported currency');
    }

    if (category === '') {
        throw new Error('Enter a category');
    }

    // A meaningful description is required by the cost-creation flow.
    if (description === '') {
        throw new Error('Enter a description');
    }

    return { sum, currency, category, description };
}

// Bind one form to an explicit database instance without introducing shared mutable state.
export function initializeAddCostForm(costForm, statusElement, costsDb) {
    function handleAddCost(event) {
        event.preventDefault();

        try {
            const newCost = buildCostFromForm(costForm);
            const addedCost = costsDb.addCost(newCost);

            // Reset only after persistence succeeds so failed input remains available to correct.
            costForm.reset();
            const formattedSum = Number(addedCost.sum).toLocaleString('en-US', {
                maximumFractionDigits: 2
            });
            showFormStatus(statusElement, `Added ${formattedSum} ${addedCost.currency} to ${addedCost.category}.`, 'success');
        } catch (error) {
            // Database and validation failures are presented in the form's live status region.
            showFormStatus(statusElement, error.message, 'error');
        }
    }

    costForm.addEventListener('submit', handleAddCost);
}
