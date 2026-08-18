import { fetchConfiguredExchangeRates } from './rate-source.js';
import { readMonthlySelection, setDefaultPeriodSelection } from './period-selection.js';
import { buildDetailedReportView } from './report-data.js';

// Status updates use the report's accessible live region for progress and failures.
function showReportStatus(statusElement, message, state) {
    statusElement.textContent = message;
    statusElement.dataset.state = state;
}

// Monetary formatting is a presentation concern and never changes calculated values.
function formatAmount(amount) {
    return Number(amount).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Text-only cells prevent stored descriptions and categories from becoming HTML markup.
function createReportCell(content) {
    const tableCell = document.createElement('td');
    tableCell.textContent = content;
    return tableCell;
}

// Each view row shows both immutable stored values and its operation-scoped conversion.
function createReportRow(reportRow) {
    const tableRow = document.createElement('tr');
    tableRow.append(
        createReportCell(String(reportRow.day)),
        createReportCell(reportRow.description),
        createReportCell(reportRow.category),
        // Original and converted columns make the non-mutating conversion explicit to users.
        createReportCell(`${formatAmount(reportRow.originalSum)} ${reportRow.originalCurrency}`),
        createReportCell(`${formatAmount(reportRow.convertedSum)} ${reportRow.targetCurrency}`)
    );
    return tableRow;
}

// Rendering replaces only report-owned DOM and leaves forms and application state untouched.
function renderDetailedReport(reportView, reportElements) {
    const reportRows = reportView.rows.map(createReportRow);
    reportElements.tableBody.replaceChildren(...reportRows);
    reportElements.totalElement.textContent = `${formatAmount(reportView.total)} ${reportView.currency}`;

    const hasCosts = reportView.rows.length > 0;
    reportElements.outputElement.hidden = !hasCosts;
    reportElements.emptyElement.hidden = hasCosts;

    // An empty monthly result remains a successful operation with clear period feedback.
    if (!hasCosts) {
        reportElements.emptyElement.textContent = 'No costs were found for the selected month.';
    }
}

// One submission owns one fetch, one synchronous DB report, and one display transformation.
export function initializeDetailedReportPanel(reportElements, costsDb, fetchRates = fetchConfiguredExchangeRates) {
    const submitButton = reportElements.form.querySelector('button[type="submit"]');
    setDefaultPeriodSelection(reportElements.form);

    async function handleReportSubmit(event) {
        event.preventDefault();
        submitButton.disabled = true;
        showReportStatus(reportElements.statusElement, 'Loading report…', 'pending');

        // Selection validation completes before the operation performs its single fetch.
        try {
            const selection = readMonthlySelection(reportElements.form);
            const rates = await fetchRates();
            const report = costsDb.getReport(selection.currency, selection.year, selection.month, rates);

            // The same local rates object serves every conversion inside this one operation.
            const reportView = buildDetailedReportView(report, selection.currency, rates);
            renderDetailedReport(reportView, reportElements);
            showReportStatus(reportElements.statusElement, 'Detailed report updated.', 'success');
        } catch (error) {
            // A failed operation never falls back to stale or previously fetched exchange rates.
            reportElements.outputElement.hidden = true;
            reportElements.emptyElement.hidden = false;
            reportElements.emptyElement.textContent = 'The detailed report could not be created.';
            showReportStatus(reportElements.statusElement, error.message, 'error');
        } finally {
            // The control becomes available after both successful and failed operations.
            submitButton.disabled = false;
        }
    }

    // Event ownership remains local to this panel's form.
    reportElements.form.addEventListener('submit', handleReportSubmit);
}
