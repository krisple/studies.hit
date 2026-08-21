import { jest } from '@jest/globals';
import { initializeDropdowns } from '../js/dropdown.js';

// Test markup contains both supported native controls and their original form semantics.
function renderDropdownForm() {
    document.body.innerHTML = [
        '<form id="cost-form">',
        '<label for="currency">Currency</label>',
        '<select id="currency" name="currency">',
        // Two values verify that selection moves away from the initial default.
        '<option value="USD" selected>USD</option>',
        '<option value="ILS">ILS</option>',
        '</select>',
        // Category remains a free-text field even when a suggestion is chosen.
        '<label for="category">Category</label>',
        '<input id="category" name="category" list="categories">',
        '<datalist id="categories">',
        '<option value="Food"></option>',
        '<option value="Housing"></option>',
        '</datalist>',
        // Closing the form completes one shared owner for select and category state.
        '</form>'
    ].join('');
}

// Each test starts with a newly enhanced form so custom state cannot leak between cases.
describe('custom dropdown enhancement', () => {
    beforeEach(() => {
        renderDropdownForm();
        initializeDropdowns(document);
    });

    // Selection through the replacement must preserve existing change-based integrations.
    test('custom select updates the authoritative native select and emits change', () => {
        const nativeSelect = document.getElementById('currency');
        const trigger = document.querySelector('.custom-dropdown-trigger');
        const menu = trigger.nextElementSibling;
        const changeListener = jest.fn();
        nativeSelect.addEventListener('change', changeListener);

        // Opening and choosing occurs entirely through the light custom menu.
        trigger.click();
        expect(menu.hidden).toBe(false);
        menu.querySelector('[data-value="ILS"]').click();

        // The hidden control, visible label, emitted event, and menu state stay synchronized.
        expect(nativeSelect.value).toBe('ILS');
        expect(trigger.textContent).toContain('ILS');
        expect(changeListener).toHaveBeenCalledTimes(1);
        expect(menu.hidden).toBe(true);
    });

    // The editable category variant must suppress the browser's native datalist presentation.
    test('datalist input uses custom suggestions while preserving free-text events', () => {
        const categoryInput = document.getElementById('category');
        const wrapper = categoryInput.closest('.custom-combobox');
        const menu = wrapper.querySelector('.custom-dropdown-menu');
        const inputListener = jest.fn();
        categoryInput.addEventListener('input', inputListener);

        // Removing list is what prevents the browser-owned dark suggestion popup.
        expect(categoryInput.hasAttribute('list')).toBe(false);
        expect(categoryInput.autocomplete).toBe('off');
        categoryInput.click();
        expect(menu.hidden).toBe(false);
        menu.querySelector('[data-value="Food"]').click();

        // A suggestion behaves like ordinary text input and closes after selection.
        expect(categoryInput.value).toBe('Food');
        expect(inputListener).toHaveBeenCalledTimes(1);
        expect(menu.hidden).toBe(true);
    });
});
