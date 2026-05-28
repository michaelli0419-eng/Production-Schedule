import { useEffect, useMemo, useState } from "react";
import ProductionScheduler from "./components/ProductionScheduler.jsx";

const SESSION_KEY = "scm-production-session";
const USERS = [
  {
    email: "michael@silvercreek.local",
    name: "Michael Li",
    accessCode: "2468",
    role: "Executive",
    canViewPrices: true,
  },
  {
    email: "estimating@silvercreek.local",
    name: "Estimating Team",
    accessCode: "1357",
    role: "Estimating",
    canViewPrices: true,
  },
  {
    email: "sales@silvercreek.local",
    name: "Sales Team",
    accessCode: "2222",
    role: "Sales",
    canViewPrices: false,
  },
  {
    email: "production@silvercreek.local",
    name: "Production Team",
    accessCode: "1111",
    role: "Production",
    canViewPrices: false,
  },
];

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");

  function submitLogin(event) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const user = USERS.find(
      (item) => item.email === normalizedEmail && item.accessCode === accessCode.trim(),
    );

    if (!user) {
      setError("Email or access code does not match an approved user.");
      return;
    }

    setError("");
    onLogin({
      email: user.email,
      name: user.name,
      role: user.role,
      canViewPrices: user.canViewPrices,
    });
  }

  return (
    <main className="ps-login-shell">
      <section className="ps-login-panel" aria-label="Sales pipeline login">
        <div className="ps-login-brand">
          <p className="ps-eyebrow">Silver Creek Modular</p>
          <h1>Sales Pipeline Login</h1>
          <span>Sign in to open the operating schedule. Price fields are limited to approved estimating and executive users.</span>
        </div>
        <form className="ps-login-form" onSubmit={submitLogin}>
          <label>
            Email
            <input
              autoComplete="email"
              autoFocus
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@silvercreek.local"
            />
          </label>
          <label>
            Access code
            <input
              autoComplete="current-password"
              type="password"
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              placeholder="Enter code"
            />
          </label>
          {error && <p className="ps-login-error">{error}</p>}
          <button type="submit">Log in</button>
        </form>
        <div className="ps-login-note">
          <strong>Demo access</strong>
          <span>Pricing: michael@silvercreek.local / 2468</span>
          <span>No pricing: sales@silvercreek.local / 2222</span>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const savedSession = window.localStorage.getItem(SESSION_KEY);
    if (!savedSession) return;

    try {
      const session = JSON.parse(savedSession);
      if (session?.email) setCurrentUser(session);
    } catch {
      window.localStorage.removeItem(SESSION_KEY);
    }
  }, []);

  const permissions = useMemo(() => ({
    canViewPrices: Boolean(currentUser?.canViewPrices),
  }), [currentUser]);

  function handleLogin(user) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    setCurrentUser(user);
  }

  function handleLogout() {
    window.localStorage.removeItem(SESSION_KEY);
    setCurrentUser(null);
  }

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <ProductionScheduler
      currentUser={currentUser}
      permissions={permissions}
      onLogout={handleLogout}
    />
  );
}
