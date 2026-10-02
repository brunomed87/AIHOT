/** Login returns to an admin document, never a React Router single-fetch endpoint. */
export function safeAdminReturn(target: string): string {
  let path = target;
  // Reverse proxies may supply the complete original URL; use only its path and query.
  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      path = `${url.pathname}${url.search}`;
    } catch {
      return "/admin";
    }
  }
  if (!/^\/admin(?:\.data)?(?:\/|\?|$)/.test(path)) return "/admin";
  const url = new URL(path, "http://admin.local");
  url.pathname = url.pathname.replace(/\.data$/, "");
  if (!/^\/admin(?:\/|$)/.test(url.pathname)) return "/admin";
  url.searchParams.delete("_routes");
  return `${url.pathname}${url.search}${url.hash}`;
}
