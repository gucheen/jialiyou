"use client";

import { FormEvent, useState } from "react";

export default function LoginForm() {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "登录失败");
      window.location.replace("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "登录失败，请稍后重试");
      setSubmitting(false);
    }
  };

  return (
    <form className="login-form" onSubmit={submit}>
      <label>用户名<input name="username" autoComplete="username" autoFocus required placeholder="请输入用户名" /></label>
      <label>密码<input name="password" type="password" autoComplete="current-password" required placeholder="请输入密码" /></label>
      {error && <p className="login-error" role="alert">{error}</p>}
      <button disabled={submitting}>{submitting ? "正在登录…" : "进入我们的家"}</button>
    </form>
  );
}
