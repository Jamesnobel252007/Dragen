import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
const rawBase = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";
const API_BASE = rawBase.replace(/\/+$/, "");

const COLLABORATORS = [
  { name: "Aditi", color: "#3D5AFE", top: "22%", left: "58%" },
  { name: "Ravi", color: "#F5A524", top: "48%", left: "20%" },
  { name: "Meera", color: "#2ECC71", top: "68%", left: "62%" },
];

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
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

    if (!form.username || !form.email || !form.password || !form.confirmPassword) {
      setError("Fill in every field to create your account.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password needs to be at least 8 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/register/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: form.username,
          email: form.email,
          password: form.password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.error ||
          data.detail ||
          "Couldn't create your account."
        );
      }

      console.log("Registration:", data);

      alert("Registration successful!");
      navigate("/");
    } catch (err) {
      setError(err.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-[#FAFAF7] font-[Inter,system-ui,sans-serif]">
      {/* LEFT — editor panel, same as Login */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#12141C] overflow-hidden flex-col justify-between p-12">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative z-10 flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[#3D5AFE] flex items-center justify-center">
            <span className="text-white text-sm font-semibold">V</span>
          </div>
          <span className="text-white text-lg font-serif tracking-tight">VDocs</span>
        </div>

        <div className="relative z-10 flex-1 flex items-center">
          <div className="relative w-full max-w-md bg-[#1B1E29] border border-white/10 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center gap-1.5 mb-5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E64848]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#F5A524]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#2ECC71]" />
              <span className="ml-3 text-[11px] font-mono text-white/30 tracking-wide">
                Getting started.doc
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="h-2.5 bg-white/20 rounded w-3/4" />
              <div className="h-2.5 bg-white/10 rounded w-full" />
              <div className="h-2.5 bg-white/10 rounded w-5/6" />
              <div className="h-2.5 bg-white/10 rounded w-2/3" />
              <div className="h-2.5 bg-white/10 rounded w-full" />
              <div className="h-2.5 bg-white/10 rounded w-1/2" />
            </div>

            {COLLABORATORS.map((c) => (
              <div
                key={c.name}
                className="absolute flex items-center gap-1.5 animate-pulse"
                style={{ top: c.top, left: c.left }}
              >
                <span
                  className="w-0.5 h-4 rounded-sm"
                  style={{ backgroundColor: c.color }}
                />
                <span
                  className="text-[10px] font-medium text-white px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: c.color }}
                >
                  {c.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-white/40 text-sm leading-relaxed max-w-sm">
          Every document, one workspace. Write, organize, and — soon —
          edit together in real time.
        </p>
      </div>

      {/* RIGHT — form panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 py-8 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-7 h-7 rounded-md bg-[#3D5AFE] flex items-center justify-center">
              <span className="text-white text-sm font-semibold">V</span>
            </div>
            <span className="text-[#12141C] text-lg font-serif tracking-tight">
              VDocs
            </span>
          </div>

          <p className="text-[11px] font-mono uppercase tracking-widest text-[#3D5AFE] mb-3">
            Get started
          </p>
          <h1 className="text-3xl font-serif text-[#12141C] mb-2">
            Create your account
          </h1>
          <p className="text-sm text-[#6B7280] mb-8">
            Already have an account?{" "}
            <Link to="/" className="text-[#3D5AFE] font-medium hover:underline">
              Log in
            </Link>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-medium text-[#12141C] mb-1.5"
              >
                Username
              </label>

              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                value={form.username}
                onChange={handleChange}
                placeholder="james_nobel"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6E4DD] bg-white text-sm text-[#12141C] placeholder:text-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#3D5AFE]/30 focus:border-[#3D5AFE] transition"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-[#12141C] mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6E4DD] bg-white text-sm text-[#12141C] placeholder:text-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#3D5AFE]/30 focus:border-[#3D5AFE] transition"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-[#12141C] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="At least 8 characters"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-[#E6E4DD] bg-white text-sm text-[#12141C] placeholder:text-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#3D5AFE]/30 focus:border-[#3D5AFE] transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#6B7280] hover:text-[#12141C]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-medium text-[#12141C] mb-1.5"
              >
                Confirm password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter your password"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6E4DD] bg-white text-sm text-[#12141C] placeholder:text-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#3D5AFE]/30 focus:border-[#3D5AFE] transition"
              />
            </div>

            {error && (
              <div className="text-sm text-[#B42318] bg-[#FEF3F2] border border-[#FDA29B] rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-[#12141C] text-white text-sm font-medium hover:bg-[#1B1E29] active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-[#E6E4DD]" />
            <span className="text-xs text-[#9CA3AF]">or</span>
            <div className="h-px flex-1 bg-[#E6E4DD]" />
          </div>

          <button
            type="button"
            onClick={() => alert("Wire this up to your Google OAuth flow when ready.")}
            className="w-full py-2.5 rounded-lg border border-[#E6E4DD] bg-white text-sm font-medium text-[#12141C] hover:bg-[#F5F4F0] transition flex items-center justify-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.69-2.26 1.1-3.71 1.1-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.14c-.22-.69-.35-1.42-.35-2.14s.13-1.45.35-2.14V7.02H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.98l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.02l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}
