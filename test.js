export const match = Symbol("match");

export function test(a, b) {
	if(((typeof b == "object" && b !== null) || typeof b == "function") && b[match]) return b[match](a)

	if(typeof a != typeof b) return false;
	if(b == null) return a == null;
	if(a == null) return false;

	if(Array.isArray(b)) {
		if(!Array.isArray(a)) return false;
		if(b.length != a.length) return false;
		for(let i = 0; i < b.length; i++)
			if(!test(a[i], b[i])) return false;
		return true;
	}
	
	if(typeof a == "object") {
		for(const [key, value] of Object.entries(b))
			if(!test(a[key], value))
				return false;
		return true;
	}

	return a === b;
};

export const T = new Proxy({}, {
	get(target, type) {
		let v = function(props) {
			return { type, ...props }
		}
		v[match] = v => v.type == type;
		return v
	}
});

export const Id = new Proxy({[match]: v => v.type == "Identifier"}, {
	get(target, name) {
		return target[name] ?? T.Identifier({name})
	}
});

