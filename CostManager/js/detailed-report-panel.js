import { readMonthlySelection, setDefaultPeriodSelection } from './period-selection.js';
import { buildDetailedReportView } from './report-data.js';
import { exchangeRateManager } from './exchange-rate-manager.js';

const descriptionPreviewLimit = 80;

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

// Fixed-width date components keep every report row unambiguous and consistently aligned.
function formatReportDate(date) {
    const month = String(date.month).padStart(2, '0');
    const day = String(date.day).padStart(2, '0');
    return `${date.year}-${month}-${day}`;
}

// Text-only cells prevent stored descriptions and categories from becoming HTML markup.
function createReportCell(content) {
    const tableCell = document.createElement('td');
    tableCell.textContent = content;
    return tableCell;
}

// Long descriptions become a bounded preview with an explicit full-text action.
function createDescriptionCell(description, showFullDescription) {
    const tableCell = document.createElement('td');
    tableCell.className = 'report-description-cell';

    // Short values remain ordinary text because no hidden content needs disclosure.
    if (description.length <= descriptionPreviewLimit) {
        tableCell.textContent = description;
        return tableCell;
    }

    // Preview construction keeps the full value exclusively in the click handler closure.
    const previewText = `${description.slice(0, descriptionPreviewLimit).trimEnd()}…`;
    const previewButton = document.createElement('button');
    const previewContent = document.createElement('span');
    const actionText = document.createElement('span');

    // Button copy makes the expandable behavior visible without relying on color alone.
    previewButton.type = 'button';
    previewButton.className = 'description-preview-button';
    previewButton.setAttribute('aria-haspopup', 'dialog');
    previewButton.setAttribute('aria-label', `View full description. Preview: ${previewText}`);
    previewContent.className = 'description-preview-text';
    previewContent.textContent = previewText;
    // A separate action label makes clickability explicit beneath the preview itself.
    actionText.className = 'description-preview-action';
    actionText.textContent = 'View full description →';

    previewButton.append(previewContent, actionText);
    previewButton.addEventListener('click', () => showFullDescription(description, previewButton));
    tableCell.append(previewButton);
    return tableCell;
}

// One reusable dialog displays any selected row without copying descriptions into markup.
function initializeDescriptionDialog(reportElements) {
    const { dialogElement, dialogTextElement, dialogCloseButton } = reportElements;
    let lastTrigger = null;

    function restoreTriggerFocus() {
        lastTrigger?.focus();
        lastTrigger = null;
    }

    // All dismissal paths converge here so native and fallback states remain consistent.
    function closeDialog() {
        if (!dialogElement.open) {
            return;
        }

        // Native dialog methods own focus containment when the browser supports them.
        if (typeof dialogElement.close === 'function') {
            dialogElement.close();
        } else {
            dialogElement.removeAttribute('open');
            restoreTriggerFocus();
        }
    }

    // The selected trigger is retained so focus returns to the originating report row.
    function showFullDescription(description, trigger) {
        dialogTextElement.textContent = description;
        lastTrigger = trigger;

        // The attribute fallback keeps tests and older dialog implementations functional.
        if (typeof dialogElement.showModal === 'function') {
            dialogElement.showModal();
        } else {
            dialogElement.setAttribute('open', '');
        }
        // The visible close control gives keyboard users an immediate action target.
        dialogCloseButton.focus();
    }

    // Close controls and backdrop clicks share the same reusable dialog lifecycle.
    dialogCloseButton.addEventListener('click', closeDialog);
    dialogElement.addEventListener('close', restoreTriggerFocus);
    dialogElement.addEventListener('click', (event) => {
        // A backdrop click targets the dialog itself rather than its inner card.
        if (event.target === dialogElement) {
            closeDialog();
        }
    });
    return showFullDescription;
}

// Each view row shows both immutable stored values and its display-only conversion.
function createReportRow(reportRow, showFullDescription) {
    const tableRow = document.createElement('tr');
    // Original and converted columns make the non-mutating conversion explicit to users.
    tableRow.append(
        createReportCell(formatReportDate(reportRow.date)),
        createDescriptionCell(reportRow.description, showFullDescription),
        createReportCell(reportRow.category),
        createReportCell(`${formatAmount(reportRow.originalSum)} ${reportRow.originalCurrency}`),
        createReportCell(`${formatAmount(reportRow.convertedSum)} ${reportRow.targetCurrency}`)
    );

    // Returning the assembled row keeps row construction separate from table insertion.
    return tableRow;
}

// Rendering replaces only report-owned DOM and leaves forms and application state untouched.
function renderDetailedReport(reportView, reportElements, showFullDescription) {
    const reportRows = reportView.rows.map((reportRow) => {
        return createReportRow(reportRow, showFullDescription);
    });
    reportElements.tableBody.replaceChildren(...reportRows);
    reportElements.totalElement.textContent = `${formatAmount(reportView.total)} ${reportView.currency}`;

    // Output and empty-state visibility continue to depend only on report row presence.
    const hasCosts = reportView.rows.length > 0;
    reportElements.outputElement.hidden = !hasCosts;
    reportElements.emptyElement.hidden = hasCosts;

    // An empty monthly result remains a successful operation with clear period feedback.
    if (!hasCosts) {
        reportElements.emptyElement.textContent = 'No costs were found for the selected month.';
    }
}

// One submission owns one synchronous DB report and one display transformation.
export function initializeDetailedReportPanel(reportElements, costsDb) {
    /* The panel coordinates one reusable description dialog with row-level preview buttons,
       keeping full stored text outside the table layout until the user requests it. */
    setDefaultPeriodSelection(reportElements.form);
    const showFullDescription = initializeDescriptionDialog(reportElements);
    let hasDisplayedReport = false;

    function updateDetailedReport() {
        showReportStatus(reportElements.statusElement, 'Creating report…', 'pending');

        // Rate-dependent work reads the manager snapshot without waiting for the network.
        try {
            const selection = readMonthlySelection(reportElements.form);
            const report = costsDb.getReport(selection.currency, selection.year, selection.month);
            const hasCurrencyConversion = report.costs.some((cost) => cost.currency !== selection.currency);

            // Identity-only reports remain available before the initial rate load completes.
            const rates = hasCurrencyConversion ? exchangeRateManager.getRates() : null;
            const reportView = buildDetailedReportView(report, selection.currency, rates);
            renderDetailedReport(reportView, reportElements, showFullDescription);
            // Successful rendering needs no extra status message beside the visible report.
            reportElements.statusElement.textContent = '';
            delete reportElements.statusElement.dataset.state;
            hasDisplayedReport = true;
        } catch (error) {
            // Missing initial rates or invalid selection produces immediate panel feedback.
            reportElements.outputElement.hidden = true;
            reportElements.emptyElement.hidden = false;
            reportElements.emptyElement.textContent = 'The detailed report could not be created.';
            showReportStatus(reportElements.statusElement, error.message, 'error');
            hasDisplayedReport = false;
        }
    }

    // Native form submission remains the only user-triggered report operation.
    function handleReportSubmit(event) {
        event.preventDefault();
        updateDetailedReport();
    }

    // Explicit Settings changes refresh only a report that the user already displayed.
    function refreshIfDisplayed() {
        if (hasDisplayedReport) {
            updateDetailedReport();
        }
    }

    // Event ownership remains local to this panel's form.
    reportElements.form.addEventListener('submit', handleReportSubmit);
    return { refreshIfDisplayed };
}
