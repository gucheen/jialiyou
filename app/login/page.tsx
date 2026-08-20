import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "./login-form";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand"><span className="brand-mark">有</span><strong>家里有</strong></div>
        <p className="login-kicker">欢迎回家</p>
        <h1>登录后看看<br />家里的近况</h1>
        <p className="login-intro">家庭物资和购物清单只对家人开放。</p>
        <LoginForm />
      </section>
      <aside className="login-art" aria-hidden="true"><div className="login-sun"></div><span>把日常安顿好，<br />生活就轻盈一点。</span><div className="login-bottle">HOME</div></aside>
    </main>
  );
}
