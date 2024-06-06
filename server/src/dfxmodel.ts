import { resolve } from 'path';
import jsonSchema from './dfx.json';
import {
	RemoveKeys
} from './search.js';

export class MainProperty {
	name?: string;
	isObject?: boolean = false;
}

export class Definition {
	name?: string;
	mainPropertyName?: string;
	properties?: Property[];
	oneOfProperties?: OneOfProperty[];
}

export class Property {
	name?: string;
	types?: Type[]
}

export class OneOfProperty {
	enumName?: string;
	requiredProperties?: string[];
	properties?: Property[];
	type?: Type;
}

export class Type {
	name?: string;
}

export class Prop {
	name?: string;
	types?: Type[] = [];
	typeForArray?: string;
	propsForItems: Prop[] = [];
	enums: string[] = [];
	requiredProperties?: string[] = [];
	properties: Prop[] = [];
	oneOfProperties: Prop[] = [];
}

export function getJsonFileWithoutKeyFormat(): any {
	let dfxJson = jsonSchema;
	RemoveKeys(dfxJson, "format");
	return dfxJson;
}

export function buildPropsFromJson(): Prop[] {
	let dfxJson = getJsonFileWithoutKeyFormat();
	let props: Prop[] = [];
	resolveProperties(dfxJson, dfxJson, props);
	return props;
}

function resolveProperties(dfxJson : any, json: any, properties : Prop[]) {
	for (let key in json.properties) {
		let prop = new Prop();
		prop.name = key;
		if (json.properties[key].hasOwnProperty("anyOf")) {
			buildAnyOfProp(dfxJson, json.properties[key], prop);
		}
		else if (json.properties[key].hasOwnProperty("additionalProperties")) {
			buildAdditionalProperties(dfxJson, json.properties[key], prop);
		}
		else if (json.properties[key].hasOwnProperty("allOf")) {
			buildAllOfProp(dfxJson, json.properties[key], prop, key);
		}
		else {
			buildSingularProp(dfxJson, json.properties[key], prop);
		}
		properties.push(prop);
	}
}

function buildSingularProp(dfxJson: any, jsonProp: any, prop: Prop) {
	let types : Type[] = [];
	let enums : string[] = [];
	let requiredProperties : string[] = [];
	let properties : Prop[] = [];
	resolveTypes(jsonProp, types);
	resolveEnums(jsonProp, enums);
	resolveRequiredProperties(jsonProp, requiredProperties);
	resolveItems(dfxJson, jsonProp, prop);
	if (jsonProp.hasOwnProperty("properties")) {
		resolveProperties(dfxJson, jsonProp, properties);
	}
	prop.types = types;
	prop.enums = enums;
	prop.requiredProperties = requiredProperties;
	prop.properties = properties;
}

function buildAdditionalProperties(dfxJson: any, jsonProp: any, prop: Prop) {
	let additionalProperty = new Prop();
	additionalProperty.name = "additionalProperties";
	let types : Type[] = [];
	let type = new Type();
	type.name = "object";
	types.push(type);

	let additionalPropertyTypes : Type[] = [];
	let additionalPropertyEnums : string[] = [];
	let additionalPropertyRequiredProperties : string[] = [];
	let additionalPropertyProperties : Prop[] = [];
	for (let key in jsonProp.additionalProperties) {
		if (key === "type") {
			let type = new Type();
			type.name = jsonProp.additionalProperties[key];
			types.push(type);
		}
		if (key === "$ref") {
			let definition = jsonProp.additionalProperties[key].split("/")[2];
			let definitionJson = dfxJson.definitions[definition];
			resolveTypes(definitionJson, additionalPropertyTypes);
			if (definitionJson.hasOwnProperty("oneOf")) {
				buildOneOfProp(dfxJson, definitionJson, additionalProperty);
			}
			if (definitionJson.hasOwnProperty("properties")) {
				resolveProperties(dfxJson, definitionJson, additionalPropertyProperties);
			}
			if (definitionJson.hasOwnProperty("additionalProperties")) {
				buildAdditionalProperties(dfxJson, definitionJson, additionalProperty);
			}
			resolveEnums(definitionJson, additionalPropertyEnums);
			resolveRequiredProperties(definitionJson, additionalPropertyRequiredProperties);
			resolveItems(dfxJson, definitionJson, prop);
		}
	}
	additionalProperty.types = additionalPropertyTypes;
	additionalProperty.enums = additionalPropertyEnums;
	additionalProperty.requiredProperties = additionalPropertyRequiredProperties;
	additionalProperty.properties = additionalPropertyProperties;

	prop.properties = [additionalProperty];
	prop.types = types;
}

function buildAnyOfProp(dfxJson: any, jsonProp: any, prop: Prop) {
	let types : Type[] = [];
	let enums : string[] = [];
	let requiredProperties : string[] = [];
	let properties : Prop[] = [];
	for (let key in jsonProp.anyOf) {
		if (jsonProp.anyOf[key].hasOwnProperty("type")) {
			resolveTypes(jsonProp.anyOf[key], types);
			resolveItems(dfxJson, jsonProp.anyOf[key], prop);
		}
		if (jsonProp.anyOf[key].hasOwnProperty("$ref")) {
			let definition = jsonProp.anyOf[key].$ref.split("/")[2];
			let definitionJson = dfxJson.definitions[definition];
			resolveTypes(definitionJson, types);
			if (definitionJson.hasOwnProperty("properties")) {
				resolveProperties(dfxJson, definitionJson, properties);
			}
			resolveEnums(definitionJson, enums);
			resolveRequiredProperties(definitionJson, requiredProperties);
			resolveItems(dfxJson, definitionJson, prop);
		}
	}
	prop.types = types;
	prop.requiredProperties = requiredProperties;
	prop.enums = enums;
	prop.properties = properties;
}

function buildAllOfProp(dfxJson: any, jsonProp: any, prop: Prop, propName : string) {
	let types : Type[] = [];
	let enums : string[] = [];
	let requiredProperties : string[] = [];
	let properties : Prop[] = [];
	for (let key in jsonProp.allOf) {
		if (jsonProp.allOf[key].hasOwnProperty("type")) {
			resolveTypes(jsonProp.allOf[key], types);
			resolveItems(dfxJson, jsonProp.allOf[key], prop);
		}
		if (jsonProp.allOf[key].hasOwnProperty("$ref")) {
			let definition = jsonProp.allOf[key].$ref.split("/")[2];
			let definitionJson = dfxJson.definitions[definition];
			if (definitionJson.hasOwnProperty("anyOf")) {
				buildAnyOfProp(dfxJson, definitionJson, prop);
				if (definitionJson.hasOwnProperty("oneOf")) {
					buildOneOfProp(dfxJson, definitionJson, prop);
				}
				prop.types?.forEach((type) => types?.push(type));
				prop.requiredProperties?.forEach((requiredProp) => requiredProperties?.push(requiredProp));
				prop.enums?.forEach((enumValue) => enums?.push(enumValue));
				prop.properties?.forEach((property) => properties?.push(property));
			}
			else {
				resolveTypes(definitionJson, types);
				if (definitionJson.hasOwnProperty("properties")) {
					resolveProperties(dfxJson, definitionJson, properties);
				}
				resolveEnums(definitionJson, enums);
				resolveRequiredProperties(definitionJson, requiredProperties);
				resolveItems(dfxJson, definitionJson, prop);
			}
		}
	}
	prop.name = propName;
	prop.types = types;
	prop.requiredProperties = requiredProperties;
	prop.enums = enums;
	prop.properties = properties;
}

function buildOneOfProp(dfxJson: any, jsonProp: any, prop: Prop) {
	let oneOfProperties : Prop[] = [];
	for (let key in jsonProp.oneOf) {
		let oneOfProp = new Prop();
		let types : Type[] = [];
		let enums : string[] = [];
		let requiredProperties : string[] = [];
		let properties : Prop[] = [];
		resolveTypes(jsonProp.oneOf[key], types);
		resolveEnums(jsonProp.oneOf[key], enums);
		resolveRequiredProperties(jsonProp.oneOf[key], requiredProperties);
		resolveItems(dfxJson, jsonProp.oneOf[key], prop);
		if (jsonProp.oneOf[key].hasOwnProperty("properties")) {
			resolveProperties(dfxJson, jsonProp.oneOf[key], properties);
		}
		oneOfProp.types = types;
		oneOfProp.enums = enums;
		oneOfProp.requiredProperties = requiredProperties;
		oneOfProp.properties = properties;
		oneOfProperties.push(oneOfProp);
	}
	prop.oneOfProperties = oneOfProperties;
}

function resolveTypes(json : any, types : Type[]) {
	if (json.hasOwnProperty("type") && Array.isArray(json.type)) {
		json.type.forEach((typeName: string) => {
			let type = new Type();
			type.name = typeName;
			types.push(type);
		});
	}
	else if (json.hasOwnProperty("type")) {
		let type = new Type();
		type.name = json.type;
		types.push(type);
	}
}

function resolveItems(dfxJson : any, json : any, prop : Prop) {
	if (json.hasOwnProperty("items")) {
		if (json.items.hasOwnProperty("type")) {
			prop.typeForArray = json.items.type;
		}
		else if (json.items.hasOwnProperty("$ref")) {
			let definition = json.items.$ref.split("/")[2];
			let definitionJson = dfxJson.definitions[definition];
			buildItemProp(dfxJson, definitionJson, prop);
		}
	}
}

function buildItemProp(dfxJson: any, jsonProp: any, prop: Prop) {
	let types : Type[] = [];
	let enums : string[] = [];
	let requiredProperties : string[] = [];
	let properties : Prop[] = [];
	resolveTypes(jsonProp, types);
	resolveEnums(jsonProp, enums);
	resolveRequiredProperties(jsonProp, requiredProperties);
	resolveItems(dfxJson, jsonProp, prop);
	if (jsonProp.hasOwnProperty("properties")) {
		resolveProperties(dfxJson, jsonProp, properties);
	}
	prop.types = types;
	prop.enums = enums;
	prop.requiredProperties = requiredProperties;
	prop.propsForItems = properties;
}

function resolveEnums(json : any, enums : string[]) {
	if (json.hasOwnProperty("enum")) {
		json.enum.forEach((enumValue: string) => {
			enums.push(enumValue);
		});
	}
}

function resolveRequiredProperties(json : any, requiredProperties : string[]) {
	if (json.hasOwnProperty("required")) {
		json.required.forEach((requiredProperty: string) => {
			requiredProperties.push(requiredProperty);
		});
	}
}

export function getMainProperties(): MainProperty[] {
	let dfxJson = getJsonFileWithoutKeyFormat();
	let mainProperties: MainProperty[] = [];
	for (let key in dfxJson.properties) {
		let mainProperty = new MainProperty();
		mainProperty.name = key;
		if (dfxJson.properties[key].hasOwnProperty("type") && Array.isArray(dfxJson.properties[key].type) && dfxJson.properties[key].type.includes("object")) {
			mainProperty.isObject = true;
		}
		mainProperties.push(mainProperty);
	}
	return mainProperties;
}

export function buildDefinitionsFromJson(): Definition[] {
	let dfxJson = getJsonFileWithoutKeyFormat();
	let definitions: Definition[] = [];
	for (let key in dfxJson.definitions) {
		let definition = new Definition();
		definition.name = key;
		definition.properties = [];
		definition.oneOfProperties = [];
		populateMainPropertyName(definition, dfxJson, key);
		for (let key2 in dfxJson.definitions[key].properties) {
			let property = new Property();
			property.name = key2;
			definition.properties.push(property);
		}
		for (let key2 in dfxJson.definitions[key].oneOf) {
			let oneOfProperty = new OneOfProperty();
			setOneOfProperty(dfxJson.definitions[key].oneOf[key2], oneOfProperty);
			definition.oneOfProperties.push(oneOfProperty);
		}
		definitions.push(definition);
	}
	return definitions;
}

export function findMainPropertyByName(mainProperties: MainProperty[], name: string): MainProperty | null {
	let mainProperty = mainProperties.find(mainProperty => mainProperty.name === name) ?? null;
	return mainProperty;
}

export function findDefintionByMainPropertyName(definitions: Definition[], mainPropertyName: string): Definition | null {
	let definition = definitions.find(definition => definition.mainPropertyName === mainPropertyName) ?? null;
	return definition;
}

export function findOneOfPropertyByEnumName(oneOfProperties: OneOfProperty[] | undefined, enumName: string): OneOfProperty | null {
	let oneOfProperty = oneOfProperties?.find(oneOfProperty => oneOfProperty.enumName === enumName) ?? null;
	return oneOfProperty;
}

export function findByDefinitionByName(definitions: Definition[], definitionName: string): Definition | null {
	let definition = definitions.find(definition => definition.name === definitionName) ?? null;
	return definition;
}

function populateMainPropertyName(definition: Definition, dfxJson: any, key: string) {
	for (let property in dfxJson.properties) {
		let stringifiedProperty = JSON.stringify(dfxJson.properties[property]);
		if (stringifiedProperty.includes(key)) {
			definition.mainPropertyName = property;
			break;
		}
	}
}

function setOneOfProperty(jsonOneOf: any, oneOfProperty: OneOfProperty) {
	if (jsonOneOf.hasOwnProperty("properties")) {
		oneOfProperty.enumName = jsonOneOf.properties.type.enum[0];
		oneOfProperty.requiredProperties = jsonOneOf.required;
		oneOfProperty.properties = [];
		for (let key3 in jsonOneOf.properties) {
			let property = new Property();
			property.name = key3;
			oneOfProperty.properties.push(property);
		}
	}
	else if (jsonOneOf.hasOwnProperty("enum")) {
		oneOfProperty.enumName = jsonOneOf.enum[0];
		let type = new Type();
		type.name = jsonOneOf.type;
		oneOfProperty.type = type;
	}
}