import { attrs, fetchOptions, getObjectByPath, isEmpty, setObjectByPath, resolveTemplateString, safeRender, t, toCamelCase, uuid } from './utility.js';

/* === all === */

export function all(data, schema, instance, root = false, pathPrefix = '', form = null) {
	const nonArrayContent = [];
	const arrayContent = [];
	const renderNav = schema.navigation;
	const headline = schema.headline ? resolveTemplateString(schema.headline, data, instance.lang, instance.i18n) : '';
	const title = schema.title ? resolveTemplateString(schema.title, data, instance.lang, instance.i18n) : '';
	let navContent = '';

	// Iterate over schema properties
	Object.entries(schema.properties).forEach(([key, config]) => {
		const attributes = config?.render?.attributes || [];
		const method = config?.render?.method ? toCamelCase(config.render.method) : '';
		const renderMethod = instance.getRenderMethod(method);
		const label = resolveTemplateString(config.title, data, instance.lang, instance.i18n) || 'LABEL';
		const options = method === 'select' ? fetchOptions(config, instance) : [];
		const path = pathPrefix === 'DISABLE_PATH' ? '' : (pathPrefix ? `${pathPrefix}.${key}` : key);

		// Handle different data types (object, array, others)
		if (config.type === 'object') {
			const content = all(data[key], config, instance, false, path);
			const objectContent = config.render && method
				? safeRender(renderMethod, { label, value: data[key], attributes, options, config, instance, path, type: config.type })
				: fieldset({ label, content, attributes });
			nonArrayContent.push(objectContent);
		} else if (config.type === 'array') {
			if (renderNav) {
				navContent += `<a href="#section_${path}" part="link">${label}</a>`;
			}
			const content = method
				? safeRender(renderMethod, { label, value: data[key], attributes, options, config, instance, path, type: config.type })
				: data[key].map((item, index) => all(item, config.items, instance, false, `${path}[${index}]`)).join('');
			arrayContent.push(method ? content : fieldset({ label, content, attributes }));
		} else {
			nonArrayContent.push(method
				? safeRender(renderMethod, { label, value: data[key], attributes, options, config, instance, path, type: config.type })
				: '');
		}
	});

	const fieldsetContent = (root && nonArrayContent.length)
		? `<fieldset part="fieldset" id="section_root">${title ? `<legend part="legend">${title}</legend>` : ''}${nonArrayContent.join('')}</fieldset>`
		: nonArrayContent.join('');
	const arrayContentHtml = arrayContent.join('');
	const innerContent = `${fieldsetContent} ${arrayContentHtml}`;

	if (form || root) {
		const navElement = renderNav ? `<nav part="${renderNav}">${title ? `<a href="#section_root" part="link">${title}</a>`:''}${navContent}</nav>` : '';
		const headlineElement = headline ? `<strong part="title">${headline}</strong>` : '';
		const headerContent = (headlineElement || navElement) ? `<header part="header">${navElement}${headlineElement}</header>` : '';
		let footerContent = `<ui-toast></ui-toast>`;

		if (schema.form) {
			// Set root-level form attributes if available
			if (schema.form.action) {
				form.setAttribute('action', schema.form.action);
			}
			if (schema.form.method) {
				form.setAttribute('method', schema.form.method);
			}
			if (schema.form.enctype) {
				const formEnctype = schema.form.enctype === 'json' ? 'application/json' 
					: schema.form.enctype === 'form' ? 'multipart/form-data' 
					: schema.form.enctype;
				form.setAttribute('enctype', formEnctype);
			}
			if (schema.form.autoSave !== undefined) {
				form.setAttribute('data-auto-save', schema.form.autoSave);
			}
		
			// Generate buttons from the form.buttons array
			const buttonsHTML = schema.form.buttons
		.map(entry => {
			const commonAttributes = Object.keys(entry)
				.filter(key => key !== 'label' && key !== 'class')
				.map(key => `data-${key}="${entry[key]}"`)
				.join(' ');

			const classAttribute = entry.class ? ` class="${entry.class}"` : '';

			return `<button type="${entry.type || 'button'}" part="button" ${commonAttributes}${classAttribute}>${
				resolveTemplateString(entry.label, data, instance.lang, instance.i18n)}</button>`;
			}).join('');
			footerContent += `<nav part="nav">${buttonsHTML}</nav>`;
		}

		const rootContent = `${headerContent}<div part="main">${innerContent}</div><footer part="footer">${footerContent}</footer>`;

		if (form) {
			form.innerHTML = rootContent;
			return;
		}
		return rootContent;
	}
	return innerContent;
}

/* === arrayCheckbox === */

export const arrayCheckbox = (params) =>
	renderArray({
		...params,
		renderItem: ({ value, config, path }) => {
			const checked = config.render?.value ? !!value[config.render.value] : false;
			const rowLabel = config.render?.label ? value[config.render.label] || config.render.label : 'LABEL';
			return `
				<label part="row">
					<span part="label">${rowLabel}</span>
					<input part="input" type="checkbox" value="${value[config.render.value]}" name="${path}" data-type="boolean" ${checked ? 'checked' : ''}>
				</label>`;
		},
	});

/* === arrayDetail === */

export const arrayDetail = ({ value, config, path, instance, attributes = [], name = '', index }) => {
	const rowLabel = config.render?.label 
		? resolveTemplateString(config.render.label, value, instance.lang, instance.i18n) 
		: 'label';
	const rowValue = config.render?.value 
		? resolveTemplateString(config.render.value, value, instance.lang, instance.i18n) 
		: 'value';

	const cols = rowValue.split('|').map(col => `<span>${col}</span>`).join('');
	const arrayControl = config.render?.arrayControl || 'mark-remove';

	return `
		<details part="array-details" ${attrs(attributes)}${name ? ` name="${name}"`:''}>
			<summary part="row summary">
				<output part="label" name="label_${name}[${index}]">${rowLabel}</output>
				<span part="value">
					${icon('chevron right', 'sm', 'xs')}
					<output name="value_${name}[${index}]">${cols}</output>
					${config.render?.delete ? `<label><input part="input delete" checked type="checkbox" name="${path}" data-array-control="${arrayControl}"></label>` : ''}
				</span>
			</summary>
			${all(value, config.items, instance, false, path)}
		</details>`;
};

/* === arrayDetails === */

export const arrayDetails = (params) => {
	const { config } = params;
	return renderArray({
		...params,
		renderItem: ({ value, config, path, instance, attributes, index }) =>
			arrayDetail({
				value,
				config,
				path,
				instance,
				attributes,
				name: path,
				index,
			}),
		entry: config.render?.add ? entry : null,
	});
}

/* === arrayGrid === */

export const arrayGrid = (params) =>
	renderArray({
		...params,
		renderItem: ({ value, config, path, instance }) =>
			`<fieldset>${all(value, config.items, instance, false, path)}</fieldset>`,
	});

/* === arrayUnit === */

export const arrayUnit = ({ value, config, path, instance, attributes = [], name = '', index }) => {
	const rowValue = config.render?.value;
	if (!rowValue) return '';

	const rowLabel = config.render?.label
	? resolveTemplateString(config.render.label, value, instance.lang, instance.i18n)
	: 'label';

	const cols = rowLabel.split('|').map(col => `<span>${col}</span>`).join('');
	const arrayControl = config.render?.arrayControl || 'mark-remove';

	// Ensure config.items and properties exist
	const allContent = config.items?.properties
		? Object.entries(config.items.properties)
				.map(([key, itemConfig]) => {
					const itemName = itemConfig.name || key;
					const isHidden = itemName !== rowValue ? 'hidden' : '';
					const content = safeRender(
						instance.getRenderMethod(itemConfig.render?.method || 'input'),
						{
							label: itemConfig.title || key,
							value: value[key] || '',
							attributes: itemConfig.render?.attributes || [],
							config: itemConfig,
							instance,
							path: `${path}.${key}`,
							type: itemConfig.type || 'string',
						}
					);
					return `<span ${isHidden}>${content}</span>`;
				})
				.join('')
		: '';

	return `
	<fieldset part="array-unit fieldset" ${attrs(attributes)}${name ? ` name="${name}"` : ''}>
			${allContent}
			<span part="value">
				<output name="value_${name}[${index}]">${cols}</output>
				${config.render?.delete ? `<label><input part="input delete" checked type="checkbox" name="${path}" data-array-control="${arrayControl}"></label>` : ''}
			</span>
	</fieldset>`;
};

/* === arrayUnits === */

export const arrayUnits = (params) => {
	const { config } = params;
	return renderArray({
		...params,
		renderItem: ({ value, config, path, instance, attributes, index }) =>
			arrayUnit({ value, config, path, instance, attributes, name: path, index }),
		entry: config.render?.add ? entry : null,
	});
};

/* === autosuggest === */

export const autosuggest = (params) => {
	const config = params.config?.render?.autosuggest;
	if (!config) return '';

	const {
		api,
		apiArrayPath,
		apiDisplayPath,
		apiTextPath,
		apiValuePath,
		defaults,
		label,
		mapping,
		syncInstance
	} = config;
	const { path, formID, value: paramValue } = params;

	const display = defaults && paramValue ? getObjectByPath(paramValue, defaults.display) || '' : '';
	const value = defaults && paramValue ? getObjectByPath(paramValue, defaults.value) || '' : '';
	const name = defaults?.value ? `${path}.${defaults.value}` : path;

	const initialObject = defaults && paramValue ? {
		[`${path}.${defaults.display}`]: display,
		[`${path}.${defaults.value}`]: value
	} : null;

	return `
	<auto-suggest 
		${api ? `api="${api}"` : ''}
		${apiArrayPath ? `api-array-path="${apiArrayPath}"` : ''}
		${apiDisplayPath ? `api-display-path="${apiDisplayPath}"` : ''}
		${apiTextPath ? `api-text-path="${apiTextPath}"` : ''}
		${apiValuePath ? `api-value-path="${apiValuePath}"` : ''}
		${display ? `display="${display}"` : ''}
		${label ? `label="${label}"` : ''}
		list-mode="ul"
		name="${name}"
		part="autosuggest" 
		${syncInstance ? `sync-instance="${syncInstance}"` : ''}
		${value ? `value="${value}"` : ''}
		${initialObject && !isEmpty(initialObject) ? `initial-object='${JSON.stringify(initialObject)}'` : ''}
		${mapping ? `data-mapping='${JSON.stringify(mapping)}'` : ''}
		${formID ? `form="${formID}"` : ''}></auto-suggest>`;
};

/* === entry === */

export const entry = (params) => {
	const { config, instance, path = '' } = params;
	const formID = `form${uuid()}`;
	const id = `popover-${uuid()}`;
	const label = config.title || 'Add New Entry';
	const renderAutoSuggest = !!config.render?.autosuggest;

	const fields = Object.entries(config.items.properties)
		.map(([propKey, propConfig]) => {
			const attributes = [...(propConfig.render?.attributes || []), { form: formID }];
			attributes.forEach(attr => {
				if ('value' in attr) {
					attr.value = resolveTemplateString(attr.value, instance.data, instance.lang, instance.i18n);
				}
			});

			const renderMethod = propConfig.render?.method || 'input';
			const options = renderMethod === 'select' ? fetchOptions(propConfig, instance) : [];
			const renderFunction = renderMethod === 'select' ? select : input;

			return renderFunction({
				attributes,
				label: propConfig.title,
				options,
				path: `${path}.${propKey}`,
				type: propConfig.type || 'string'
			});
		}).join('');

	if (!fields) return '';
	instance.parent.insertAdjacentHTML('beforeend', `<form id="${formID}" data-popover="${id}" hidden></form>`);

	return `
		<nav part="nav">
			<button type="button" part="micro" popovertarget="${id}" style="--_an:--${id};">
				${icon('plus')}${label}
			</button>
		</nav>
		<div id="${id}" popover="" style="--_pa:--${id};">
			<fieldset part="fieldset" name="${path}-entry">
				<legend part="legend">${label}</legend>
				${renderAutoSuggest ? autosuggest({ config, path, formID }) : ''}
				${fields}
				<nav part="nav">
					<button type="button" form="${formID}" part="button close" popovertarget="${id}" popovertargetaction="hide">${t('close', instance.lang, instance.i18n)}</button>
					<button type="reset" form="${formID}" part="button reset">${t('reset', instance.lang, instance.i18n)}</button>
					<button type="submit" form="${formID}" part="button add" data-render-method="${config.render?.addMethod || 'arrayDetail'}" data-custom="addArrayEntry" data-params='{ "path": "${path}" }'>${t('add', instance.lang, instance.i18n)}</button>
				</nav>
			</fieldset>
		</div>`;
};

/* === fieldset === */

export const fieldset = ({ attributes, content, label, path }) => {
	const fieldsetId = path ? `section_${path}` : '';
	const fieldsetAttributes = attrs(attributes, '', [{ part: 'fieldset' }]);
	const nameAttribute = path ? ` name="${path}-entry"` : '';

	return `
		<fieldset id="${fieldsetId}" ${fieldsetAttributes}${nameAttribute}>
			<legend part="legend">${label}</legend>
			${content}
		</fieldset>`;
};

/* === icon === */

const icon = (type, size, stroke) => `<ui-icon type="${type||''}" size="${size||''}" stroke="${stroke||''}"></ui-icon>`;

/* === input === */

export const input = (params) => {
	const { attributes = [], instance, label, path = '', type = 'string', value } = params;
	const finalValue = value ?? attributes.find(attr => attr.value !== undefined)?.value ?? '';
	const filteredAttributes = attributes.filter(attr => !('value' in attr));
	const hiddenLabel = filteredAttributes.some(attr => attr['hidden-label']);
	const checked = filteredAttributes.some(attr => attr.type === 'checkbox') && finalValue ? ' checked' : '';
	const hidden = filteredAttributes.some(attr => attr.type === 'hidden');
	const isRequired = filteredAttributes.some(attr => attr.required === 'required');
	const inputElement = `<input part="input" value="${finalValue}" ${attrs(filteredAttributes, path)} data-type="${type}" ${checked}>`;

	return hidden 
		? inputElement 
		: `<label part="row" ${hiddenLabel ? 'hidden' : ''}>
			<span part="label">${isRequired ? `<abbr title="${t('required', instance.lang, instance.i18n)}">*</abbr>` : ''}${label}</span>
			${inputElement}
		</label>`;
};

/* === media === */

export const media = (params) => {
	const { attributes = [], config, label, path = '', value } = params;
	const { delete: itemDelete, summary: itemSrc = '', label: itemValue = '' } = config.render || {};

	const mediaItem = (item, itemPath) => `
		<label part="row">
			${itemDelete ? `<input part="input delete" value="${item[itemValue]}" type="checkbox" checked data-custom="removeArrayEntry" data-params='{ "path": "${itemPath}" }'>` : ''}
			<img part="img" src="${item[itemSrc]}" alt="">
		</label>`;

	const content = value.map((item, index) => mediaItem(item, path ? `${path}[${index}]` : '')).join('');
	return fieldset({ label, content, attributes, path });
};

/* === renderArray === */

export const renderArray = ({ value, config, path, instance, renderItem, attributes = [], label = '', entry }) => { 
	const content = value.map((item, index) =>
		renderItem({
			value: item,
			config,
			path: path ? `${path}[${index}]` : '',
			instance,
			attributes,
			index,
		})
	).join('');

	const entryContent = entry ? entry({ config, instance, path }) : '';
	return fieldset({
		attributes,
		content: `${content}${entryContent}`,
		label,
		path,
	});
};

/* === richtext === */

export const richtext = (params) => {
	const { attributes = [], instance, label, path = '', value } = params;
	const isRequired = attributes.some(attr => attr.required === 'required');
	return `
		<label part="row">
			<span part="label">${isRequired ? `<abbr title="${t('required', instance.lang, instance.i18n)}">*</abbr>` : ''}${label}</span>
			<rich-text part="richtext" event-mode="input" ${attrs(attributes, path)}>
				${value || ''}
			</rich-text>
		</label>`;
};

/* === select === */

export const select = (params) => {
	const { attributes = [], label, options = [], path = '', type = 'string', value = -1 } = params;
	const attributeValue = attributes.find(attr => 'value' in attr)?.value;
	const finalValue = (value !== -1 && value !== undefined) ? value
									 : (attributeValue !== undefined) ? attributeValue
									 : '';
	const filteredAttributes = attributes.filter(attr => !('value' in attr));

	return `
		<label part="row">
			<span part="label">${label}</span>
			<select part="select" ${attrs(filteredAttributes, path, [], ['type'])} data-type="${type}">
				${options.map(option => `
					<option value="${option.value}" ${String(option.value) === String(finalValue) ? 'selected' : ''}>
						${option.label}
					</option>
				`).join('')}
			</select>
		</label>`;
};

/* === textarea === */

export const textarea = (params) => {
	const { attributes = [], label, path = '', value = '' } = params;
	const textareaAttributes = attrs(attributes, path);
	return `
		<label part="row">
			<span part="label">${label}</span>
			<textarea part="textarea" ${textareaAttributes}>${value}</textarea>
		</label>`;
};
