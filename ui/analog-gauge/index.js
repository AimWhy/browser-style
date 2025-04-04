const styles = new CSSStyleSheet();
styles.replaceSync(`
	:host {
		--analog-gauge-start-angle: 235deg;
		--analog-gauge-range: 250deg;
		--analog-gauge-bdw: 10cqi;
		--analog-gauge-bg: #009, #69f, #ff0, #f90, #f00 var(--analog-gauge-range), #0000 0 var(--analog-gauge-range);
		--analog-gauge-mask-circle: radial-gradient(circle at 50% 50%, #0000 calc(50cqi - var(--analog-gauge-bdw, 10cqi)), #000 0);
		--analog-gauge-needle-bg: linear-gradient(-90deg, #222, #8a99a8bf);
		--analog-gauge-needle-h: 10cqi;
		--analog-gauge-value-mark-w: 6ch;

		--_w: calc(100cqi/3*2);
		--_vw: calc(100cqi - (2 * var(--analog-gauge-bdw, 10cqi)));
		--_m: calc(100cqi/6);

		aspect-ratio: 1;
		container-type: inline-size;
		font-family: var(--analog-clock-ff, ui-sans-serif, system-ui, sans-serif);
		display: grid;
		grid-template: repeat(3, 1fr) / repeat(3, 1fr);
		inline-size: 100%;
	}

	:host::part(gauge) {
		background: conic-gradient(from var(--analog-gauge-start-angle, 235deg), var(--analog-gauge-bg));
		border-radius: 50%;
		grid-area: 1 / 1 / 4 / 4;
		mask: var(--analog-gauge-mask-circle);
	}

	:host::part(indices) {
		all: unset;
		border-radius: 50%;
		grid-area: 1 / 1 / 4 / 4;
		rotate: var(--_ir, 0deg);
	}
	:host::part(indice) {
		background: var(--analog-gauge-indice-bg, #FFF3);
		border-radius: var(--analog-gauge-indice-bdrs, .5cqi);
		display: inline-block;
		font-size: small;
		height: var(--analog-gauge-indice-h, var(--analog-gauge-bdw, 10cqi));
		offset-anchor: top;
		offset-distance: var(--_p, 0%);
		offset-path: content-box;
		width: .25cqi;
	}

	/* === LABELS === */

	:host::part(label) {
		font-size: var(--analog-gauge-label-fs, 7.5cqi);
		font-weight: var(--analog-gauge-label-fw, 200);
		grid-area: 3 / 2 / 4 / 3;
		place-self: center center;
		text-box: ex alphabetic;
	}

	:host::part(label-min),
	:host::part(label-max) {
		font-size: var(--analog-gauge-label-fs, 5cqi);
		font-weight: var(--analog-gauge-label-fw, 400);
		place-self: center;
	}
	:host::part(label-min) { grid-area: 3 / 1 / 4 / 2;}
	:host::part(label-max) { grid-area: 3 / 3 / 4 / 4; }

	:host::part(needle) {
		align-self: center;
		background: var(--analog-gauge-needle-bg);
		clip-path: polygon(0.00% 50.00%,78.00% 0.00%,83.00% 35.00%,83.00% 65.00%,78.00% 100.00%);
		grid-area: 2 / 1 / 3 / 3;
		height: var(--analog-gauge-needle-h);
		isolation: isolate;
		mask: radial-gradient(circle at calc(100% - var(--_m)) 50%, #0000 0 2.5cqi, #FFF 2.5cqi);
		rotate: var(--_d, 0deg);
		transform-origin: calc(100% - var(--_m)) 50%;
		width: var(--_w);
	}

	:host::part(value) {
		font-size: var(--analog-gauge-value-fs, 15cqi);
		font-weight: var(--analog-gauge-value-fw, 200);
		grid-area: 3 / 2 / 4 / 3;
		place-self: start center;
		text-box: ex alphabetic;
	}

	/* === VALUE MARKS === */

	:host::part(value-marks) {
		all: unset;
		aspect-ratio: 1;
		background: var(--analog-gauge-values-bg, #0000);
		border-radius: 50%;
		box-sizing: border-box;
		grid-area: 1 / 1 / 4 / 4;
		list-style: none;
		place-self: center;
		position: relative;
		width: var(--_vw);
	}
	:host::part(value-mark) {
		--_r: calc((var(--_vw) - var(--analog-gauge-value-mark-w)) / 2);
		--_x: calc(var(--_r) + (var(--_r) * cos(var(--_d))));
		--_y: calc(var(--_r) + (var(--_r) * sin(var(--_d))));
		aspect-ratio: var(--analog-gauge-value-mark-asr, 1);
		color: var(--analog-gauge-value-mark-c, #0006);
		display: grid;
		font-size: var(--analog-gauge-value-mark-fs, 3cqi);
		font-weight: var(--analog-gauge-value-mark-fw, 400);
		left: var(--_x);
		place-content: center;
		position: absolute;
		top: var(--_y);
		width: var(--analog-gauge-value-mark-w);
	}
`);

export default class AnalogGauge extends HTMLElement {
	static get observedAttributes() {
		return ['value'];
	}
	
	#root; #units; #value; 
	constructor() {
		super();
		this.#root = this.attachShadow({ mode: 'open' });
		this.#root.adoptedStyleSheets = [styles];
		const computedStyle = getComputedStyle(this);

		this.#units = {
			defaultMark: 90,
			defaultNeedle: 270,
			max: parseInt(this.getAttribute('max') || 100),
			min: parseInt(this.getAttribute('min') || 0),
			range: parseFloat(computedStyle.getPropertyValue("--analog-gauge-range")) || 250,
			suffix: this.getAttribute('suffix') || '',
			start: parseFloat(computedStyle.getPropertyValue("--analog-gauge-start-angle")) || 235,
			value: parseFloat(this.getAttribute('value') || 0)
		}

		this.#units.minDegree = this.#units.start - this.#units.defaultNeedle;
		this.#units.totalRange = this.#units.range;

		this.#root.innerHTML = `
			<div part="gauge"></div>
			${this.#generateIndices()}
			${this.#generateValueMarks()}
			<div part="needle"></div>
			<div part="value"></div>
			<div part="label">${this.getAttribute('label')||''}</div>
			<div part="label-min">${this.getAttribute('min-label')||''}</div>
			<div part="label-max">${this.getAttribute('max-label')||''}</div>`;

		this.#value = this.#root.querySelector('[part="value"]');
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (name === 'value' && oldValue !== newValue) {
			this.#units.value = parseFloat(newValue || 0);
			this.#update();
		}
	}

	#generateIndices() {
		const count = parseInt(this.getAttribute('indices'));
		if (isNaN(count) || count <= 0) return '';
		const step = 100 / (360/this.#units.range) / count;
		return `
		<ul part="indices" style="--_ir:-${this.#units.totalRange/2}deg">${
			Array.from({ length: count }, (_, i) => {
				const position = i * step;
				return `<li style="--_p:${position}%" part="indice"></li>`;
			}).join('')}
		</ul>`;
	}

	#generateValueMarks() {
		if (!this.hasAttribute('values')) return '';
		const count = parseInt(this.getAttribute('values'));
		if (isNaN(count) || count <= 0) return '';
		const degreeStep = this.#units.range / (count - 1 || 1);
		
		return `
		<ul part="value-marks">
			${Array.from({ length: count }, (_, i) => {
				const degree = this.#units.start - this.#units.defaultMark + (i * degreeStep);
				const value = Math.round(this.#units.min + (i * (this.#units.max - this.#units.min) / (count - 1 || 1)));
				return `<li style="--_d:${degree}deg" part="value-mark">${value}</li>`;
			}).join('')}
		</ul>`;
	}

	#update() {
		const normalizedValue = Math.max(this.#units.min, Math.min(this.#units.max, this.#units.value));
		const valuePercentage = (normalizedValue - this.#units.min) / (this.#units.max - this.#units.min);
		const degree = this.#units.minDegree + (valuePercentage * this.#units.totalRange);
		this.style.setProperty('--analog-gauge-value', `${valuePercentage * this.#units.range}deg`);
		this.style.setProperty('--_d', `${degree}deg`);
		this.#value.textContent = this.#units.value + this.#units.suffix;
	}
}

customElements.define('analog-gauge', AnalogGauge);