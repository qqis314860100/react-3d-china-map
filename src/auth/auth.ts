export type AuthUser = {
  username: string;
};

export type AuthState = {
  token: string;
  user: AuthUser;
  createdAt: number;
};

const AUTH_KEY = "mp-auth";
const REMEMBER_USER_KEY = "mp-remember-username";
const POST_LOGIN_URL_KEY = "mp-post-login-url";

// 登录有效期：默认 8 小时（可按需调整）
export const AUTH_TTL_MS = 8 * 60 * 60 * 1000;

export function getRememberedUsername(): string {
  try {
    return localStorage.getItem(REMEMBER_USER_KEY) || "";
  } catch {
    return "";
  }
}

export function setRememberedUsername(username: string) {
  try {
    localStorage.setItem(REMEMBER_USER_KEY, username);
  } catch {
    // ignore
  }
}

export function clearRememberedUsername() {
  try {
    localStorage.removeItem(REMEMBER_USER_KEY);
  } catch {
    // ignore
  }
}

export function readAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthState;
    if (!parsed?.token || !parsed?.user?.username) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isAuthExpired(state: AuthState, now: number = Date.now()) {
  if (!state?.createdAt) return true;
  return now - state.createdAt > AUTH_TTL_MS;
}

/**
 * 获取有效登录信息：无效/过期则清理并返回 null
 */
export function getValidAuth(now: number = Date.now()): AuthState | null {
  const state = readAuth();
  if (!state) return null;
  if (isAuthExpired(state, now)) {
    clearAuth();
    return null;
  }
  return state;
}

export function writeAuth(user: AuthUser): AuthState {
  const state: AuthState = {
    token: `demo-${Date.now()}`,
    user,
    createdAt: Date.now(),
  };
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
  return state;
}

export function clearAuth() {
  try {
    localStorage.removeItem(AUTH_KEY);
  } catch {
    // ignore
  }
}

export function setPostLoginUrl(url: string) {
  try {
    sessionStorage.setItem(POST_LOGIN_URL_KEY, url);
  } catch {
    // ignore
  }
}

export function consumePostLoginUrl(): string {
  try {
    const url = sessionStorage.getItem(POST_LOGIN_URL_KEY) || "";
    sessionStorage.removeItem(POST_LOGIN_URL_KEY);
    return url;
  } catch {
    return "";
  }
}

export function appendTokenToUrl(url: string, token: string) {
  try {
    const u = new URL(url, window.location.origin);
    u.searchParams.set("token", token);
    return u.toString();
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}token=${encodeURIComponent(token)}`;
  }
}

/**
 * 用于“基地/城市外链跳转”的统一入口：
 * - 有登录且未过期：携带 token 打开新窗口
 * - 否则：记录待跳转地址并跳到登录页
 */
export function openExternalWithAuthGuard(url?: string) {
  if (!url) return;
  const auth = getValidAuth();
  if (auth) {
    const finalUrl = appendTokenToUrl(url, auth.token);
    window.open(finalUrl, "_blank", "noopener,noreferrer");
    return;
  }

  setPostLoginUrl(url);
  // HashRouter：直接切到登录路由
  window.location.hash = "#/login";
}

/**
 * Demo 登录校验：
 * - 账号：admin
 * - 密码：123456
 */
export function validateLogin(username: string, password: string) {
  const u = (username || "").trim();
  const p = (password || "").trim();
  if (!u || !p) return { ok: false, message: "请输入账号和密码" };
  if (u !== "admin" || p !== "123456") {
    return { ok: false, message: "账号或密码不正确（演示：admin / 123456）" };
  }
  return { ok: true as const };
}


