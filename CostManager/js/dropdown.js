let dropdownSequence = 0;

// Stable generated IDs connect each visible trigger to its owned listbox.
function createDropdownId(prefix) {
    dropdownSequence += 1;
    return `${prefix}-${dropdownSequence}`;
}

// Field labels provide useful context and retain their normal focus behavior.
function getControlLabel(control) {
    if (control.id === '') {
        return null;
    }

    return Array.from(control.ownerDocument.querySelectorAll('label'))
        .find((label) => label.htmlFor === control.id) ?? null;
}

// Shared option buttons keep select and datalist menus visually and semantically consistent.
function createOptionButton(documentReference, label, value) {
    const optionButton = documentReference.createElement('button');
    optionButton.type = 'button';
    optionButton.className = 'custom-dropdown-option';
    optionButton.dataset.value = value;
    optionButton.textContent = label;
    // Listbox roles expose the relationship between the menu and each choice.
    optionButton.setAttribute('role', 'option');
    return optionButton;
}

// Keyboard navigation moves only among options that remain visible after filtering.
function moveOptionFocus(menu, currentOption, direction) {
    const visibleOptions = Array.from(menu.querySelectorAll('.custom-dropdown-option'))
        .filter((option) => !option.hidden);

    // Empty filtered menus have no focus target and require no keyboard action.
    if (visibleOptions.length === 0) {
        return;
    }

    const currentIndex = visibleOptions.indexOf(currentOption);
    const nextIndex = (currentIndex + direction + visibleOptions.length) % visibleOptions.length;
    visibleOptions[nextIndex].focus();
}

// Menu keyboard behavior follows standard listbox movement and dismissal conventions.
function bindMenuKeyboard(menu, closeMenu) {
    menu.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const direction = event.key === 'ArrowDown' ? 1 : -1;
            moveOptionFocus(menu, event.target, direction);
        }

        // Escape returns control to the trigger or input that opened the menu.
        if (event.key === 'Escape') {
            event.preventDefault();
            closeMenu(true);
        }
    });
}

function enhanceSelect(selectElement) {
    /* Progressive enhancement leaves the native select authoritative and mirrors its state
       into a fully styleable trigger and listbox without changing form submission behavior. */
    // Repeated application initialization must never wrap the same select twice.
    if (selectElement.dataset.dropdownEnhanced === 'true') {
        return;
    }

    const documentReference = selectElement.ownerDocument;
    // Separate nodes give the selected value, arrow, and menu independent styling roles.
    const wrapper = documentReference.createElement('div');
    const trigger = documentReference.createElement('button');
    const selectedText = documentReference.createElement('span');
    const chevron = documentReference.createElement('span');
    const menu = documentReference.createElement('div');
    const menuId = createDropdownId('select-listbox');
    const controlLabel = getControlLabel(selectElement);

    // Custom markup sits beside a visually hidden select that still owns form values.
    wrapper.className = 'custom-dropdown';
    trigger.type = 'button';
    trigger.className = 'custom-dropdown-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', menuId);
    // The value and decorative chevron remain distinct inside the trigger.
    selectedText.className = 'custom-dropdown-value';
    chevron.className = 'custom-dropdown-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    menu.id = menuId;
    menu.className = 'custom-dropdown-menu';
    menu.setAttribute('role', 'listbox');
    menu.hidden = true;

    // A stable button collection supports selection mirroring and keyboard focus.
    const optionButtons = Array.from(selectElement.options).map((option) => {
        const optionButton = createOptionButton(documentReference, option.textContent, option.value);
        menu.append(optionButton);
        return optionButton;
    });

    // Synchronization reflects native defaults, resets, and external value changes.
    function synchronizeSelection() {
        const selectedOption = selectElement.options[selectElement.selectedIndex];
        selectedText.textContent = selectedOption ? selectedOption.textContent : '';
        const labelText = controlLabel?.textContent.trim();
        // The visible trigger retains both the field label and current value for assistive tools.
        trigger.setAttribute('aria-label', labelText
            ? `${labelText}: ${selectedText.textContent}`
            : selectedText.textContent);
        trigger.disabled = selectElement.disabled;

        // Exactly one custom option mirrors the native select's current value.
        optionButtons.forEach((optionButton) => {
            const isSelected = optionButton.dataset.value === selectElement.value;
            optionButton.classList.toggle('is-selected', isSelected);
            optionButton.setAttribute('aria-selected', String(isSelected));
        });
    }

    // Closing is centralized so every interaction updates the same three state indicators.
    function closeMenu(shouldRestoreFocus = false) {
        menu.hidden = true;
        wrapper.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');

        // Keyboard dismissal restores focus without changing the selected value.
        if (shouldRestoreFocus) {
            trigger.focus();
        }
    }

    function openMenu() {
        // Open state drives both accessibility attributes and the component's visual treatment.
        menu.hidden = false;
        wrapper.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
    }

    // Trigger clicks toggle only presentation and never alter the selected value.
    trigger.addEventListener('click', () => {
        if (menu.hidden) {
            openMenu();
        } else {
            closeMenu();
        }
    });

    // Arrow keys open the list and move focus to the current selection.
    trigger.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            openMenu();
            // Focus begins at the selected value, with the first option as a safe fallback.
            const selectedButton = menu.querySelector('.is-selected') ?? optionButtons[0];
            selectedButton?.focus();
        }
    });

    // Choosing an option updates native state before notifying existing application listeners.
    optionButtons.forEach((optionButton) => {
        optionButton.addEventListener('click', () => {
            selectElement.value = optionButton.dataset.value;
            selectElement.dispatchEvent(new Event('change', { bubbles: true }));
            closeMenu(true);
        });
    });

    // Clicking the original label now focuses the visible replacement control.
    controlLabel?.addEventListener('click', (event) => {
        event.preventDefault();
        trigger.focus();
    });

    // Clicks elsewhere dismiss this menu without affecting form state.
    documentReference.addEventListener('click', (event) => {
        if (!wrapper.contains(event.target)) {
            closeMenu();
        }
    });
    // Native changes and form resets are mirrored even when another module initiates them.
    bindMenuKeyboard(menu, closeMenu);
    selectElement.addEventListener('change', synchronizeSelection);
    selectElement.form?.addEventListener('reset', () => {
        queueMicrotask(synchronizeSelection);
        closeMenu();
    });

    // Final assembly hides the native presentation only after its replacement is ready.
    selectElement.classList.add('native-dropdown-control');
    selectElement.dataset.dropdownEnhanced = 'true';
    selectElement.tabIndex = -1;
    selectElement.after(wrapper);
    trigger.append(selectedText, chevron);
    wrapper.append(trigger, menu);
    // Initial synchronization displays the value already selected by application setup.
    synchronizeSelection();
}

function enhanceDatalistInput(inputElement) {
    /* The editable combobox uses datalist options only as initial suggestion data, allowing
       the browser-owned popup to be removed without restricting user-entered categories. */
    // Enhancement proceeds only when the input points to an available datalist source.
    const listId = inputElement.getAttribute('list');
    const datalist = listId ? inputElement.ownerDocument.getElementById(listId) : null;

    if (!datalist || inputElement.dataset.dropdownEnhanced === 'true') {
        return;
    }

    // These nodes replace only the suggestion UI; the original input remains in the form.
    const documentReference = inputElement.ownerDocument;
    const wrapper = documentReference.createElement('div');
    const chevron = documentReference.createElement('span');
    const menu = documentReference.createElement('div');
    const menuId = createDropdownId('suggestion-listbox');
    // Datalist values become buttons while the datalist itself remains unchanged as source data.
    const optionButtons = Array.from(datalist.options).map((option) => {
        return createOptionButton(documentReference, option.value, option.value);
    });

    // Removing list disables the unstyleable native popup while retaining its source options.
    inputElement.removeAttribute('list');
    inputElement.autocomplete = 'off';
    // Browser-saved form suggestions must not compete with the custom category menu.
    inputElement.dataset.dropdownEnhanced = 'true';
    inputElement.classList.add('custom-dropdown-input');
    inputElement.setAttribute('role', 'combobox');
    inputElement.setAttribute('aria-autocomplete', 'list');
    inputElement.setAttribute('aria-expanded', 'false');
    inputElement.setAttribute('aria-controls', menuId);
    // Shared classes make the editable and fixed-value variants visually consistent.
    wrapper.className = 'custom-dropdown custom-combobox';
    chevron.className = 'custom-dropdown-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    menu.id = menuId;
    menu.className = 'custom-dropdown-menu';
    menu.setAttribute('role', 'listbox');
    // Suggestions start closed and open only through input interaction.
    menu.hidden = true;
    optionButtons.forEach((optionButton) => menu.append(optionButton));

    // The editable variant returns focus to its input after keyboard or option dismissal.
    function closeMenu(shouldRestoreFocus = false) {
        menu.hidden = true;
        wrapper.classList.remove('is-open');
        inputElement.setAttribute('aria-expanded', 'false');

        // Mouse dismissal leaves focus untouched while keyboard dismissal restores it.
        if (shouldRestoreFocus) {
            inputElement.focus();
        }
    }

    // Filtering keeps partial free-text entry useful without inventing new stored values.
    function showOptions(filterText = '') {
        const normalizedFilter = filterText.trim().toLowerCase();
        let hasVisibleOptions = false;

        optionButtons.forEach((optionButton) => {
            // Case-insensitive substring matching keeps filtering predictable while typing.
            const isVisible = optionButton.textContent.toLowerCase().includes(normalizedFilter);
            optionButton.hidden = !isVisible;
            hasVisibleOptions = hasVisibleOptions || isVisible;
        });

        // An empty match set closes the menu and its associated expanded state.
        menu.hidden = !hasVisibleOptions;
        wrapper.classList.toggle('is-open', hasVisibleOptions);
        inputElement.setAttribute('aria-expanded', String(hasVisibleOptions));
    }

    // Click reveals all suggestions, while subsequent typing narrows the same menu.
    inputElement.addEventListener('click', () => showOptions());
    inputElement.addEventListener('input', () => showOptions(inputElement.value));
    inputElement.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') {
            // Down Arrow transfers focus from editable text to the first matching suggestion.
            event.preventDefault();
            showOptions(inputElement.value);
            menu.querySelector('.custom-dropdown-option:not([hidden])')?.focus();
        }

        // Escape dismisses suggestions without changing the user's typed category.
        if (event.key === 'Escape') {
            closeMenu();
        }
    });

    // Suggestion selection emits the ordinary input and change contract used by forms.
    optionButtons.forEach((optionButton) => {
        optionButton.addEventListener('click', () => {
            // Value assignment precedes events so every listener observes the chosen category.
            inputElement.value = optionButton.dataset.value;
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
            closeMenu(true);
        });
    });

    // Outside clicks and form resets consistently dismiss leftover suggestion menus.
    documentReference.addEventListener('click', (event) => {
        if (!wrapper.contains(event.target)) {
            closeMenu();
        }
    });
    bindMenuKeyboard(menu, closeMenu);
    inputElement.form?.addEventListener('reset', () => closeMenu());

    // Moving the original input into its wrapper preserves its identity and attached listeners.
    inputElement.before(wrapper);
    wrapper.append(inputElement, chevron, menu);
}

// Enhance every supported native control after forms have established their initial values.
export function initializeDropdowns(root = document) {
    /* Progressive enhancement keeps native selects as the authoritative form state while
       custom triggers and listboxes provide a fully styleable visual interaction layer. */
    root.querySelectorAll('select').forEach(enhanceSelect);
    root.querySelectorAll('input[list]').forEach(enhanceDatalistInput);
}
