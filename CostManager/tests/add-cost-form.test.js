import { jest } from '@jest/globals';
import db from '../js/db.module.js';
import { buildCostFromForm, initializeAddCostForm } from '../js/add-cost-form.js';

// The compact fixture contains only the browser controls owned by the Add Cost module.
function renderAddCostForm() {
    // Controls cover every field and supported currency, plus submission and live feedback.
    document.body.innerHTML = [
        '<form id="add-cost-form">',
        '<input name="sum" type="number">',
        '<select name="currency">',
        '<option value="USD">USD</option>',
        '<option value="ILS">ILS</option>',
        '<option value="GBP">GBP</option>',
        // Build the test fixture required for this scenario.
        '<option value="EURO">EURO</option>',
        '</select>',
        '<input name="category" type="text">',
        '<textarea name="description"></textarea>',
        '<button type="submit">Add Cost</button>',
        '</form>',
        // Build the test fixture required for this scenario.
        '<p id="add-cost-status"></p>'
    ].join('');

    // Returning both owned nodes keeps individual test setup explicit.
    return {
        costForm: document.getElementById('add-cost-form'),
        statusElement: document.getElementById('add-cost-status')
    };
}

// Form helpers keep boundary conversion and DOM behavior independently observable.
describe('Add Cost form', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('buildCostFromForm converts browser strings into the database contract', () => {
        const { costForm } = renderAddCostForm();

        // String assignments reproduce values supplied by browser form controls.
        costForm.elements.sum.value = '27.50';
        costForm.elements.currency.value = 'ILS';
        costForm.elements.category.value = '  Food  ';
        costForm.elements.description.value = '  Fresh vegetables  ';

        // Numeric conversion and normalized text complete the exact addCost input shape.
        expect(buildCostFromForm(costForm)).toEqual({
            sum: 27.5,
            currency: 'ILS',
            category: 'Food',
            description: 'Fresh vegetables'
        });
    });

    // Configure the valid baseline state before exercising the targeted case.
    test('buildCostFromForm rejects zero and negative sums', () => {
        const { costForm } = renderAddCostForm();
        costForm.elements.currency.value = 'USD';
        costForm.elements.category.value = 'Food';
        costForm.elements.description.value = 'Lunch';

        // A cost amount must be strictly positive after conversion from the form string.
        costForm.elements.sum.value = '0';
        expect(() => buildCostFromForm(costForm)).toThrow('Enter a cost sum greater than 0');
        costForm.elements.sum.value = '-5';
        expect(() => buildCostFromForm(costForm)).toThrow('Enter a cost sum greater than 0');
    });

    // Configure the valid baseline state before exercising the targeted case.
    test('buildCostFromForm rejects empty and whitespace-only text fields', () => {
        const { costForm } = renderAddCostForm();
        costForm.elements.sum.value = '12';
        costForm.elements.currency.value = 'USD';

        // Trimming prevents visually blank category and description values from passing.
        costForm.elements.category.value = '';
        costForm.elements.description.value = 'Lunch';
        expect(() => buildCostFromForm(costForm)).toThrow('Enter a category');
        costForm.elements.category.value = '   ';
        expect(() => buildCostFromForm(costForm)).toThrow('Enter a category');

        // Change only the input that this test is intended to validate.
        costForm.elements.category.value = 'Food';
        costForm.elements.description.value = '';
        expect(() => buildCostFromForm(costForm)).toThrow('Enter a description');
        costForm.elements.description.value = '   ';
        expect(() => buildCostFromForm(costForm)).toThrow('Enter a description');
    });

    // This integration case verifies the UI boundary against the real storage implementation.
    test('submitting the form persists the cost and keeps its original currency', () => {
        const { costForm, statusElement } = renderAddCostForm();
        const costsDb = db.openCostsDB('ui-test', 1);
        const onCostAdded = jest.fn();
        initializeAddCostForm(costForm, statusElement, costsDb, onCostAdded);

        // The submitted values include a non-default currency to expose accidental conversion.
        costForm.elements.sum.value = '84.25';
        costForm.elements.currency.value = 'GBP';
        costForm.elements.category.value = 'Education';
        costForm.elements.description.value = 'Course book';
        costForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

        // Integration with the actual database verifies the stored Phase 3 values and date.
        const storedCosts = JSON.parse(localStorage.getItem('costsdb_ui-test'));
        expect(storedCosts).toHaveLength(1);
        // Text values must survive the UI-to-storage integration unchanged.
        expect(storedCosts[0]).toMatchObject({
            sum: 84.25,
            currency: 'GBP',
            category: 'Education',
            description: 'Course book'
        });
        // The database, rather than the form, owns all date components.
        expect(storedCosts[0].date).toEqual({
            day: expect.any(Number),
            month: expect.any(Number),
            year: expect.any(Number)
        });

        // Successful persistence clears the input and reports the exact original currency.
        expect(costForm.elements.sum.value).toBe('');
        expect(costForm.elements.currency.value).toBe('USD');
        expect(statusElement.dataset.state).toBe('success');
        expect(statusElement.textContent).toContain('84.25 GBP');
        expect(onCostAdded).toHaveBeenCalledTimes(1);

        // Success remains initially, then a later click elsewhere dismisses only that message.
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(statusElement.textContent).toBe('');
        expect(statusElement.dataset.state).toBeUndefined();
    });

    // Validation failure must stop before the mocked database boundary.
    test('invalid input is reported without calling the database', () => {
        const { costForm, statusElement } = renderAddCostForm();
        const costsDb = { addCost: jest.fn() };
        const onCostAdded = jest.fn();
        initializeAddCostForm(costForm, statusElement, costsDb, onCostAdded);

        // Populate every field except sum to isolate the intended validation failure.
        costForm.elements.currency.value = 'USD';
        costForm.elements.category.value = 'Food';
        costForm.elements.description.value = 'Lunch';
        costForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

        // Blank sum validation runs before any persistence side effect.
        expect(costsDb.addCost).not.toHaveBeenCalled();
        // Failed validation cannot notify chart orchestration about a stored cost.
        expect(onCostAdded).not.toHaveBeenCalled();
        expect(statusElement.dataset.state).toBe('error');
        expect(statusElement.textContent).toBe('Enter a cost sum');

        // Page clicks must not dismiss validation feedback intended for user correction.
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(statusElement.textContent).toBe('Enter a cost sum');
    });

    // Persistence errors must preserve the fields needed for a retry.
    test('a database failure remains visible and preserves the entered fields', () => {
        const { costForm, statusElement } = renderAddCostForm();
        const costsDb = { addCost: jest.fn(() => { throw new Error('Storage is unavailable'); }) };
        initializeAddCostForm(costForm, statusElement, costsDb);

        // Complete input ensures this case reaches the mocked persistence failure.
        costForm.elements.sum.value = '12';
        costForm.elements.currency.value = 'EURO';
        costForm.elements.category.value = 'Food';
        costForm.elements.description.value = 'Coffee';
        costForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

        // A failed write never resets recoverable user input.
        expect(costForm.elements.sum.value).toBe('12');
        expect(costForm.elements.currency.value).toBe('EURO');
        expect(statusElement.dataset.state).toBe('error');
        expect(statusElement.textContent).toBe('Storage is unavailable');
    });
});
