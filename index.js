#!/usr/bin/env node
/* eslint-env node */

import * as process from "process";
import * as fs from "fs";

import * as esprima    from "esprima-next";
import * as estraverse from "estraverse-fb";
import * as escope     from "escope";
import * as escodegen  from "escodegen-wallaby";
import * as prettier   from "prettier";

import {test, Id, T, match} from "./test.js";

const input = fs.readFileSync(process.stdin.fd, 'utf-8');
const ast = esprima.parseScript(input);

clean(ast);

prettier.format(escodegen.generate(ast, { format: { escapeless: true } }), {
	parser: "babel",
	printWidth: 98,
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
				rename(variable, scopeName + nvar++)
			}
			if(nvar != 0) nscope += 1;
		}
	}
}

function renameJsx(scopes) {
	for(const scope of scopes) {
		if(scope.type != "class" && scope.type != "TDZ") {
			for(let variable of scope.variables) {
				if(variable.jsx) {
					let fst = variable.name.charAt(0);
					if(fst != fst.toUpperCase()) {
						rename(variable, fst.toUpperCase() + variable.name.slice(1), true);
					} else if(fst == fst.toLowerCase()) {
						rename(variable, "C" + variable.name, true);
					}
				}
			}
		}
	}
}

function rename(variable, name, force = false) {
	if(variable._renamed && !force) return false;
	if(!/^[_a-zA-Z]\w*$/.test(name)) return false;

	let vars = [
		...variable.scope.through.map(v => v.resolved),
		...variable.scope.set.values(),
	].filter(v => v);
	let rawName = name;
	let n = 0;
	while(name == "default" || vars.find(v => v.name == name)) {
		name = rawName + (n++);
	}

	variable._renamed = true;
	variable.name = name;
	for(let def of variable.identifiers) def.name = name;
	for(let ref of variable.references) ref.identifier.name = name;
	return name == rawName;
}

function clean(ast) {
	const {scopes} = escope.analyze(ast, { ecmaVersion: 6 });
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

	unminify(ast);
	restoreTemplates(ast);
	const isWebpack = webpack(ast);
	foldDestructures(ast);
	if(isWebpack) {
		unjsx(ast);
	}
	unzero(ast);
	inferNames(ast);
	renameAll(scopes);
	if(isWebpack) {
		renameJsx(scopes);
	}
	objectShorthand(ast);
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

			if(test(node, T.ArrowFunctionExpression({ body: T.SequenceExpression }))) {
				return {
					...node,
					body: T.BlockStatement({ body: [
						T.ReturnStatement({ argument: node.body }),
					] }),
					expression: false,
				}
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

			if(test(node, T.ArrowFunctionExpression({
				body: T.BlockStatement({ body: [ T.ReturnStatement ] })
			}))) {
				return {
					...node,
					body: node.body.body[0].argument,
					expression: true,
				}
			}

			if(test(node, T.ArrowFunctionExpression({
				body: T.BlockStatement({ body: [ T.ExpressionStatement ] })
			}))) {
				return {
					...node,
					body: node.body.body[0].expression,
					expression: true,
				}
			}
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

function webpack(ast) {
	if(test(ast, T.Program({
		body: [ T.ExpressionStatement({
			expression: T.AssignmentExpression({
				left: T.MemberExpression({
					computed: true,
					object: Id.webpack,
				}),
				right: T.FunctionExpression,
			})
		}) ]
	}))) {
		webpackModule(ast.body[0].expression.right);
		return true;
	} else {
		return false;
	}
}

function webpackModule(node) {
	const [_module, _exports, _require] = node.params;
	_module && rename(_module.variable, "module");
	_exports && rename(_exports.variable, "exports");
	_require && rename(_require.variable, "require");

	const isRequire = { [match]: v => v.type == "Identifier" && v.variable === _require?.variable };

	let import_n = 0;
	estraverse.traverse(ast, {
		enter(node) {
			if(test(node, T.VariableDeclaration({ declarations: [{
				id: Id,
				init: T.CallExpression({ callee: isRequire, arguments: [T.Literal] })
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
						callee: T.MemberExpression({ object: isRequire, property: Id.n }),
						arguments: [Id],
					})
				}]
			}))) {
				let decl = node.declarations[0];
				let arg = decl.init.arguments[0];
				if(arg.variable.isImport) {
					let name = arg.name;
					rename(arg.variable, name + "_", true)
					rename(decl.id.variable, name)
					decl.id.variable.isImport = true;
				}
			}

			if(test(node, T.CallExpression({
				callee: T.MemberExpression({ object: isRequire, property: Id.d, }),
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

		}
	})
}

function restoreTemplates(ast) {
	estraverse.replace(ast, {
		leave(node) {
			if(test(node, T.CallExpression({
				callee: T.MemberExpression({
					object: T.Literal({ value: {[match]: v => typeof v === "string"} }),
					property: Id.concat,
				})
			}))) {
				return T.TemplateLiteral({
					quasis: [
						T.TemplateElement({ value: { raw: node.callee.object.value } }),
						T.TemplateElement({ value: { raw: node.arguments[1]?.value ?? "" } }),
					],
					expressions: [
						node.arguments[0],
					],
				})
			}

			if(test(node, T.CallExpression({
				callee: T.MemberExpression({
					object: T.TemplateLiteral,
					property: Id.concat,
				})
			}))) {
				return T.TemplateLiteral({
					quasis: [
						...node.callee.object.quasis,
						T.TemplateElement({ value: { raw: node.arguments[1]?.value ?? "" } }),
					],
					expressions: [
						...node.callee.object.expressions,
						node.arguments[0],
					],
				})
			}
		}
	})
}

function inferNames(ast) {
	estraverse.traverse(ast, {
		enter(node) {
			if(node.type == "ObjectPattern" || node.type == "ObjectExpression") {
				for(const prop of node.properties) {
					if(test(prop, T.Property({ key: Id, value: Id }))) {
						rename(prop.value.variable, prop.key.name)
					} else if(test(prop, T.Property({ key: Id, value: T.AssignmentPattern({ left: Id }) }))) {
						rename(prop.value.left.variable, prop.key.name)
					}
				}
			}
			if(test(node, T.JSXSpreadAttribute({ argument: Id }))) {
				rename(node.argument.variable, "props");
			}
			if(test(node, T.JSXAttribute({
				name: T.JSXIdentifier,
				value: T.JSXExpressionContainer({
					expression: Id,
				})
			}))) {
				rename(node.value.expression.variable, node.name.name);
			}
		}
	})
}

function foldDestructures(ast) {
	estraverse.replace(ast, {
		enter(node) {
			if(test(node, T.VariableDeclaration({declarations: [{
				id: T.ObjectPattern,
				init: Id,
			}] })) && node.declarations[0].init.variable.references.length == 1) {
				Object.assign(
					node.declarations[0].init.variable.identifiers[0],
					node.declarations[0].id,
				);
				this.remove();
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
		if(test(node, T.Literal)) {
			return T.JSXIdentifier({ name: node.value })
		} else if(test(node, T.MemberExpression({ computed: false }))) {
			node.type = "JSXMemberExpression";
			node.object = toJsxName(node.object, false);
			return node;
		} else if(test(node, Id)) {
			node.type = "JSXIdentifier"
			if(top && node.variable) node.variable.jsx = true;
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
	rename(factory.variable, "React", true);

	estraverse.replace(ast, {
		leave(node) {
			const jsx = extractJsx(node);
			if(jsx === undefined) return;
			try {
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
			} catch {}
		}
	})
} // }}}

function unzero(ast) {
	estraverse.replace(ast, { enter: extractZero })
}

function objectShorthand(ast) {
	estraverse.traverse(ast, {
		enter(node) {
			if(node.type == "ObjectPattern" || node.type == "ObjectExpression") {
				for(const prop of node.properties) {
					if(test(prop, T.Property({ key: Id, value: Id }))) {
						if(prop.value.name == prop.key.name)
							prop.shorthand = true;
					} else if(test(prop, T.Property({ key: Id, value: T.AssignmentPattern({ left: Id }) }))) {
						if(prop.value.left.name == prop.key.name)
							prop.shorthand = true;
					}
				}
			}
		}
	})
}
