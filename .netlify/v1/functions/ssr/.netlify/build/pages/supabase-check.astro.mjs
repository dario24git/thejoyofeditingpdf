/* empty css                                     */
import { e as createComponent, k as renderComponent, l as renderScript, r as renderTemplate, m as maybeRenderHead } from '../chunks/astro/server_Mc8Liwsa.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../chunks/Layout_BLWf09ZG.mjs';
export { renderers } from '../renderers.mjs';

const $$SupabaseCheck = createComponent(async ($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Supabase Configuration Check" }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="min-h-screen bg-gray-50 py-12"> <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8"> <div class="bg-white shadow rounded-lg p-6"> <div class="flex items-center justify-between mb-6"> <h1 class="text-2xl font-bold text-gray-900">Supabase Configuration Check</h1> <a href="/dashboard" class="text-primary-600 hover:text-primary-700 text-sm font-medium">
← Back to Dashboard
</a> </div> <div id="loading" class="text-center py-8"> <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div> <p class="mt-4 text-gray-600">Checking Supabase configuration...</p> </div> <div id="results" class="hidden space-y-6"> <!-- Results will be populated by JavaScript --> </div> <div class="mt-6 flex flex-wrap gap-3"> <button id="recheck" class="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md text-sm font-medium">
Recheck Configuration
</button> <button id="test-upload" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium">
Test File Upload
</button> <button id="verify-bucket" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium">
Verify Bucket Exists
</button> <button id="show-debug" class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium">
Show Debug Info
</button> </div> <div id="debug-info" class="hidden mt-6 p-4 bg-gray-100 rounded-lg"> <h3 class="font-medium mb-2">Debug Information</h3> <pre id="debug-content" class="text-xs text-gray-700 overflow-auto max-h-96"></pre> </div> </div> </div> </div> ` })} ${renderScript($$result, "/home/project/src/pages/supabase-check.astro?astro&type=script&index=0&lang.ts")} `;
}, "/home/project/src/pages/supabase-check.astro", void 0);

const $$file = "/home/project/src/pages/supabase-check.astro";
const $$url = "/supabase-check";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$SupabaseCheck,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
