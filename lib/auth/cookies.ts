const AUTH_COOKIE_NAME = "auth_present";

export function setAuthCookie() {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${AUTH_COOKIE_NAME}=1; Path=/; SameSite=Lax`;
}

export function clearAuthCookie() {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${AUTH_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
}

export function getAuthCookieName() {
  return AUTH_COOKIE_NAME;
}
