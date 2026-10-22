import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import logo from "../assets/wdragen.jpeg";

// Adjust this to match your actual Django endpoint (e.g. simplejwt default is /api/token/)
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.username || !form.password) {
      setError("Enter your username and password to continue.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.username, password: form.password }),
      });
      const data = await res.json().catch(() => ({}));

      console.log("LOGIN STATUS:", res.status);
      console.log("LOGIN RESPONSE:", data);

      if (!res.ok) {
        throw new Error(
          data.detail || data.error || "Login failed"
        );
      }

      localStorage.setItem("access", data.access);
      localStorage.setItem("refresh", data.refresh);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-[#FAF8F5] text-[#111110] font-sans antialiased selection:bg-[#111110] selection:text-[#FAF8F5]">
      
      {/* LEFT — Ultra-Clean Minimalist Editorial Hero */}
      <div className="hidden lg:flex lg:w-[50%] xl:w-[52%] relative bg-[#111110] overflow-hidden flex-col justify-between p-12 xl:p-16 border-r border-[#262422]">
        
        {/* Subtle Architectural Grid Accent */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(#FAF8F5 1px, transparent 1px), linear-gradient(90deg, #FAF8F5 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />

        {/* Ambient Warm Atmosphere Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-[#B58A3B]/[0.04] rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Tag */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#B58A3B]" />
            <span className="text-[11px] font-mono tracking-widest uppercase text-[#8C867A]">
              Document Studio
            </span>
          </div>
          <span className="text-[11px] font-mono text-[#6B665E] border border-[#2D2A26] px-2.5 py-0.5 rounded-full">
            RAG Engine v2.5
          </span>
        </div>

        {/* Center: Hero Identity (Logo, Bold Typographic DRAGEN, Tagline) */}
        <div className="relative z-10 my-auto text-center flex flex-col items-center justify-center max-w-lg mx-auto py-8">
          
          {/* Logo Frame */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-[#181715] border border-[#2D2A26] p-3.5 flex items-center justify-center mb-8 shadow-2xl shadow-black/80 ring-1 ring-[#FAF8F5]/5">
            <img
              src={logo}
              alt="DRAGEN Logo"
              className="w-full h-full object-contain rounded-2xl filter brightness-95 contrast-105"
            />
          </div>

          {/* Big Editorial DRAGEN Title */}
          <h1 className="text-5xl xl:text-6xl font-extrabold tracking-[-0.03em] text-[#FAF8F5] leading-none mb-4">
            DRAGEN
          </h1>

          {/* Subtitle / Expansion Acronym */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#181715] border border-[#2A2724] text-[11px] font-mono text-[#C4BEB1] tracking-wider uppercase mb-5">
            <span className="text-[#B58A3B]">✦</span>
            <span>Document Retrieval-Augmented Generation</span>
          </div>

          {/* Tagline */}
          <p className="text-sm xl:text-base text-[#8C867A] font-normal leading-relaxed max-w-sm">
            Ground every document and synthesis in verified semantic intelligence.
          </p>
        </div>

        {/* Bottom Footer Note */}
        <div className="relative z-10 flex items-center justify-between pt-6 border-t border-[#262422]/60 text-[11px] font-mono text-[#787265]">
          <span>Verified Neural Indexing</span>
          <span>Zero Hallucination Tolerance</span>
        </div>
      </div>

      {/* RIGHT — Form Panel */}
      <div className="w-full lg:w-[50%] xl:w-[48%] flex items-center justify-center p-8 sm:p-12 lg:p-16">
        <div className="w-full max-w-sm">
          
          {/* Mobile Header */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-8 h-8 rounded-lg bg-[#111110] flex items-center justify-center text-[#FAF8F5] font-bold text-sm shadow-xs">
              D
            </div>
            <span className="text-[#111110] text-base font-semibold tracking-tight">DRAGEN Studio</span>
          </div>

          <div className="mb-8">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F2EFE9] border border-[#E4DFD5] text-[#847E72] text-[11px] font-bold uppercase tracking-wider mb-3">
              <span className="text-[#B58A3B]">✦</span> Access Workspace
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#111110]">
              Sign in to DRAGEN
            </h2>
            <p className="text-sm text-[#787265] mt-1.5">
              New to DRAGEN?{" "}
              <Link to="/register" className="text-[#111110] font-semibold underline underline-offset-4 decoration-[#B58A3B] hover:text-[#B58A3B] transition-colors">
                Create an account
              </Link>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-semibold uppercase tracking-wider text-[#6B665E] mb-1.5"
              >
                Username or Email
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                value={form.username}
                onChange={handleChange}
                placeholder="developer@dragen.ai"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4DFD5] bg-[#FFFFFF] text-sm text-[#111110] placeholder:text-[#A8A194] outline-none focus:border-[#111110] focus:ring-4 focus:ring-[#111110]/5 transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-[#6B665E]">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-[#787265] hover:text-[#111110] transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 pr-11 rounded-xl border border-[#E4DFD5] bg-[#FFFFFF] text-sm text-[#111110] placeholder:text-[#A8A194] outline-none focus:border-[#111110] focus:ring-4 focus:ring-[#111110]/5 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#847E72] hover:text-[#111110] transition-colors p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-xs text-[#A63529] bg-[#FAECEB] border border-[#F2C0BC] rounded-xl px-3.5 py-2.5 font-medium flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0 text-[#A63529]" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#111110] text-[#FAF8F5] text-sm font-semibold hover:bg-[#262422] active:scale-[0.99] transition-all shadow-xs disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-[#FAF8F5]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Authenticating…</span>
                </>
              ) : (
                "Continue to Workspace"
              )}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-[#EAE6DF]" />
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#A8A194]">or</span>
            <div className="h-px flex-1 bg-[#EAE6DF]" />
          </div>

          <button
            type="button"
            onClick={() => alert("Wire this up to your Google OAuth flow when ready.")}
            className="w-full py-2.5 rounded-xl border border-[#E4DFD5] bg-[#FFFFFF] text-xs font-semibold text-[#111110] hover:bg-[#F7F4EF] hover:border-[#D4CEBF] transition-all flex items-center justify-center gap-2.5 shadow-xs"
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.69-2.26 1.1-3.71 1.1-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.14c-.22-.69-.35-1.42-.35-2.14s.13-1.45.35-2.14V7.02H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.98l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.02l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Single Sign-On
          </button>
        </div>
      </div>
    </div>
  );
}