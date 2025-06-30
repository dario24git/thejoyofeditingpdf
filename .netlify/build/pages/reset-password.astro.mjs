/* empty css                                     */
import { e as createComponent, k as renderComponent, r as renderTemplate } from '../chunks/astro/server_Mc8Liwsa.mjs';
import 'kleur/colors';
import { $ as $$AuthForm } from '../chunks/AuthForm_Bwwo80mj.mjs';
import { $ as $$Layout } from '../chunks/Layout_BLWf09ZG.mjs';
export { renderers } from '../renderers.mjs';

const $$ResetPassword = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Reset Password - PDFManager" }, { "default": ($$result2) => renderTemplate` ${renderComponent($$result2, "AuthForm", $$AuthForm, { "type": "reset", "title": "Reset your password", "subtitle": "Enter your email to receive a reset link" })} ` })}`;
}, "/home/project/src/pages/reset-password.astro", void 0);

const $$file = "/home/project/src/pages/reset-password.astro";
const $$url = "/reset-password";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$ResetPassword,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
