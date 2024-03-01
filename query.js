import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

export const match = Symbol("match");

export function test(value, filter) {
	if(filter === undefined) {
		throw new Error("null filter");
	} else if(filter === null) {
		return true;
	} else if(Object.getPrototypeOf(filter) == Function.prototype && !filter[match]) {
		return filter(value instanceof NodePath ? value.node : value);
	} else if(Array.isArray(filter)) {
		if(!Array.isArray(value)) return false;
		if(value.length !== filter.length) return false;
		for(const k in filter) {
			if(!test(value[k], filter[k])) return false;
		}
		return !filter[match] || filter[match].call(filter, value);
	} else if(Object.getPrototypeOf(filter) == Object.prototype) {
		let { type, [match]: match_, ...props } = filter;
		if(!(value instanceof NodePath)) return false;
		if(type && !value["is"+type]()) return false;
		for(const k in props) {
			if(!test(value.get(k), props[k])) return false;
		}
		return !match_ || match_.call(filter, value);
	} else if(filter[match]) {
		return filter[match](value)
	} else {
		return value.node === filter;
	}
};

export const T = new Proxy(_ => { throw new Error("T is not a pattern"); }, {
	get(target, type) {
		if(typeof type !== "string") return undefined;
		function v(props = {}) {
			return { type, ...props };
		};
		v[match] = value => test(value, { type });
		v.type = type;
		return v
	}
});

export const Id = new Proxy({
	type: "Identifier",
	[match]: path => !!path.scope.getBinding(path.node.name),
}, {
	get(target, name) {
		return target[name] ?? T.Identifier({ name })
	}
});

