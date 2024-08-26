import { createDataEntryInstance } from './modules/factory.js';
import { bindUtilityEvents, convertValue, isEmpty, getObjectByPath, setObjectByPath } from './modules/utility.js';
import { validateData as defaultValidateData } from './modules/validate.js';
import { AutoSuggest } from '/ui/autosuggest/index.js';
import { RichText } from '/ui/rich-text/richtext.js';

/**
 * Data Entry
 * A custom web component for dynamically rendering and managing form entries based on a provided JSON schema and data.
 * This class supports automatic form rendering, data binding, schema validation, and custom event handling.
 * @author Mads Stoumann
 * @version 1.0.12
 * @summary 23-08-2024
 * @class
 * @extends {HTMLElement}
 */
class DataEntry extends HTMLElement {
	static observedAttributes = ['data', 'lookup', 'validation', 'debug'];

	constructor() {
		super();
		this.form = document.createElement('form');
		this.form.method = 'POST';
		this.form.action = this.getAttribute('action');
		this.form.part = 'form';
		this.instance = createDataEntryInstance(this);
		this.customValidateData = null;
		this._data = null;
		this._schema = null;
		this._lookup = null;
	}

	async connectedCallback() {
		if (this.hasAttribute('shadow')) {
			const shadow = this.attachShadow({ mode: 'open' });
			shadow.appendChild(this.form);
		} else {
			this.appendChild(this.form);
		}

		this.form.addEventListener('input', (event) => this.syncInstanceData(event));

		if (this.data && this.schema) {
			this.instance.data = this.data;
			this.instance.schema = this.schema;
			this.renderAll();
		} else {
			await this.loadResources();
			if (isEmpty(this.instance.data) || isEmpty(this.instance.schema)) {
				this.debugLog('Data or schema is empty. Skipping render.');
				return;
			}

			if (this.instance.data && this.instance.schema) {
				if (this.shouldValidate()) {
					const validationResult = await this.validateData();
					if (!validationResult.valid) {
						return;
					}
				}
				this.renderAll();
			}
		}
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (!newValue || oldValue === newValue) return;
		if (name === 'lookup') {
			this.lookup = newValue;
		}
	}

	addArrayEntry(element, path, insertBeforeSelector = `[part="nav"]`) {
		const form = element.form;
		const formElements = Array.from(form.elements).filter(el => el.name.startsWith(`${path}.`));

		// Temporarily enable disabled fields for validation
		formElements.forEach(el => {
			if (el.disabled) {
				el.disabled = false;
				el.dataset.wasDisabled = 'true';
			}
		});
		const isValid = form.checkValidity();
	
		// Re-disable the fields that were originally disabled
		formElements.forEach(el => {
			if (el.dataset.wasDisabled === 'true') {
				el.disabled = true;
				delete el.dataset.wasDisabled; // Clean up the tracking attribute
			}
		});
	
		if (!isValid) {
			this.debugLog('Form is invalid, cannot add entry.');
			return;
		}
	
		const array = getObjectByPath(this.instance.data, path);
		if (!Array.isArray(array)) {
			this.debugLog(`Path "${path}" does not reference an array in the data.`);
			return;
		}
	
		const fieldset = this.form.querySelector(`fieldset[name="${path}-entry"]`);
		const schema = getObjectByPath(this.instance.schema, `properties.${path}`);
		
		if (!fieldset || !schema) {
			this.debugLog(`Fieldset with path "${path}" or schema not found.`);
			return;
		}
	
		const newObject = {};
		formElements.forEach(el => {
			const fieldPath = el.name.slice(path.length + 1);
			const dataType = el.dataset.type || 'string';
			newObject[fieldPath] = convertValue(el.value, dataType, el.type, el.checked);
		});
	
		array.push(newObject);
	
		const newDetail = this.instance.methods.detail({
			value: newObject,
			config: schema,
			path: `${path}[${array.length - 1}]`,
			instance: this.instance,
			attributes: []
		});
	
		const siblingElm = fieldset.querySelector(insertBeforeSelector);
	
		if (siblingElm) {
			siblingElm.insertAdjacentHTML('beforebegin', newDetail);
		} else {
			this.debugLog(`Element with selector "${insertBeforeSelector}" not found within the fieldset.`);
			return;
		}
	
		form.reset();
	
		const popover = this.form.querySelector(`#${form.dataset.popover}`);
		if (popover) popover.hidePopover();
		this.debugLog('Updated data:', this.instance.data);
	}

	bindAutoSuggestEvents() {
		const autoSuggestElements = this.form.querySelectorAll('auto-suggest');
		autoSuggestElements.forEach(autoSuggest => {
			autoSuggest.addEventListener('autoSuggestSelect', (event) => {
				const detail = event.detail;
				console.log(detail);
				const formName = autoSuggest.getAttribute('form') ;
				const path = autoSuggest.getAttribute('name');
				const mapping = autoSuggest.dataset.mapping;
	
				if (mapping) {
					const mappingObj = JSON.parse(mapping);
	
					Object.keys(mappingObj).forEach((field) => {
						const mappedKeyPath = mappingObj[field];
						const mappedValue = getObjectByPath(detail, mappedKeyPath);
						const inputName = `${path}.${field}`;
						const input = formName ? document.forms[formName].elements[inputName] : this.form.elements[inputName];
						
						if (input) {
							input.value = mappedValue || '';
							input.setCustomValidity('');
							if (!input.checkValidity()) {
								input.reportValidity();
							}
						}
					});
				}
			});
		});
		console.log(this.instance.data);
	}

	debugLog(...args) {
		if (this.hasAttribute('debug')) {
			console.log(...args);
		}
	}

	async fetchResource(attribute) {
		const url = this.getAttribute(attribute);
		if (!url) return null;

		try {
			const response = await fetch(url);
			return await response.json();
		} catch (error) {
			this.debugLog(`Error fetching ${attribute}:`, error);
			return null;
		}
	}

	async loadResources() {
		this.data = await this.fetchResource('data');
		this.schema = await this.fetchResource('schema');
		this.lookup = await this.fetchResource('lookup') || this.lookup;
	}

	removeArrayEntry(element, path) {
		const obj = getObjectByPath(this.instance.data, path);
		if (obj) {
			if (element.checked === false) {
				obj._remove = true;
				this.debugLog('Marked object for removal:', obj);
			} else {
				delete obj._remove;
				this.debugLog('Removed object from removal:', obj);
			}
		} else {
			this.debugLog(`No object found at path: ${path}`);
		}
	}

	renderAll() {
		if (isEmpty(this.instance.data) || isEmpty(this.instance.schema)) {
			this.debugLog('Data or schema is empty. Skipping render.');
			return;
		}
		this.form.innerHTML = this.instance.methods.all(this.instance.data, this.instance.schema, this.instance, true);
		bindUtilityEvents(this.form, this);
		this.bindAutoSuggestEvents();
	}

	shouldValidate() {
		return this.getAttribute('validation') === 'true';
	}

	syncInstanceData(event) {
		const { form, name, value, type, checked } = event.target;
		if (!name) return;
		if (form !== this.form) return;

		const dataType = event.target.dataset.type;
		setObjectByPath(this.instance.data, name, convertValue(value, dataType, type, checked));
		this.debugLog('Updated data:', this.instance.data);
	}

	async validateData() {
		const validateData = this.customValidateData || defaultValidateData;
		return validateData(this.instance.schema, this.instance.data);
	}

	// Getter and setters
	set data(data) {
		this._data = data;
		this.instance.data = data;
	}

	get data() {
		return this._data;
	}

	set schema(schema) {
		this._schema = schema;
		this.instance.schema = schema;
	}

	get schema() {
		return this._schema;
	}

	set lookup(lookup) {
		this._lookup = lookup;
		this.instance.lookup = lookup;
	}

	get lookup() {
		return this._lookup;
	}
}

/* Register element/s */
if (!customElements.get('auto-suggest')) {
	customElements.define('auto-suggest', AutoSuggest);
}
if (!customElements.get('rich-text')) {
	customElements.define('rich-text', RichText);
}
customElements.define('data-entry', DataEntry);

export default { DataEntry };
