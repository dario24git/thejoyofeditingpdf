import { renderers } from './renderers.mjs';
import { s as serverEntrypointModule } from './chunks/_@astrojs-ssr-adapter_CvSoi7hX.mjs';
import { manifest } from './manifest_CyFORIOI.mjs';
import { createExports } from '@astrojs/netlify/ssr-function.js';

const serverIslandMap = new Map();;

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/dashboard.astro.mjs');
const _page2 = () => import('./pages/edit-pdf/_id_.astro.mjs');
const _page3 = () => import('./pages/reset-password.astro.mjs');
const _page4 = () => import('./pages/setup-storage.astro.mjs');
const _page5 = () => import('./pages/signin.astro.mjs');
const _page6 = () => import('./pages/signup.astro.mjs');
const _page7 = () => import('./pages/supabase-check.astro.mjs');
const _page8 = () => import('./pages/verify-ocr.astro.mjs');
const _page9 = () => import('./pages/index.astro.mjs');
const pageMap = new Map([
    ["node_modules/astro/dist/assets/endpoint/generic.js", _page0],
    ["src/pages/dashboard.astro", _page1],
    ["src/pages/edit-pdf/[id].astro", _page2],
    ["src/pages/reset-password.astro", _page3],
    ["src/pages/setup-storage.astro", _page4],
    ["src/pages/signin.astro", _page5],
    ["src/pages/signup.astro", _page6],
    ["src/pages/supabase-check.astro", _page7],
    ["src/pages/verify-ocr.astro", _page8],
    ["src/pages/index.astro", _page9]
]);

const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    actions: () => import('./_noop-actions.mjs'),
    middleware: () => import('./_noop-middleware.mjs')
});
const _args = {
    "middlewareSecret": "2d33f990-fca1-4a98-b315-3c6599c0b328"
};
const _exports = createExports(_manifest, _args);
const __astrojsSsrVirtualEntry = _exports.default;
const _start = 'start';
if (_start in serverEntrypointModule) {
	serverEntrypointModule[_start](_manifest, _args);
}

export { __astrojsSsrVirtualEntry as default, pageMap };
