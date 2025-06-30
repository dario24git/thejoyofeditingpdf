import '@astrojs/internal-helpers/path';
import 'kleur/colors';
import { q as NOOP_MIDDLEWARE_HEADER, v as decodeKey } from './chunks/astro/server_Mc8Liwsa.mjs';
import 'clsx';
import 'cookie';
import 'es-module-lexer';
import 'html-escaper';

const NOOP_MIDDLEWARE_FN = async (_ctx, next) => {
  const response = await next();
  response.headers.set(NOOP_MIDDLEWARE_HEADER, "true");
  return response;
};

const codeToStatusMap = {
  // Implemented from IANA HTTP Status Code Registry
  // https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  NOT_ACCEPTABLE: 406,
  PROXY_AUTHENTICATION_REQUIRED: 407,
  REQUEST_TIMEOUT: 408,
  CONFLICT: 409,
  GONE: 410,
  LENGTH_REQUIRED: 411,
  PRECONDITION_FAILED: 412,
  CONTENT_TOO_LARGE: 413,
  URI_TOO_LONG: 414,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RANGE_NOT_SATISFIABLE: 416,
  EXPECTATION_FAILED: 417,
  MISDIRECTED_REQUEST: 421,
  UNPROCESSABLE_CONTENT: 422,
  LOCKED: 423,
  FAILED_DEPENDENCY: 424,
  TOO_EARLY: 425,
  UPGRADE_REQUIRED: 426,
  PRECONDITION_REQUIRED: 428,
  TOO_MANY_REQUESTS: 429,
  REQUEST_HEADER_FIELDS_TOO_LARGE: 431,
  UNAVAILABLE_FOR_LEGAL_REASONS: 451,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  HTTP_VERSION_NOT_SUPPORTED: 505,
  VARIANT_ALSO_NEGOTIATES: 506,
  INSUFFICIENT_STORAGE: 507,
  LOOP_DETECTED: 508,
  NETWORK_AUTHENTICATION_REQUIRED: 511
};
Object.entries(codeToStatusMap).reduce(
  // reverse the key-value pairs
  (acc, [key, value]) => ({ ...acc, [value]: key }),
  {}
);

function sanitizeParams(params) {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      if (typeof value === "string") {
        return [key, value.normalize().replace(/#/g, "%23").replace(/\?/g, "%3F")];
      }
      return [key, value];
    })
  );
}
function getParameter(part, params) {
  if (part.spread) {
    return params[part.content.slice(3)] || "";
  }
  if (part.dynamic) {
    if (!params[part.content]) {
      throw new TypeError(`Missing parameter: ${part.content}`);
    }
    return params[part.content];
  }
  return part.content.normalize().replace(/\?/g, "%3F").replace(/#/g, "%23").replace(/%5B/g, "[").replace(/%5D/g, "]");
}
function getSegment(segment, params) {
  const segmentPath = segment.map((part) => getParameter(part, params)).join("");
  return segmentPath ? "/" + segmentPath : "";
}
function getRouteGenerator(segments, addTrailingSlash) {
  return (params) => {
    const sanitizedParams = sanitizeParams(params);
    let trailing = "";
    if (addTrailingSlash === "always" && segments.length) {
      trailing = "/";
    }
    const path = segments.map((segment) => getSegment(segment, sanitizedParams)).join("") + trailing;
    return path || "/";
  };
}

function deserializeRouteData(rawRouteData) {
  return {
    route: rawRouteData.route,
    type: rawRouteData.type,
    pattern: new RegExp(rawRouteData.pattern),
    params: rawRouteData.params,
    component: rawRouteData.component,
    generate: getRouteGenerator(rawRouteData.segments, rawRouteData._meta.trailingSlash),
    pathname: rawRouteData.pathname || void 0,
    segments: rawRouteData.segments,
    prerender: rawRouteData.prerender,
    redirect: rawRouteData.redirect,
    redirectRoute: rawRouteData.redirectRoute ? deserializeRouteData(rawRouteData.redirectRoute) : void 0,
    fallbackRoutes: rawRouteData.fallbackRoutes.map((fallback) => {
      return deserializeRouteData(fallback);
    }),
    isIndex: rawRouteData.isIndex,
    origin: rawRouteData.origin
  };
}

function deserializeManifest(serializedManifest) {
  const routes = [];
  for (const serializedRoute of serializedManifest.routes) {
    routes.push({
      ...serializedRoute,
      routeData: deserializeRouteData(serializedRoute.routeData)
    });
    const route = serializedRoute;
    route.routeData = deserializeRouteData(serializedRoute.routeData);
  }
  const assets = new Set(serializedManifest.assets);
  const componentMetadata = new Map(serializedManifest.componentMetadata);
  const inlinedScripts = new Map(serializedManifest.inlinedScripts);
  const clientDirectives = new Map(serializedManifest.clientDirectives);
  const serverIslandNameMap = new Map(serializedManifest.serverIslandNameMap);
  const key = decodeKey(serializedManifest.key);
  return {
    // in case user middleware exists, this no-op middleware will be reassigned (see plugin-ssr.ts)
    middleware() {
      return { onRequest: NOOP_MIDDLEWARE_FN };
    },
    ...serializedManifest,
    assets,
    componentMetadata,
    inlinedScripts,
    clientDirectives,
    routes,
    serverIslandNameMap,
    key
  };
}

const manifest = deserializeManifest({"hrefRoot":"file:///home/project/","cacheDir":"file:///home/project/node_modules/.astro/","outDir":"file:///home/project/dist/","srcDir":"file:///home/project/src/","publicDir":"file:///home/project/public/","buildClientDir":"file:///home/project/dist/","buildServerDir":"file:///home/project/.netlify/build/","adapterName":"@astrojs/netlify","routes":[{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"page","component":"_server-islands.astro","params":["name"],"segments":[[{"content":"_server-islands","dynamic":false,"spread":false}],[{"content":"name","dynamic":true,"spread":false}]],"pattern":"^\\/_server-islands\\/([^/]+?)\\/?$","prerender":false,"isIndex":false,"fallbackRoutes":[],"route":"/_server-islands/[name]","origin":"internal","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"endpoint","isIndex":false,"route":"/_image","pattern":"^\\/_image\\/?$","segments":[[{"content":"_image","dynamic":false,"spread":false}]],"params":[],"component":"node_modules/astro/dist/assets/endpoint/generic.js","pathname":"/_image","prerender":false,"fallbackRoutes":[],"origin":"internal","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"external","src":"/_astro/dashboard.D011sXyU.css"}],"routeData":{"route":"/dashboard","isIndex":false,"type":"page","pattern":"^\\/dashboard\\/?$","segments":[[{"content":"dashboard","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/dashboard.astro","pathname":"/dashboard","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"external","src":"/_astro/dashboard.D011sXyU.css"}],"routeData":{"route":"/edit-pdf/[id]","isIndex":false,"type":"page","pattern":"^\\/edit-pdf\\/([^/]+?)\\/?$","segments":[[{"content":"edit-pdf","dynamic":false,"spread":false}],[{"content":"id","dynamic":true,"spread":false}]],"params":["id"],"component":"src/pages/edit-pdf/[id].astro","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"external","src":"/_astro/dashboard.D011sXyU.css"}],"routeData":{"route":"/reset-password","isIndex":false,"type":"page","pattern":"^\\/reset-password\\/?$","segments":[[{"content":"reset-password","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/reset-password.astro","pathname":"/reset-password","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"external","src":"/_astro/dashboard.D011sXyU.css"}],"routeData":{"route":"/setup-storage","isIndex":false,"type":"page","pattern":"^\\/setup-storage\\/?$","segments":[[{"content":"setup-storage","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/setup-storage.astro","pathname":"/setup-storage","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"external","src":"/_astro/dashboard.D011sXyU.css"}],"routeData":{"route":"/signin","isIndex":false,"type":"page","pattern":"^\\/signin\\/?$","segments":[[{"content":"signin","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/signin.astro","pathname":"/signin","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"external","src":"/_astro/dashboard.D011sXyU.css"}],"routeData":{"route":"/signup","isIndex":false,"type":"page","pattern":"^\\/signup\\/?$","segments":[[{"content":"signup","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/signup.astro","pathname":"/signup","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"external","src":"/_astro/dashboard.D011sXyU.css"}],"routeData":{"route":"/supabase-check","isIndex":false,"type":"page","pattern":"^\\/supabase-check\\/?$","segments":[[{"content":"supabase-check","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/supabase-check.astro","pathname":"/supabase-check","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"external","src":"/_astro/dashboard.D011sXyU.css"}],"routeData":{"route":"/verify-ocr","isIndex":false,"type":"page","pattern":"^\\/verify-ocr\\/?$","segments":[[{"content":"verify-ocr","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/verify-ocr.astro","pathname":"/verify-ocr","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[{"type":"external","src":"/_astro/dashboard.D011sXyU.css"},{"type":"inline","content":"@keyframes float{0%,to{transform:translateY(0)}50%{transform:translateY(-20px)}}@keyframes float-delayed{0%,to{transform:translateY(0)}50%{transform:translateY(-15px)}}.animate-float[data-astro-cid-j7pv25f6]{animation:float 3s ease-in-out infinite}.animate-float-delayed[data-astro-cid-j7pv25f6]{animation:float-delayed 3s ease-in-out infinite 1.5s}\n"}],"routeData":{"route":"/","isIndex":true,"type":"page","pattern":"^\\/$","segments":[],"params":[],"component":"src/pages/index.astro","pathname":"/","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}}],"base":"/","trailingSlash":"ignore","compressHTML":true,"componentMetadata":[["/home/project/src/pages/dashboard.astro",{"propagation":"none","containsHead":true}],["/home/project/src/pages/edit-pdf/[id].astro",{"propagation":"none","containsHead":true}],["/home/project/src/pages/index.astro",{"propagation":"none","containsHead":true}],["/home/project/src/pages/reset-password.astro",{"propagation":"none","containsHead":true}],["/home/project/src/pages/setup-storage.astro",{"propagation":"none","containsHead":true}],["/home/project/src/pages/signin.astro",{"propagation":"none","containsHead":true}],["/home/project/src/pages/signup.astro",{"propagation":"none","containsHead":true}],["/home/project/src/pages/supabase-check.astro",{"propagation":"none","containsHead":true}],["/home/project/src/pages/verify-ocr.astro",{"propagation":"none","containsHead":true}]],"renderers":[],"clientDirectives":[["idle","(()=>{var l=(n,t)=>{let i=async()=>{await(await n())()},e=typeof t.value==\"object\"?t.value:void 0,s={timeout:e==null?void 0:e.timeout};\"requestIdleCallback\"in window?window.requestIdleCallback(i,s):setTimeout(i,s.timeout||200)};(self.Astro||(self.Astro={})).idle=l;window.dispatchEvent(new Event(\"astro:idle\"));})();"],["load","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).load=e;window.dispatchEvent(new Event(\"astro:load\"));})();"],["media","(()=>{var n=(a,t)=>{let i=async()=>{await(await a())()};if(t.value){let e=matchMedia(t.value);e.matches?i():e.addEventListener(\"change\",i,{once:!0})}};(self.Astro||(self.Astro={})).media=n;window.dispatchEvent(new Event(\"astro:media\"));})();"],["only","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).only=e;window.dispatchEvent(new Event(\"astro:only\"));})();"],["visible","(()=>{var a=(s,i,o)=>{let r=async()=>{await(await s())()},t=typeof i.value==\"object\"?i.value:void 0,c={rootMargin:t==null?void 0:t.rootMargin},n=new IntersectionObserver(e=>{for(let l of e)if(l.isIntersecting){n.disconnect(),r();break}},c);for(let e of o.children)n.observe(e)};(self.Astro||(self.Astro={})).visible=a;window.dispatchEvent(new Event(\"astro:visible\"));})();"]],"entryModules":{"\u0000noop-middleware":"_noop-middleware.mjs","\u0000noop-actions":"_noop-actions.mjs","\u0000@astro-page:src/pages/dashboard@_@astro":"pages/dashboard.astro.mjs","\u0000@astro-page:src/pages/edit-pdf/[id]@_@astro":"pages/edit-pdf/_id_.astro.mjs","\u0000@astro-page:src/pages/reset-password@_@astro":"pages/reset-password.astro.mjs","\u0000@astro-page:src/pages/setup-storage@_@astro":"pages/setup-storage.astro.mjs","\u0000@astro-page:src/pages/signin@_@astro":"pages/signin.astro.mjs","\u0000@astro-page:src/pages/signup@_@astro":"pages/signup.astro.mjs","\u0000@astro-page:src/pages/supabase-check@_@astro":"pages/supabase-check.astro.mjs","\u0000@astro-page:src/pages/verify-ocr@_@astro":"pages/verify-ocr.astro.mjs","\u0000@astro-page:src/pages/index@_@astro":"pages/index.astro.mjs","\u0000@astrojs-ssr-virtual-entry":"entry.mjs","\u0000@astro-renderers":"renderers.mjs","\u0000@astro-page:node_modules/astro/dist/assets/endpoint/generic@_@js":"pages/_image.astro.mjs","\u0000@astrojs-ssr-adapter":"_@astrojs-ssr-adapter.mjs","\u0000@astrojs-manifest":"manifest_CyFORIOI.mjs","/home/project/node_modules/unstorage/drivers/fs-lite.mjs":"chunks/fs-lite_COtHaKzy.mjs","/home/project/node_modules/astro/dist/assets/services/sharp.js":"chunks/sharp_D4zCyR8t.mjs","/home/project/src/pages/dashboard.astro?astro&type=script&index=0&lang.ts":"_astro/dashboard.astro_astro_type_script_index_0_lang.DBo6Au2J.js","/home/project/src/pages/setup-storage.astro?astro&type=script&index=0&lang.ts":"_astro/setup-storage.astro_astro_type_script_index_0_lang.DJZCpL5U.js","/home/project/src/pages/supabase-check.astro?astro&type=script&index=0&lang.ts":"_astro/supabase-check.astro_astro_type_script_index_0_lang.CDUROqG2.js","/home/project/src/pages/verify-ocr.astro?astro&type=script&index=0&lang.ts":"_astro/verify-ocr.astro_astro_type_script_index_0_lang.C8er30Cq.js","/home/project/src/components/AuthForm.astro?astro&type=script&index=0&lang.ts":"_astro/AuthForm.astro_astro_type_script_index_0_lang.Cywemt8A.js","/home/project/src/lib/auth.ts":"_astro/auth.B5Qapn7b.js","/home/project/src/lib/pdf.ts":"_astro/pdf.DXwvIVYu.js","/home/project/src/lib/ocr.ts":"_astro/ocr.Ble24yD1.js","/home/project/src/lib/setup-storage.ts":"_astro/setup-storage.BPBYZvML.js","/home/project/src/lib/supabase-check.ts":"_astro/supabase-check.Ckt6vqv1.js","/home/project/src/lib/supabase.ts":"_astro/supabase.mlQS97a7.js","astro:scripts/before-hydration.js":""},"inlinedScripts":[],"assets":["/_astro/dashboard.D011sXyU.css","/A_painter_editing_a_pdf_like_it_was_a_canvas.png","/favicon.svg","/pdf.worker.min.mjs","/_astro/AuthForm.astro_astro_type_script_index_0_lang.Cywemt8A.js","/_astro/auth.B5Qapn7b.js","/_astro/dashboard.astro_astro_type_script_index_0_lang.DBo6Au2J.js","/_astro/ocr.Ble24yD1.js","/_astro/pdf.DXwvIVYu.js","/_astro/preload-helper.BlTxHScW.js","/_astro/setup-storage.BPBYZvML.js","/_astro/setup-storage.astro_astro_type_script_index_0_lang.DJZCpL5U.js","/_astro/supabase-check.Ckt6vqv1.js","/_astro/supabase-check.astro_astro_type_script_index_0_lang.CDUROqG2.js","/_astro/supabase.mlQS97a7.js","/_astro/verify-ocr.astro_astro_type_script_index_0_lang.C8er30Cq.js"],"buildFormat":"directory","checkOrigin":true,"serverIslandNameMap":[],"key":"IXw6aMBN3VLQDKdcTfier7SBTSyieoJv87r01lidvmA=","sessionConfig":{"driver":"fs-lite","options":{"base":"/home/project/node_modules/.astro/sessions"}}});
if (manifest.sessionConfig) manifest.sessionConfig.driverModule = () => import('./chunks/fs-lite_COtHaKzy.mjs');

export { manifest };
