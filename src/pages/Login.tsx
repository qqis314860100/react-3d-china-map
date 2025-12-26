import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  clearRememberedUsername,
  consumePostLoginUrl,
  getRememberedUsername,
  getValidAuth,
  openExternalWithAuthGuard,
  setRememberedUsername,
} from "../auth/auth";
import { useAuth } from "../auth/AuthProvider";
import "./Login.css";

export default function Login() {
  const remembered = useMemo(() => getRememberedUsername(), []);
  const [username, setUsername] = useState<string>(remembered);
  const [password, setPassword] = useState<string>("");
  const [remember, setRemember] = useState<boolean>(!!remembered);
  const [error, setError] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const auth = useAuth();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    setSubmitting(true);
    try {
      if (remember) setRememberedUsername(username);
      else clearRememberedUsername();

      const res = auth.login(username, password);
      if (!res.ok) {
        setError(res.message);
        return;
      }

      const pending = consumePostLoginUrl();
      const state = getValidAuth();
      if (pending && state?.token) {
        // 登录完成后自动续跳：打开目标系统（携带 token）
        openExternalWithAuthGuard(pending);
      }
      navigate("/", { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page" role="main">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-title">MP智能驾舱平台</div>
          <div className="login-sub">请登录后进入系统</div>
        </div>

        <form className="login-form" onSubmit={onSubmit}>
          <label className="login-field">
            <span className="login-label">账号</span>
            <input
              className="login-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
            />
          </label>

          <label className="login-field">
            <span className="login-label">密码</span>
            <input
              className="login-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="123456"
              type="password"
              autoComplete="current-password"
            />
          </label>

          <div className="login-row">
            <label className="login-check">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              记住账号
            </label>

            <div className="login-hint">演示账号：admin / 123456</div>
          </div>

          {error ? <div className="login-error">{error}</div> : null}

          <button className="login-btn" type="submit" disabled={submitting}>
            {submitting ? "登录中..." : "登录"}
          </button>
        </form>
      </div>
    </div>
  );
}


