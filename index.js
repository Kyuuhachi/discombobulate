#!/usr/bin/env node
/* eslint-env node */

import * as process from "process";
import * as fs from "fs";

import * as esprima    from "esprima-next";
import * as estraverse from "estraverse-fb";
import * as escope     from "escope";
import * as escodegen  from "escodegen-wallaby";
import * as prettier   from "prettier";

import {test, Id, T} from "./test.js";

const input = fs.readFileSync(process.stdin.fd, 'utf-8');
const ast = esprima.parseScript(input);

clean(ast);

prettier.format(escodegen.generate(ast, { format: { escapeless: true } }), {
	parser: "babel",
	printWidth: 120,
	useTabs: true,
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
		if(scope.type != "class" && scope.type != "TDZ") {
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
		if(scope.type != "class" && scope.type != "TDZ") {
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

			if(test(node, T.ReturnStatement({
				argument: T.UnaryExpression({ operator: "void" }),
			}))) {
				return T.BlockStatement({
					_fake_block: true,
					body: [
						T.ExpressionStatement({ expression: node.argument.argument }),
						T.ReturnStatement({ argument: null }),
					]
				});
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
			if(test(node, T.UnaryExpression({
				operator: "!",
				argument: T.Literal({ value: 0 }),
			}))) return T.Literal({ value: true, raw: "true" });

			if(test(node, T.UnaryExpression({
				operator: "!",
				argument: T.Literal({ value: 1 }),
			}))) return T.Literal({ value: false, raw: "false" });

			if(node.type == "VariableDeclaration" && !node._is_for)
				return T.BlockStatement({
					_fake_block: true,
					body: node.declarations.map(d => Object.assign({}, node, {declarations: [d]})),
				});

			if(node.type == "BlockStatement" || node.type == "Program")
				node.body = node.body.flatMap(n => n._fake_block ? n.body : [n]);

			if(node.type == "SwitchCase")
				node.consequent = node.consequent.length == 0 ? [] : [T.BlockStatement({
					body: node.consequent.flatMap(n => n._fake_block ? n.body : [n]),
				})];
		}
	});
}

function unminifyBlock(stmt, child, level) {
	if(stmt[child] === null) return;

	if(level >= 0 && stmt[child].type == "SequenceExpression") {
		const newStmt = T.BlockStatement({
			_fake_block: true,
			body: [],
		});
		while(stmt[child].expressions.length > 1) {
			newStmt.body.push(T.ExpressionStatement({
				expression: stmt[child].expressions.shift(),
			}));
		}
		stmt[child] = stmt[child].expressions[0];
		newStmt.body.push(stmt);
		return newStmt;
	}

	if(level >= 1 && stmt[child].type == "ConditionalExpression") {
		const {test, consequent, alternate} = stmt[child];
		return T.IfStatement({
			test: test,
			consequent: Object.assign({}, stmt, {[child]: consequent}),
			alternate:  Object.assign({}, stmt, {[child]: alternate}),
		});
	}

	if(level >= 2 && stmt[child].type == "LogicalExpression") {
		const {operator, left, right} = stmt[child];
		return T.IfStatement({
			test: operator == "||" ? T.UnaryExpression({
				operator: "!",
				argument: left,
			}) : left,
			consequent: Object.assign({}, stmt, {[child]: right}),
			alternate:  null,
		});
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
					if(test(prop, T.Property({ key: Id, value: Id }))) {
						rename(prop.value.variable, prop.key.name);
						prop.shorthand = true;
					} else if(test(prop, T.Property({ key: Id, value: T.AssignmentPattern({ left: Id }) }))) {
						rename(prop.value.left.variable, prop.key.name);
						prop.shorthand = true;
					}
				}
			}

			if(test(node, T.CallExpression({
				callee: T.MemberExpression({ object: Id.require, property: Id.d, }),
				arguments: [ Id.exports, T.ObjectExpression ]
			}))) {
				for(const prop of node.arguments[1].properties) {
					if(!test(prop.value, T.FunctionExpression({
						id: null,
						params: [],
						body: T.BlockStatement({ body: [T.ReturnStatement] })
					}))) throw prop;
					let name = prop.key.name === "default" ? "_default" : prop.key.name;
					let ret = prop.value.body.body[0].argument;
					if(ret.type == "Identifier") {
						rename(ret.variable, name);
					}
					prop.value = T.ArrowFunctionExpression({
						params: prop.value.params,
						body: ret,
						expression: true,
					});
				}
			}

			if(test(node, T.VariableDeclaration({ declarations: [{
				init: T.CallExpression({ callee: Id.require, arguments: [T.Literal] })
			}] }))) {
				let decl = node.declarations[0];
				if(!decl.id.variable._renamed) {
					rename(decl.id.variable, "_" + import_n++)
					decl.id.variable.isImport = true;
				}
			}

			if(test(node, T.VariableDeclaration({
				declarations: [{
					init: T.CallExpression({
						callee: T.MemberExpression({ object: Id.require, property: Id.n }),
						arguments: [Id],
					})
				}]
			}))) {
				let decl = node.declarations[0];
				let arg = decl.init.arguments[0];
				rename(decl.id.variable, arg.name)
				rename(arg.variable, arg.name + "_")
				decl.id.variable.isImport = true;
			}
		}
	})
}

function extractZero(node) {
	if(test(node, T.SequenceExpression({
		expressions: [
			T.Literal({ value: 0 }),
			T.MemberExpression({ computed: false, object: Id, property: Id }),
		],
	})) && node.expressions[1].object.variable.isImport)
		return node.expressions[1];
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
		switch(node.type) {
			case "Literal":
				return T.JSXIdentifier({ name: node.value })
			case "MemberExpression":
				node.type = "JSXMemberExpression";
				node.object = toJsxName(node.object, false);
				return node;
			case "Identifier":
				node.type = "JSXIdentifier"
				if(top) node._jsx = true;
				return node;
			default:
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
					attributes.push(T.JSXAttribute({
						name: toJsxName(item.key),
						value: T.JSXExpressionContainer({ expression: item.value }),
					}));
				}
			} else if(item.type == "SpreadElement") {
				item.type = "JSXSpreadAttribute";
				attributes.push(item);
			} else {
				throw item;
			}
		}
		if(key) {
			attributes.push(T.JSXAttribute({
				name: T.JSXIdentifier({ name: "key" }),
				value: T.JSXExpressionContainer({ expression: key }),
			}))
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
							return T.JSXExpressionContainer({ expression: child })
					}
				});
			case "JSXElement":
				return [ child ];
			default:
				return [T.JSXExpressionContainer({ expression: child })]
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
			return T.JSXElement({
				openingElement: T.JSXOpeningElement({
					attributes,
					name,
					selfClosing: children === undefined,
				}),
				children: children ?? [],
				closingElement: children !== undefined ? T.JSXClosingElement({
					name,
				}) : null,
			})
		}
	})
} // }}}

function unzero(ast) {
	estraverse.replace(ast, { enter: extractZero })
}
