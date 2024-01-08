#!/usr/bin/env node
/* eslint-env node */

const process    = require("process");
const fs         = require("fs");

const esprima    = require("esprima-next");
const estraverse = require("estraverse-fb");
const escope     = require("escope");
const escodegen  = require("escodegen-wallaby");
const prettier   = require("prettier");

const input = fs.readFileSync(process.stdin.fd, 'utf-8');
const ast = esprima.parseScript(input);

clean(ast);

prettier.format(escodegen.generate(ast), {
	parser: "babel",
	printWidth: 120,
	useTabs: true,
	quoteProps: "consistent",
}).then(output => fs.writeFileSync(process.stdout.fd, output))

function renameAll(scopes) {
	function toExcelCol(n) {
		n += 1;
		const chars = []
		let d;
		while(n > 0) {
			const a = Math.floor(n / 26);
			const b = n % 26;
			[n, d] = b === 0 ? [a - 1, b + 26] : [a, b]
			chars.push(String.fromCodePoint('a'.codePointAt(0) + d - 1));
		}
		return chars.join('')
	}
	let nscope = 0;
	for(const scope of scopes) {
		if(scope.type != "class") {
			let scopeName = toExcelCol(nscope);
			let nvar = 0;
			for(let variable of scope.variables) {
				if(variable.tainted) continue;
				if(!variable.defs.length) continue;
				if(variable._renamed) continue;
				const isJsx = variable.references.find(c => c.identifier._jsx);
				let name = (isJsx ? scopeName.toUpperCase() : scopeName) + nvar++;
				rename(variable, name)
			}
			if(nvar != 0) nscope += 1;
		}
	}
}

function rename(variable, name) {
	variable._renamed = true;
	variable.name = name;
	for(let def of variable.identifiers) def.name = name;
	for(let ref of variable.references) ref.identifier.name = name;
}

function clean(ast) {
	const {scopes} = escope.analyze(ast);
	for(const scope of scopes) {
		if(scope.type != "class") {
			for(let variable of scope.variables) {
				for(const def of variable.identifiers) {
					if(def.variable) throw def;
					def.variable = variable;
				}
				for(const ref of variable.references) {
					if(ref.identifier.variable !== undefined
						&& !Object.is(ref.identifier.variable, variable)
					) {
						throw ref;
					}
					ref.identifier.variable = variable;
				}
			}
		}
	}

	const topargs = scopes[1].variables.filter(v => v.defs[0]?.type == "Parameter");
	for(const i in topargs) {
		rename(topargs[i], ["module", "exports", "require"][i])
	}

	unminify(ast);
	inferNames(ast);
	unjsx(ast);
	unzero(ast);
	renameAll(scopes);
}

function unminify(ast) { // {{{
	estraverse.replace(ast, {
		enter(node) {
			switch(node.type) {
				case "ForStatement":
					// TODO do something about multiple declarations in for headers
					if(node.init != null && node.init.type == "VariableDeclaration")
						node.init._is_for = true;
					break;
				case "ForInStatement":
				case "ForOfStatement":
					if(node.left.type == "VariableDeclaration")
						node.left._is_for = true;
					break;
			}

			if(test(node, {
				type: "ReturnStatement",
				argument: { type: "UnaryExpression", operator: "void" },
			})) {
				return {
					type: "BlockStatement",
					_fake_block: true,
					body: [
						{type: "ExpressionStatement", expression: node.argument.argument},
						{type: "ReturnStatement", argument: null},
					]
				};
			}

			switch(node.type) {
				case "ExpressionStatement": return unminifyBlock(node, "expression", 2);
				case "ReturnStatement":     return unminifyBlock(node, "argument", 1);
				case "IfStatement":         return unminifyBlock(node, "test", 0);
				case "SwitchStatement":     return unminifyBlock(node, "discriminant", 0);
				case "ForStatement":        return unminifyBlock(node, "init", 0);
				case "ForInStatement":      return unminifyBlock(node, "right", 0);
			}
		},

		leave(node) {
			if(test(node, {
				type: "UnaryExpression", operator: "!",
				argument: { type: "Literal", value: 0 },
			})) return { type: "Literal", value: true, raw: "true" };

			if(test(node, {
				type: "UnaryExpression", operator: "!",
				argument: { type: "Literal", value: 1 },
			})) return { type: "Literal", value: false, raw: "false" };

			if(node.type == "VariableDeclaration" && !node._is_for)
				return {
					type: "BlockStatement",
					_fake_block: true,
					body: node.declarations.map(d => Object.assign({}, node, {declarations: [d]})),
				};

			if(node.type == "BlockStatement" || node.type == "Program")
				node.body = node.body.flatMap(n => n._fake_block ? n.body : [n]);

			if(node.type == "SwitchCase")
				node.consequent = node.consequent.length == 0 ? [] : [{
					type: "BlockStatement",
					body: node.consequent.flatMap(n => n._fake_block ? n.body : [n]),
				}];
		}
	});
}

function unminifyBlock(stmt, child, level) {
	if(stmt[child] === null) return;

	if(level >= 0 && stmt[child].type == "SequenceExpression") {
		const newStmt = {
			type: "BlockStatement",
			body: [],
			_fake_block: true,
		};
		while(stmt[child].expressions.length > 1) {
			newStmt.body.push({
				type: "ExpressionStatement",
				expression: stmt[child].expressions.shift(),
			});
		}
		stmt[child] = stmt[child].expressions[0];
		newStmt.body.push(stmt);
		return newStmt;
	}

	if(level >= 1 && stmt[child].type == "ConditionalExpression") {
		const {test, consequent, alternate} = stmt[child];
		return {
			type: "IfStatement",
			test: test,
			consequent: Object.assign({}, stmt, {[child]: consequent}),
			alternate:  Object.assign({}, stmt, {[child]: alternate}),
		};
	}

	if(level >= 2 && stmt[child].type == "LogicalExpression") {
		const {operator, left, right} = stmt[child];
		return {
			type: "IfStatement",
			test: operator == "||" ? {
				type: "UnaryExpression",
				operator: "!",
				argument: left,
			} : left,
			consequent: Object.assign({}, stmt, {[child]: right}),
			alternate:  null,
		};
	}
}
// }}}

function inferNames(ast) {
	let import_n = 0;
	estraverse.traverse(ast, {
		enter(node) {
			if(node.type == "ObjectPattern") {
				// This one has a small risk of accidental shadowing.
				for(const prop of node.properties) {
					if(prop.type == "Property" && prop.value.type == "Identifier") {
						rename(prop.value.variable, prop.key.name);
						prop.shorthand = true;
					} else if(prop.type == "Property"
						&& prop.value.type == "AssignmentPattern"
						&& prop.value.left.type == "Identifier"
					) {
						rename(prop.value.left.variable, prop.key.name);
						prop.shorthand = true;
					}
				}
			}

			if(test(node, { // definePropertyGetters
				type: "CallExpression",
				callee: {
					type: "MemberExpression",
					object: { type: "Identifier", name: "require" },
					property: { type: "Identifier", name: "d" },
				},
				arguments: [ { type: "Identifier", name: "exports" }, { type: "ObjectExpression" } ]
			})) {
				for(const prop of node.arguments[1].properties) {
					if(!test(prop.value, {
						type: "FunctionExpression",
						id: null,
						params: [],
						body: { type: "BlockStatement", body: [{
							type: "ReturnStatement", argument: { type: "Identifier" },
						}] }
					})) throw prop;
					let name = prop.key.name === "default" ? "_default" : prop.key.name;
					let ident = prop.value.body.body[0].argument;
					rename(ident.variable, name);
					prop.value = {
						type: "ArrowFunctionExpression",
						params: prop.value.params,
						body: ident,
						expression: true,
					};
				}
			}

			if(test(node, {
				type: "VariableDeclaration",
				declarations: [{
					init: {
						type: "CallExpression",
						callee: { type: "Identifier", name: "require" },
						arguments: [{ type: "Literal" }],
					}
				}]
			})) {
				let decl = node.declarations[0];
				if(!decl.id.variable._renamed) {
					rename(decl.id.variable, "_" + import_n++)
				}
			}

			if(test(node, {
				type: "VariableDeclaration",
				declarations: [{
					init: {
						type: "CallExpression",
						callee: {
							type: "MemberExpression",
							object: { type: "Identifier", name: "require" },
							property: { type: "Identifier", name: "n" },
						},
						arguments: [{ type: "Identifier" }],
					}
				}]
			})) {
				let decl = node.declarations[0];
				let arg = decl.init.arguments[0];
				rename(decl.id.variable, arg.name)
				rename(arg.variable, arg.name + "_")
			}
		}
	})
}

function extractZero(node) {
	if(test(node, {
		type: "SequenceExpression",
		expressions: [
			{
				type: "Literal",
				value: 0,
			},
			{
				type: "MemberExpression",
				computed: false,
				object: { type: "Identifier" },
				property: { type: "Identifier" },
			},
		],
	})) return node.expressions[1];
}

function unjsx(ast) { // {{{
	function extractJsx(node) {
		if(node.type !== "CallExpression") return;
		const callee = extractZero(node.callee);
		if(callee === undefined) return;
		const name = callee.property.name;
		if(name !== "jsx" && name !== "jsxs") return;
		if(node.arguments.length > 3) return;
		return [callee.object, node.arguments];
	}

	function toJsxName(node, top = true) {
		if(node.type == "Literal") {
			return { type: "JSXIdentifier", name: node.value }
		} else if(node.type == "MemberExpression") {
			node.type = "JSXMemberExpression";
			node.object = toJsxName(node.object, false);
			return node;
		} else if(node.type == "Identifier") {
			node.type = "JSXIdentifier"
			if(top) node._jsx = true;
			return node;
		} else {
			throw node;
		}
	}

	function getJsxAttributes([, props, key]) {
		let children = undefined;
		let attributes = [];
		for(const item of props.properties) {
			if(item.type == "Property" && !item.computed) {
				if(item.key.name == "children") {
					children = toJsxChildren(item.value);
				} else {
					attributes.push({
						type: "JSXAttribute",
						name: toJsxName(item.key),
						value: { type: "JSXExpressionContainer", expression: item.value },
					});
				}
			} else if(item.type == "SpreadElement") {
				item.type = "JSXSpreadAttribute";
				attributes.push(item);
			} else {
				throw item;
			}
		}
		if(key) {
			attributes.push({
				type: "JSXAttribute",
				name: { type: "JSXIdentifier", name: "key" },
				value: { type: "JSXExpressionContainer", expression: key },
			})
		}
		return [attributes, children]
	}

	function toJsxChildren(child) {
		switch(child.type) {
			case "ArrayExpression":
				return child.elements.map(child => {
					switch(child.type) {
						case "JSXElement":
							return child;
						default:
							return { type: "JSXExpressionContainer", expression: child }
					}
				});
			case "JSXElement":
				return [ child ];
			default:
				return [{ type: "JSXExpressionContainer", expression: child }]
		}
	}

	const factories = {};
	estraverse.traverse(ast, {
		leave(node) {
			const jsx = extractJsx(node);
			if(jsx === undefined) return;
			factories[jsx[0].name] = jsx[0];
		}
	})
	if(Object.values(factories).length !== 1) return ast;
	const factory = Object.values(factories)[0];
	rename(factory.variable, "React");

	estraverse.replace(ast, {
		leave(node) {
			const jsx = extractJsx(node);
			if(jsx === undefined) return;
			const [attributes, children] = getJsxAttributes(jsx[1]);

			// estraverse-fb doesn't support JSXFragment, so can't insert those
			const name = toJsxName(jsx[1][0]);
			return {
				type: "JSXElement",
				openingElement: {
					type: "JSXOpeningElement",
					attributes,
					name,
					selfClosing: children === undefined,
				},
				children: children ?? [],
				closingElement: children !== undefined ? {
					type: "JSXClosingElement",
					name,
				} : null,
			}
		}
	})
} // }}}

function unzero(ast) {
	estraverse.replace(ast, { enter: extractZero })
}

function test(a, b) {
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
		for(const key of Object.getOwnPropertyNames(b))
			if(!test(a[key], b[key]))
				return false;
		return true;
	}

	return a === b;
}
