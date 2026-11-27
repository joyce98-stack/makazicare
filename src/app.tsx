import { FormEvent, useState } from "react";

type Role = "tenant" | "landlord" | "manager" | "admin";

const roleHomes: Record<Role, string> = {
  tenant: "/tenanthomepage.html",
  landlord: "/landlordhomepage.html",
  manager: "/propertymanager.html",
  admin: "/adminhomepage.html",
};

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("tenant");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Sign-in failed. Check your details and try again.");
      window.location.assign(roleHomes[role]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign in right now. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="sign-in-page">
      <section className="welcome-panel" aria-labelledby="welcome-title">
        <a className="brand" href="/" aria-label="Makazi Care home">
          <span className="brand-icon" aria-hidden="true">M</span>
          <span>MAKAZI <strong>CARE</strong></span>
        </a>
        <div className="welcome-copy">
          <p className="eyebrow">A better way to feel at home</p>
          <h1 id="welcome-title">Property care,<br /><em>made human.</em></h1>
          <p>One calm place to manage homes, rent, and the people who make a property feel like home.</p>
        </div>
        <p className="welcome-foot">Thoughtful property management for everyone under one roof.</p>
      </section>

      <section className="form-panel" aria-labelledby="sign-in-title">
        <div className="form-wrap">
          <p className="eyebrow">Welcome back</p>
          <h2 id="sign-in-title">Sign in to Makazi Care</h2>
          <p className="form-intro">Enter your account details to continue to your workspace.</p>

          <form onSubmit={signIn}>
            <label htmlFor="role">I am signing in as</label>
            <select id="role" value={role} onChange={(event) => setRole(event.target.value as Role)}>
              <option value="tenant">Tenant</option>
              <option value="landlord">Landlord</option>
              <option value="manager">Property manager</option>
              <option value="admin">System administrator</option>
            </select>

            <label htmlFor="email">Email address</label>
            <input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />

            <div className="password-label">
              <label htmlFor="password">Password</label>
              <a href="/forgot-password.html">Forgot password?</a>
            </div>
            <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" />

            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="submit-button" type="submit" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
              <span aria-hidden="true">→</span>
            </button>
          </form>

          <p className="register-links">
            New landlord? <a href="/landlord-register.html">Create an account</a>
            <br />
            Property manager? <a href="/manager-register.html">Create a listing</a>
          </p>
          <p className="secure-note"><span aria-hidden="true">▣</span> Your account is protected with a secure session.</p>
        </div>
      </section>
    </main>
  );
}
