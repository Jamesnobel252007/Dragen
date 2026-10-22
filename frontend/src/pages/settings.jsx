import { useEffect, useState } from "react";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import api from "../api/api";

const STORAGE_KEY = "dragen_profile";
const EDITOR_SETTINGS_KEY = "dragen_editor_config";
const AI_CONFIG_KEY = "dragen_ai_config";
const NOTIF_KEY = "dragen_notifications";

const TABS = [
  {
    id: "account",
    label: "Account",
    caption: "Personal identity & credentials",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    id: "editor",
    label: "Editor Canvas",
    caption: "Typography, layout & drafting",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
  {
    id: "ai",
    label: "RAG & Neural AI",
    caption: "Model context & citations",
    icon: (
      <svg className="w-4 h-4 text-[#B58A3B]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    ),
  },
  {
    id: "notifications",
    label: "Notifications",
    caption: "Activity & system alerts",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    ),
  },
  {
    id: "security",
    label: "API & Keys",
    caption: "Developer ingestion tokens",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
];

const DEFAULT_PROFILE = { name: "", email: "", bio: "" };

const DEFAULT_EDITOR_CONFIG = {
  defaultFont: "Inter",
  canvasWidth: "720px",
  lineHeight: "1.7",
  autoSave: true,
  spellcheck: true,
};

const DEFAULT_AI_CONFIG = {
  model: "dragen-2.5-synthesis",
  citationGrounding: true,
  realtimeStreaming: true,
  searchDepth: "balanced",
};

const DEFAULT_NOTIFS = {
  documentShared: true,
  comments: true,
  ragIndexReady: true,
};

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export default function SettingsAlt() {
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [editorConfig, setEditorConfig] = useState(DEFAULT_EDITOR_CONFIG);
  const [aiConfig, setAiConfig] = useState(DEFAULT_AI_CONFIG);
  const [notifs, setNotifs] = useState(DEFAULT_NOTIFS);
  const [activeTab, setActiveTab] = useState("account");

  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const apiKey = "dragen_live_sk_82a7f9031c629e4";

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await api.get("me/");
        setProfile({
          name: res.data.username || "",
          email: res.data.email || "",
          bio: res.data.bio || "",
        });
        setEditorConfig(loadJSON(EDITOR_SETTINGS_KEY, DEFAULT_EDITOR_CONFIG));
        setAiConfig(loadJSON(AI_CONFIG_KEY, DEFAULT_AI_CONFIG));
        setNotifs(loadJSON(NOTIF_KEY, DEFAULT_NOTIFS));
      } catch (err) {
        console.error(err);
        setError("Unable to synchronize cloud settings.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2200);
    return () => clearTimeout(t);
  }, [saved]);

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      await api.patch("me/", {
        username: profile.name,
        email: profile.email,
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      setSaved(true);
    } catch (err) {
      console.error(err);
    }
  };

  const updateEditorConfig = (key, value) => {
    const next = { ...editorConfig, [key]: value };
    setEditorConfig(next);
    localStorage.setItem(EDITOR_SETTINGS_KEY, JSON.stringify(next));
    setSaved(true);
  };

  const updateAiConfig = (key, value) => {
    const next = { ...aiConfig, [key]: value };
    setAiConfig(next);
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(next));
    setSaved(true);
  };

  const toggleNotif = (key) => {
    const next = { ...notifs, [key]: !notifs[key] };
    setNotifs(next);
    localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
    setSaved(true);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#111110] flex font-sans antialiased selection:bg-[#111110] selection:text-[#FAF8F5]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 p-6 sm:p-8 lg:p-10 max-w-6xl w-full mx-auto">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-8 border-b border-[#EAE6DF]">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-semibold tracking-tight text-[#111110]">
                  Workspace Settings
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase bg-[#EAE5DA] text-[#6B665E]">
                  Preferences
                </span>
              </div>
              <p className="text-sm text-[#787265]">
                Manage account credentials, custom editor canvas parameters, and AI retrieval parameters.
              </p>
            </div>

            {saved && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#10B981]/10 border border-[#10B981]/25 text-xs font-semibold text-[#10B981] animate-in fade-in duration-150 shrink-0">
                <span>✓</span>
                <span>Settings saved</span>
              </div>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 animate-pulse">
              <div className="md:col-span-4 h-64 bg-[#EBE7DF] rounded-2xl" />
              <div className="md:col-span-8 h-96 bg-[#EBE7DF] rounded-2xl" />
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-[#FAECEB] border border-[#F2C0BC] text-[#A63529] max-w-md flex items-center gap-3">
              <p className="text-sm font-medium">{error}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              
              {/* LEFT: Navigation Tabs */}
              <nav className="md:col-span-4 bg-[#FFFFFF] border border-[#E8E3D8] rounded-2xl p-2 shadow-xs space-y-1">
                {TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-start gap-3 px-3.5 py-3 rounded-xl transition-all text-left ${
                        isActive
                          ? "bg-[#111110] text-[#FAF8F5] shadow-xs"
                          : "text-[#6B665E] hover:text-[#111110] hover:bg-[#F2EFE9]"
                      }`}
                    >
                      <span className={`mt-0.5 transition-colors ${isActive ? "text-[#FAF8F5]" : "text-[#8C867A]"}`}>
                        {tab.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold leading-tight">{tab.label}</p>
                          {isActive && <span className="text-[9px] text-[#B58A3B]">✦</span>}
                        </div>
                        <p className={`text-[11px] truncate mt-0.5 ${isActive ? "text-[#8C867A]" : "text-[#9E9789]"}`}>
                          {tab.caption}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </nav>

              {/* RIGHT: Active Tab Content */}
              <div className="md:col-span-8 bg-[#FFFFFF] border border-[#E8E3D8] rounded-2xl p-6 sm:p-8 shadow-xs">
                
                {/* 1. Account Tab */}
                {activeTab === "account" && (
                  <div className="space-y-6">
                    <div className="pb-4 border-b border-[#EAE6DF]">
                      <h2 className="text-lg font-semibold text-[#111110]">Account Identity</h2>
                      <p className="text-xs text-[#787265] mt-0.5">
                        Manage your display profile and team authorization details.
                      </p>
                    </div>

                    <form onSubmit={saveProfile} className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B665E]">
                            Username / Handle
                          </label>
                          <input
                            type="text"
                            value={profile.name}
                            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4DFD5] bg-[#FFFFFF] text-sm text-[#111110] outline-none focus:border-[#111110] transition"
                            placeholder="username"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B665E]">
                            Email Address
                          </label>
                          <input
                            type="email"
                            value={profile.email}
                            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4DFD5] bg-[#FFFFFF] text-sm text-[#111110] outline-none focus:border-[#111110] transition"
                            placeholder="you@domain.com"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B665E]">
                          Workspace Bio
                        </label>
                        <textarea
                          value={profile.bio}
                          onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                          rows={3}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4DFD5] bg-[#FFFFFF] text-sm text-[#111110] outline-none focus:border-[#111110] transition resize-none"
                          placeholder="Your research focus or team role..."
                        />
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          className="px-4 py-2.5 rounded-xl bg-[#111110] text-[#FAF8F5] text-xs font-semibold hover:bg-[#262422] active:scale-[0.98] transition shadow-xs"
                        >
                          Save Profile Changes
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* 2. Editor Canvas Tab */}
                {activeTab === "editor" && (
                  <div className="space-y-6">
                    <div className="pb-4 border-b border-[#EAE6DF]">
                      <h2 className="text-lg font-semibold text-[#111110]">Document Canvas</h2>
                      <p className="text-xs text-[#787265] mt-0.5">
                        Customize typography, container margins, and live writing assist.
                      </p>
                    </div>

                    <div className="space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B665E]">
                            Default Font Family
                          </label>
                          <select
                            value={editorConfig.defaultFont}
                            onChange={(e) => updateEditorConfig("defaultFont", e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4DFD5] bg-[#FFFFFF] text-sm font-medium text-[#111110] outline-none focus:border-[#111110] cursor-pointer"
                          >
                            <option value="Inter">Inter (Clean Sans)</option>
                            <option value="Newsreader">Newsreader (Editorial Serif)</option>
                            <option value="JetBrains Mono">JetBrains (Technical Mono)</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B665E]">
                            Canvas Max-Width
                          </label>
                          <select
                            value={editorConfig.canvasWidth}
                            onChange={(e) => updateEditorConfig("canvasWidth", e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4DFD5] bg-[#FFFFFF] text-sm font-medium text-[#111110] outline-none focus:border-[#111110] cursor-pointer"
                          >
                            <option value="680px">Focused (680px)</option>
                            <option value="720px">Standard (720px)</option>
                            <option value="960px">Expanded Wide (960px)</option>
                          </select>
                        </div>
                      </div>

                      <div className="divide-y divide-[#EAE6DF] pt-2">
                        <div className="flex items-center justify-between py-4">
                          <div>
                            <p className="text-sm font-semibold text-[#111110]">Background Auto-Save</p>
                            <p className="text-xs text-[#787265] mt-0.5">Persist document revisions every 5 seconds.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => updateEditorConfig("autoSave", !editorConfig.autoSave)}
                            className={`relative w-11 h-6 rounded-full transition-colors ${
                              editorConfig.autoSave ? "bg-[#111110]" : "bg-[#E4DFD5]"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                                editorConfig.autoSave ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>

                        <div className="flex items-center justify-between py-4">
                          <div>
                            <p className="text-sm font-semibold text-[#111110]">Inline Spellcheck & Grammar</p>
                            <p className="text-xs text-[#787265] mt-0.5">Highlight lexical errors during drafting.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => updateEditorConfig("spellcheck", !editorConfig.spellcheck)}
                            className={`relative w-11 h-6 rounded-full transition-colors ${
                              editorConfig.spellcheck ? "bg-[#111110]" : "bg-[#E4DFD5]"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                                editorConfig.spellcheck ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. AI & RAG Engine Tab */}
                {activeTab === "ai" && (
                  <div className="space-y-6">
                    <div className="pb-4 border-b border-[#EAE6DF]">
                      <h2 className="text-lg font-semibold text-[#111110]">Neural Retrieval Parameters</h2>
                      <p className="text-xs text-[#787265] mt-0.5">
                        Configure model temperature and citation verification thresholds.
                      </p>
                    </div>

                    <div className="space-y-5">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B665E]">
                          Default LLM Architecture
                        </label>
                        <select
                          value={aiConfig.model}
                          onChange={(e) => updateAiConfig("model", e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4DFD5] bg-[#FFFFFF] text-sm font-medium text-[#111110] outline-none focus:border-[#111110] cursor-pointer"
                        >
                          <option value="dragen-2.5-synthesis">DRAGEN 2.5 Synthesis (Fast / Standard)</option>
                          <option value="dragen-2.5-deep-research">DRAGEN Deep Research (Multi-vector RAG)</option>
                          <option value="dragen-code-kernel">DRAGEN Technical Kernel (Equations / Code)</option>
                        </select>
                      </div>

                      <div className="divide-y divide-[#EAE6DF] pt-2">
                        <div className="flex items-center justify-between py-4">
                          <div>
                            <p className="text-sm font-semibold text-[#111110]">Real-time Streaming</p>
                            <p className="text-xs text-[#787265] mt-0.5">Stream tokens incrementally into the active editor buffer.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => updateAiConfig("realtimeStreaming", !aiConfig.realtimeStreaming)}
                            className={`relative w-11 h-6 rounded-full transition-colors ${
                              aiConfig.realtimeStreaming ? "bg-[#111110]" : "bg-[#E4DFD5]"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                                aiConfig.realtimeStreaming ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>

                        <div className="flex items-center justify-between py-4">
                          <div>
                            <p className="text-sm font-semibold text-[#111110]">Mandatory Source Grounding</p>
                            <p className="text-xs text-[#787265] mt-0.5">Reject generations that fail the semantic similarity match check.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => updateAiConfig("citationGrounding", !aiConfig.citationGrounding)}
                            className={`relative w-11 h-6 rounded-full transition-colors ${
                              aiConfig.citationGrounding ? "bg-[#111110]" : "bg-[#E4DFD5]"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                                aiConfig.citationGrounding ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Notifications Tab */}
                {activeTab === "notifications" && (
                  <div className="space-y-6">
                    <div className="pb-4 border-b border-[#EAE6DF]">
                      <h2 className="text-lg font-semibold text-[#111110]">Notification Channels</h2>
                      <p className="text-xs text-[#787265] mt-0.5">
                        Choose triggers for collaboration and vectorization updates.
                      </p>
                    </div>

                    <div className="divide-y divide-[#EAE6DF]">
                      {[
                        { key: "documentShared", title: "Document access shared", desc: "When teammates invite you to view or edit a document." },
                        { key: "comments", title: "Comments and annotations", desc: "When a colleague leaves notes on your drafts." },
                        { key: "ragIndexReady", title: "Vector index build complete", desc: "When your documents have finished indexing." },
                      ].map((item) => (
                        <div key={item.key} className="flex items-center justify-between py-4">
                          <div className="pr-4">
                            <p className="text-sm font-semibold text-[#111110]">{item.title}</p>
                            <p className="text-xs text-[#787265] mt-0.5">{item.desc}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleNotif(item.key)}
                            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                              notifs[item.key] ? "bg-[#111110]" : "bg-[#E4DFD5]"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                                notifs[item.key] ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. Security & API Tab */}
                {activeTab === "security" && (
                  <div className="space-y-6">
                    <div className="pb-4 border-b border-[#EAE6DF]">
                      <h2 className="text-lg font-semibold text-[#111110]">Developer API Token</h2>
                      <p className="text-xs text-[#787265] mt-0.5">
                        Authenticate programmatic document ingestion and semantic queries.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B665E]">
                          Active Secret Key
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="password"
                            readOnly
                            value={apiKey}
                            className="flex-1 px-3.5 py-2.5 rounded-xl border border-[#E4DFD5] bg-[#F4F1EA] font-mono text-xs text-[#111110] outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(apiKey);
                              setSaved(true);
                            }}
                            className="px-4 py-2.5 rounded-xl border border-[#E4DFD5] bg-[#FFFFFF] hover:bg-[#F2EFE9] text-xs font-semibold text-[#111110] transition-colors"
                          >
                            Copy Key
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}