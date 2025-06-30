/* empty css                                     */
import { e as createComponent, k as renderComponent, r as renderTemplate } from '../chunks/astro/server_Mc8Liwsa.mjs';
import 'kleur/colors';
import { $ as $$AuthForm } from '../chunks/AuthForm_Bwwo80mj.mjs';
import { $ as $$Layout } from '../chunks/Layout_BLWf09ZG.mjs';
export { renderers } from '../renderers.mjs';

const $$Signin = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Sign In - PDFManager" }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "AuthForm", $$AuthForm, { "type": "signin", "title": "Sign in to your account", "subtitle": "Access your PDF documents securely" })} ` })}`;
}, "/home/project/src/pages/signin.astro", void 0);

const $$file = "/home/project/src/pages/signin.astro";
const $$url = "/signin";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Signin,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
