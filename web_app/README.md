# Novorender web app API

This package contains all the various APIs relevant for developing a Novorender web app. We've decided to open source this code so that you can easily navigate directly to the source code whenever the provided documentation is not detailed enough. [Bug reports and feedback are welcome](https://github.com/novorender/ts/issues).

It is possible to use the sources directly from our [github repo](https://github.com/novorender/ts). You will have to configure your own bundler to deal with the imports of various binary resources, such as wasm and png, as well as multiple entry points for workers. This would enable you to trim away any unused code using tree shaking, inline data and include source maps for debug and uglify for release as you see fit. 

## NPM

For the rest of us there's [npm](https://npmjs.com/). (If you're using yarn or pnpm you'll know what to do).

>`npm i @novorender/web_app`

This npm package contains pre-built [ESM](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) bundles for the main script and worker scripts as well as the binary resource dependencies. We removed support for legacy UMD modules.

Besides installing the package, you must make sure the files in the `public/` directory of this package are available to your server, preferably at the same location as your main javascript bundle is located, e.g.:
```
├── public
│   ├── index.html
│   │── app.css // your main css bundle
│   ├── app.js  // your main js bundle
│   ├── <all files from "@novorender/web_app/public/" copied/linked here...>
├── node_modules
├── package.json
├── package-lock.json 
└── .gitignore
```

A copy of all the original typescript source code along with sourcemaps is included too. We consided the source code an important part of our documentation.

>Avoid [deep imports](https://gist.github.com/daleyjem/0f38f561a4e91e58eba580889f38330f)! Everything you need should be available from the package root: `@novorender/web_app`.

## Dependencies
At runtime we use [gl-matrix](https://www.npmjs.com/package/gl-matrix) for linear algebra and [tslib](https://www.npmjs.com/package/tslib) for typescript internal helper functions.

> We require double precision matrices: `glMatrix.setMatrixArrayType(Array)`. Don't change back to `Float32Array`!

## Server requirements

Our API uses advanced, cutting edge javascript APIs, many of which comes with certain security requirements. In general the following two global properties have to be true: [`isSecureContext`](https://developer.mozilla.org/en-US/docs/Web/API/isSecureContext) and [`crossOriginIsolated`](https://developer.mozilla.org/en-US/docs/Web/API/crossOriginIsolated).

To make it all work, your server has to ensure:

1) A [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts). In practice, this means HTTP on localhost (for debugging only) and HTTPS everywhere else, including LAN.

2) Cross origin [HTTP headers](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer#security_requirements) for *top level documents*.
```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

3) MIME type [`text/javascript`](https://www.iana.org/assignments/media-types/text/javascript) for javascript files and [`application/wasm`](https://www.iana.org/assignments/media-types/application/wasm) for web assembly files.

4) Any resources loaded from a separate domain has be configured with [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) to allow your domain.

5) Service workers script at the appropriate location, preferably at the root of your domain. See [MDN](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register) for more.


## Typescript

Using our APIs from javascript is possible but *strongly discouraged*. We rely heavily on typescript to help users catch common errors at edit/compile time. Technical support will only be provided for typescript users.

We currently use version `<%=package.devDependencies.typescript%>` of typescript. As a rule of thumb, you should upgrade to the latest version of typescript whenever a new version is released.

If you plan to do your own bundling and use our sources directly, you may want to use our `tsconfig.json` as a baseline for your own:

```jsonc
{
  "extends": "node_modules/@novorender/web_app/tsconfig.json", // or wherever...
  "compilerOptions": {
    ...
  }
}
```

We generally use `ESNext` as target since we only support lastest version of browsers with cutting edge support for 3D rendering. Also, we use relatively new typescript features such as [`verbatimModuleSyntax`](https://www.typescriptlang.org/tsconfig#verbatimModuleSyntax) and [`allowArbitraryExtensions`](https://www.typescriptlang.org/tsconfig#allowArbitraryExtensions).

## Getting started

A minimal app might look something like this: 

```typescript
import {View, getDeviceProfile, getBundledImports} from "@novorender/web_app";

async function main(canvas: HTMLCanvasElement) {
    const gpuTier = 2; // Laptop with reasonably new/powerful GPU.
    const deviceProfile = getDeviceProfile(gpuTier);
    const imports = await getBundledImports();
    const view = new View(canvas, deviceProfile, imports);
    await view.run();
    view.dispose();
}

main(document.getElementFromId("render_canvas"));
```

If everything succeeds, this should render an image with a minor gradient of gray. To make it a little more interesting, we can change the `RenderState` to include a grid.

```typescript
    ...
    const view = new View(canvas, deviceProfile, imports);
    view.modifyRenderState({ grid: { enabled: true } });
    await view.run();
    ...
```

The view already has camera controller built in, so you can move around and enjoy your grid with the mouse and/or keyboard, or even touch gestures.

## Next steps

Getting that first view up and running is an important step. Now you can actually start to make your application. Please see the [documentation](https://docs.novorender.com) for tutorials, examples and a detailed reference manual!
