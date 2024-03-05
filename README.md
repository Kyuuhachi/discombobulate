# Discombobulate
### Turns Discord's mess of a source code into something halfway readable.

This script undos various minification shorthands like comma operator and conditionals,
creates JSX expressions, infers variable names, and various other improvements.

Some of the Discord and JSX-specific features only work on modules in the format extracted by [WebpackTarball](https://github.com/Kyuuhachi/VencordPlugins/tree/main/WebpackTarball).
You really should use that, it's *so* much nicer than fiddling around in devtools.

<details><summary>A short example</summary>

Below is a small module from Discord build number 269674, formatted with Prettier.

```js
webpack["996676"] = function (e, t, A) {
  "use strict";
  A.r(t),
    A.d(t, {
      default: function () {
        return r;
      },
    });
  var a = A("735250");
  A("470079");
  var s = A("910838");
  function r(e) {
    (0, s.openModalLazy)(async () => {
      let { default: t } = await A.el("996676@284:308").then(
        A.bind(A, "203909"),
      );
      return (A) => (0, a.jsx)(t, { ...e, ...A });
    });
  }
};
```

This is somewhat readable as it is, since it's a pretty short snippet, but compare it with the discombobulated version:

```js
webpack["996676"] = function (module, exports, require) {
  "use strict";
  require.r(exports);
  require.d(exports, { default: () => _default });
  var ReactJsx = require("735250");
  require("470079");
  var _0 = require("910838");
  function _default(props) {
    _0.openModalLazy(async () => {
      let { default: Default } = await require
        .el("996676@284:308")
        .then(require.bind(require, "203909"));
      return (props0) => <Default {...props} {...props0} />;
    });
  }
};
```

Imports and exports are easier to identify, most variables have names, and there's a nice little JSX expression there at the bottom. Sweet!

<hr></details>

A larger example can be found in the [`examples/`](examples/) directory.

Note that while this cleaned output is useful for understanding Discord's code, it's not particularly useful for formulating patches.
You'll probably want to keep a copy of the raw code as well if you're into that.

# Usage

I'll be honest — I have no idea how to package a nodejs application;
what I did is just `pnpm install` and then dropping a symlink to `index.js` at `~/bin/discombobulate`.
If anyone knows how to set this up in a nicer way I'd be happy to know.

Once that's done, you run it like any program — `discombobulate 996676.js` to mutate the file in-place,
or `discombobulate < 996676.js` to print the cleaned version to stdout.
Another nice way to run it is `:%!discombobulate` in Vim, which replaces the current buffer.
