import { dataEntry } from './modules/main.js';
import { bindUtilityEvents } from './modules/utility.js';
import { uiRichText } from '/ui/rich-text/uiRichText.js';
/**
 * Data Entry
 * description
 * @author Mads Stoumann
 * @version 1.0.02
 * @summary 11-06-2024
 * @class
 * @extends {HTMLElement}
 */
class DataEntry extends HTMLElement {
	static observedAttributes = ['data'];
	constructor() {
		super();
		this.data = {};
		this.schema = {};
		this.form = document.createElement('form');
		this.form.method = 'POST';
		this.form.action = this.getAttribute('action');
		this.form.part = 'form';
	}

	async connectedCallback() {
		await this.fetchSchema();
		await this.fetchData();

		if (this.hasAttribute('shadow')) {
			const shadow = this.attachShadow({ mode: 'open' });
			shadow.appendChild(this.form);
		}
		else {
			this.appendChild(this.form);
		}
		if (this.data && this.schema) {
			this.renderAll();
		}
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (!newValue || oldValue === newValue) return;
		// console.log(`Attribute: ${name} changed from ${oldValue} to ${newValue}`);
	}

	async fetchData() {
		const dataUrl = this.getAttribute('data');
		if (!dataUrl) return;
		this.data = await (await fetch(dataUrl)).json();
	}

	async fetchSchema() {
		const schemaUrl = this.getAttribute('schema');
		if (!schemaUrl) return;
		this.schema = await (await fetch(schemaUrl)).json();
	}

	renderAll() {
		dataEntry.data = this.data;
		dataEntry.schema = this.schema;
		dataEntry.parent = this;
		this.form.innerHTML = dataEntry.methods.all(dataEntry.data, dataEntry.schema, true);
		bindUtilityEvents(this.form);
	}
}
/* Register element/s */
if (!customElements.get('ui-richtext')) {
  customElements.define('ui-richtext', uiRichText);
}
customElements.define('data-entry', DataEntry);