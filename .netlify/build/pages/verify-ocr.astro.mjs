/* empty css                                     */
import { e as createComponent, k as renderComponent, l as renderScript, r as renderTemplate, m as maybeRenderHead } from '../chunks/astro/server_Mc8Liwsa.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../chunks/Layout_BLWf09ZG.mjs';
export { renderers } from '../renderers.mjs';

const $$VerifyOcr = createComponent(async ($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Verify OCR Data - PDFManager" }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="min-h-screen bg-gray-50 py-12"> <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8"> <div class="bg-white shadow rounded-lg p-6"> <div class="flex items-center justify-between mb-6"> <h1 class="text-2xl font-bold text-gray-900">OCR Data Verification</h1> <a href="/dashboard" class="text-primary-600 hover:text-primary-700 text-sm font-medium">
← Back to Dashboard
</a> </div> <div id="loading" class="text-center py-8"> <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div> <p class="mt-4 text-gray-600">Loading OCR data...</p> </div> <div id="results" class="hidden space-y-6"> <!-- Results will be populated by JavaScript --> </div> <div class="mt-6"> <button id="refresh" class="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md text-sm font-medium">
Refresh Data
</button> </div> </div> </div> </div> ` })} ${renderScript($$result, "/home/project/src/pages/verify-ocr.astro?astro&type=script&index=0&lang.ts")} `;
}, "/home/project/src/pages/verify-ocr.astro", void 0);

const $$file = "/home/project/src/pages/verify-ocr.astro";
const $$url = "/verify-ocr";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$VerifyOcr,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
