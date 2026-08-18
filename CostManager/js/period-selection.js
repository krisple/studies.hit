const supportedCurrencies = ['USD', 'ILS', 'GBP', 'EURO'];

// Forms open on the current period while still allowing the user to choose another period.
export function setDefaultPeriodSelection(periodForm, today = new Date()) {
    const yearInput = periodForm.elements.namedItem('year');
    const monthInput = periodForm.elements.namedItem('month');

    yearInput.value = String(today.getFullYear());

    // Annual forms intentionally omit month, so only monthly forms receive this default.
    if (monthInput) {
        monthInput.value = String(today.getMonth() + 1);
    }
}

// Explicit integer parsing prevents browser-owned strings from leaking into the database API.
function readYear(periodForm) {
    const yearText = String(periodForm.elements.namedItem('year').value).trim();
    const year = Number(yearText);

    if (yearText === '' || !Number.isInteger(year)) {
        throw new Error('Enter a valid year');
    }

    // The validated integer is ready for the synchronous database boundary.
    return year;
}

// Currency validation mirrors the four-symbol application and database contracts.
function readCurrency(periodForm) {
    const currency = String(periodForm.elements.namedItem('currency').value);

    if (!supportedCurrencies.includes(currency)) {
        throw new Error('Select a supported currency');
    }

    return currency;
}

// Monthly operations need all three selections converted at the UI boundary.
export function readMonthlySelection(periodForm) {
    const monthText = String(periodForm.elements.namedItem('month').value).trim();
    const month = Number(monthText);

    if (!Number.isInteger(month) || month < 1 || month > 12) {
        throw new Error('Select a valid month');
    }

    // Browser strings are resolved before the selection leaves this module.
    return {
        year: readYear(periodForm),
        month,
        // Reading currency last keeps each boundary check focused and predictable.
        currency: readCurrency(periodForm)
    };
}

// Annual selection deliberately has no hidden or default month dependency.
export function readAnnualSelection(periodForm) {
    return {
        year: readYear(periodForm),
        currency: readCurrency(periodForm)
    };
}
