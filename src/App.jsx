import { useEffect, useMemo, useState } from "react";
import ProductionScheduler from "./components/ProductionScheduler.jsx";
import { isSupabaseEnabled, supabase } from "./lib/supabase.js";

const SESSION_KEY = "scm-production-session";
const EMERGENCY_ADMIN = {
  email: "michael@webbinvestments.com",
  accessCode: "Alpha2023!",
  name: "Michael Li",
  role: "Super Admin",
  canViewPrices: true,
};
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

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitLogin(event) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = accessCode.trim();

    if (
      normalizedEmail === EMERGENCY_ADMIN.email.toLowerCase()
      && normalizedCode === EMERGENCY_ADMIN.accessCode
    ) {
      setError("");
      onLogin({
        email: EMERGENCY_ADMIN.email,
        name: EMERGENCY_ADMIN.name,
        role: EMERGENCY_ADMIN.role,
        canViewPrices: EMERGENCY_ADMIN.canViewPrices,
      });
      return;
    }

    if (isSupabaseEnabled && supabase) {
      setBusy(true);
      setError("");
      const busyWatchdog = window.setTimeout(() => {
        setBusy(false);
        setError("Login is taking too long. Please try again.");
      }, 15000);
      try {
        const { data, error: signInError } = await withTimeout(
          supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password: normalizedCode,
          }),
          12000,
          "Sign-in timed out. Check internet/Supabase settings and try again.",
        );
        if (signInError) {
          setError(signInError.message || "Login failed.");
          return;
        }
        const authUser = data.user;
        if (!authUser) {
          setError("Login failed.");
          return;
        }
        const { data: profile } = await withTimeout(
          supabase
            .from("user_profiles")
            .select("full_name, role, can_view_prices")
            .eq("id", authUser.id)
            .maybeSingle(),
          12000,
          "Profile lookup timed out. Check Supabase table/policies and try again.",
        );

        onLogin({
          id: authUser.id,
          email: authUser.email || normalizedEmail,
          name: profile?.full_name || authUser.email || normalizedEmail,
          role: profile?.role || "User",
          canViewPrices: Boolean(profile?.can_view_prices),
        });
      } catch (err) {
        setError(err?.message || "Login failed. Please try again.");
      } finally {
        window.clearTimeout(busyWatchdog);
        setBusy(false);
      }
      return;
    }

    const user = USERS.find(
      (item) => item.email === normalizedEmail && item.accessCode === normalizedCode,
    );
    if (!user) {
      setError("Email or access code does not match an approved user.");
      return;
    }
    setError("");
    onLogin({ email: user.email, name: user.name, role: user.role, canViewPrices: user.canViewPrices });
  }

  return (
    <main className="ps-login-shell">
      {/* Left — brand panel */}
      <div className="ps-login-brand-panel">
        <div className="ps-login-brand-inner">
          <div className="ps-login-logo">
            <span>SC</span>
          </div>
          <h1>Silver Creek Modular</h1>
          <p>Integrated operations platform for production scheduling, project management, and sales pipeline.</p>
          <ul className="ps-login-features">
            <li>
              <span className="ps-login-feature-icon">▣</span>
              <span>Real-time production scheduling across all factory lines</span>
            </li>
            <li>
              <span className="ps-login-feature-icon">◈</span>
              <span>Submittal tracking, DSA approvals &amp; document control</span>
            </li>
            <li>
              <span className="ps-login-feature-icon">◉</span>
              <span>Sales pipeline from lead through contract handoff</span>
            </li>
            <li>
              <span className="ps-login-feature-icon">◆</span>
              <span>Capacity planning and forward-looking load forecasting</span>
            </li>
          </ul>
          <div className="ps-login-brand-footer">
            <span>© {new Date().getFullYear()} Silver Creek Modular · SCM Hub v2.0</span>
          </div>
        </div>
      </div>

      {/* Right — form panel */}
      <div className="ps-login-form-panel">
        <section className="ps-login-card" aria-label="Sign in">
          <div className="ps-login-card-head">
            <p className="ps-login-card-eyebrow">SCM Hub — Internal Portal</p>
            <h2>Sign in to your account</h2>
            <p className="ps-login-card-sub">Access is restricted to authorized Silver Creek Modular personnel.</p>
          </div>
          <form className="ps-login-form" onSubmit={submitLogin}>
            <label>
              Work Email
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
              Password / Access Code
              <input
                autoComplete="current-password"
                type="password"
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value)}
                placeholder="••••••••"
              />
            </label>
            {error && <p className="ps-login-error">{error}</p>}
            <button type="submit" className="ps-login-submit" disabled={busy}>
              {busy ? (
                <span className="ps-login-spinner">
                  <span />
                  Signing in…
                </span>
              ) : "Sign In"}
            </button>
          </form>
          {isSupabaseEnabled ? (
            <div className="ps-login-note">
              <strong>Supabase Auth active</strong>
              <span>Use your Supabase credentials.</span>
            </div>
          ) : (
            <div className="ps-login-note">
              <strong>Demo credentials</strong>
              <span>Exec: michael@silvercreek.local / 2468</span>
              <span>Sales: sales@silvercreek.local / 2222</span>
            </div>
          )}
          <p className="ps-login-help">Need access? Contact your system administrator.</p>
        </section>
      </div>
    </main>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    if (isSupabaseEnabled && supabase) {
      supabase.auth.getSession().then(async ({ data }) => {
        const sessionUser = data.session?.user;
        if (!sessionUser) return;
        try {
          const { data: profile } = await withTimeout(
            supabase
              .from("user_profiles")
              .select("full_name, role, can_view_prices")
              .eq("id", sessionUser.id)
              .maybeSingle(),
            8000,
            "Profile lookup timed out.",
          );
          setCurrentUser({
            id: sessionUser.id,
            email: sessionUser.email || "",
            name: profile?.full_name || sessionUser.email || "",
            role: profile?.role || "User",
            canViewPrices: Boolean(profile?.can_view_prices),
          });
        } catch {
          setCurrentUser({
            id: sessionUser.id,
            email: sessionUser.email || "",
            name: sessionUser.email || "",
            role: "User",
            canViewPrices: false,
          });
        }
      });
      const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
        const sessionUser = session?.user;
        if (!sessionUser) {
          setCurrentUser(null);
          return;
        }
        try {
          const { data: profile } = await withTimeout(
            supabase
              .from("user_profiles")
              .select("full_name, role, can_view_prices")
              .eq("id", sessionUser.id)
              .maybeSingle(),
            8000,
            "Profile lookup timed out.",
          );
          setCurrentUser({
            id: sessionUser.id,
            email: sessionUser.email || "",
            name: profile?.full_name || sessionUser.email || "",
            role: profile?.role || "User",
            canViewPrices: Boolean(profile?.can_view_prices),
          });
        } catch {
          setCurrentUser({
            id: sessionUser.id,
            email: sessionUser.email || "",
            name: sessionUser.email || "",
            role: "User",
            canViewPrices: false,
          });
        }
      });
      return () => authListener.subscription.unsubscribe();
    }

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
    if (!isSupabaseEnabled) {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    }
    setCurrentUser(user);
  }

  async function handleLogout() {
    if (isSupabaseEnabled && supabase) {
      await supabase.auth.signOut();
    }
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
