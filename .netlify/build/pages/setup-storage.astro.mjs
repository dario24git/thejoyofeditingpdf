/* empty css                                     */
import { e as createComponent, k as renderComponent, l as renderScript, r as renderTemplate, m as maybeRenderHead } from '../chunks/astro/server_Mc8Liwsa.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../chunks/Layout_BLWf09ZG.mjs';
export { renderers } from '../renderers.mjs';

const $$SetupStorage = createComponent(async ($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Setup Storage - PDFManager" }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="min-h-screen bg-gray-50 py-12"> <div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8"> <div class="bg-white shadow rounded-lg p-6"> <h1 class="text-2xl font-bold text-gray-900 mb-6">Setup Storage Bucket</h1> <div class="mb-6"> <p class="text-gray-600">
This will create the required PDF storage bucket in your Supabase project.
</p> </div> <div id="status" class="mb-6"> <!-- Status messages will appear here --> </div> <div class="space-y-4"> <button id="create-bucket" class="w-full bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md font-medium">
Create PDF Storage Bucket
</button> <button id="check-status" class="w-full bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md font-medium">
Check Current Status
</button> <a href="/supabase-check" class="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium">
Run Full Configuration Check
</a> </div> </div> </div> </div> ` })} ${renderScript($$result, "/home/project/src/pages/setup-storage.astro?astro&type=script&index=0&lang.ts")}`;
}, "/home/project/src/pages/setup-storage.astro", void 0);

const $$file = "/home/project/src/pages/setup-storage.astro";
const $$url = "/setup-storage";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$SetupStorage,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
