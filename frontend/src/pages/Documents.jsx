import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import api from "../api/api";

async function fetchDocuments(mode) {
  let url = "documents/";

  if (mode === "favorites") {
    url += "?filter=favorites";
  } else if (mode === "trash") {
    url += "?filter=trash";
  }

  const response = await api.get(url);

  return response.data.map((doc) => ({
    id: doc.id,
    title: doc.title,
    updatedAt: doc.updated_at,
    isFavorite: doc.is_favorite,
    isTrashed: doc.is_trashed,
  }));
}

function timeAgo(dateString) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString();
}

export default function Documents() {
  const location = useLocation();
  const navigate = useNavigate();

  const mode = location.pathname.includes("/favorites")
    ? "favorites"
    : location.pathname.includes("/trash")
    ? "trash"
    : "all";

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [view, setView] = useState("grid");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);


useEffect(() => {
  let cancelled = false;

  const loadDocuments = async () => {
    try {
      const documents = await fetchDocuments(mode);

      if (!cancelled) {
        setDocs(documents);
        setError("");
      }
    } catch (err) {
      console.error("Failed to load documents:", err);

      if (!cancelled) {
        setError("Failed to load documents. Please try again.");
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  };

  void loadDocuments();

  return () => {
    cancelled = true;
  };
}, [mode]);


  const filteredDocs = useMemo(() => {
    let result = docs.filter((d) =>
      mode === "trash" ? d.isTrashed : mode === "favorites" ? d.isFavorite && !d.isTrashed : !d.isTrashed
    );

    if (search.trim()) {
      result = result.filter((d) =>
        d.title.toLowerCase().includes(search.trim().toLowerCase())
      );
    }

    result = [...result].sort((a, b) => {
      const diff = new Date(b.updatedAt) - new Date(a.updatedAt);
      return sortOrder === "newest" ? diff : -diff;
    });

    return result;
  }, [docs, mode, search, sortOrder]);



  const deleteForever = async (id) => {
    try {
      await api.delete(`documents/${id}/delete_forever/`);
      setDocs((prev) => prev.filter((doc) => doc.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const toggleFavorite = async (doc) => {
    try {
      const res = await api.patch(`documents/${doc.id}/favorite/`);
      setDocs((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, isFavorite: res.data.is_favorite } : d))
      );
      setOpenMenuId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const moveToTrash = async (doc) => {
    try {
      await api.patch(`documents/${doc.id}/trash/`);
      setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, isTrashed: true } : d)));
      setOpenMenuId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const restoreDoc = async (doc) => {
    try {
      await api.patch(`documents/${doc.id}/restore/`);
      setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, isTrashed: false } : d)));
      setOpenMenuId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const startRename = (doc) => {
    setRenamingId(doc.id);
    setRenameValue(doc.title);
    setOpenMenuId(null);
  };

  const commitRename = async (doc) => {
    const trimmed = renameValue.trim();

    if (!trimmed) {
      setRenamingId(null);
      return;
    }

    try {
      await api.patch(`documents/${doc.id}/`, { title: trimmed });
      setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, title: trimmed } : d)));
      setRenamingId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const pageTitle =
    mode === "favorites" ? "Starred Knowledge" : mode === "trash" ? "Trash Archive" : "All Documents";

  const pageSubtitle =
    mode === "favorites"
      ? "Starred records and pinned reference documents."
      : mode === "trash"
      ? "Deleted items will be permanently removed after 30 days."
      : "Indexed documents and generative workspaces in your environment.";

  return (
    <div className="flex min-h-screen bg-[#FAF8F5] text-[#111110] font-sans antialiased selection:bg-[#111110] selection:text-[#FAF8F5]">
      {/* Sidebar Navigation */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          search={search}
          setSearch={setSearch}
        />

        <main className="flex-1 p-4 sm:p-8 lg:p-10 max-w-7xl w-full mx-auto">
          {/* Header & Primary Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 sm:mb-8 border-b border-[#EAE6DF]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#111110]">
                  {pageTitle}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase bg-[#EAE5DA] text-[#6B665E]">
                  {filteredDocs.length} Docs
                </span>
              </div>
              <p className="text-sm sm:text-base text-[#787265]">{pageSubtitle}</p>
            </div>

            {mode === "all" && (
              <button
                onClick={() => navigate("/editor/new")}
                className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-[#111110] text-[#FAF8F5] text-sm sm:text-base font-semibold hover:bg-[#262422] active:scale-[0.98] transition-all shadow-md shadow-[#111110]/10 w-full sm:w-auto shrink-0 group"
              >
                <span className="text-sm sm:text-base text-[#B58A3B] group-hover:rotate-90 transition-transform">✦</span>
                <span>New Document</span>
              </button>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-44 bg-[#EBE7DF] rounded-2xl" />
              ))}
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-[#FAECEB] border border-[#F2C0BC] text-[#A63529] max-w-lg flex items-center gap-3">
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-medium">{error}</p>
            </div>
          ) : (
            <>
              {/* Controls Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                 
                  {/* Sort Order Select */}
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl border border-[#E4DFD5] bg-[#FFFFFF] text-sm font-medium text-[#111110] outline-none focus:border-[#111110] transition-all cursor-pointer"
                  >
                    <option value="newest">Sort: Newest first</option>
                    <option value="oldest">Sort: Oldest first</option>
                  </select>
                </div>

                {/* View Switcher */}
                <div className="flex p-1 bg-[#F0ECE4] border border-[#E4DFD5] rounded-xl">
                  <button
                    onClick={() => setView("grid")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      view === "grid"
                        ? "bg-[#111110] text-[#FAF8F5] shadow-xs"
                        : "text-[#6B665E] hover:text-[#111110]"
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="14" y="14" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" />
                    </svg>
                    Grid
                  </button>
                  <button
                    onClick={() => setView("list")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      view === "list"
                        ? "bg-[#111110] text-[#FAF8F5] shadow-xs"
                        : "text-[#6B665E] hover:text-[#111110]"
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="8" y1="6" x2="21" y2="6" />
                      <line x1="8" y1="12" x2="21" y2="12" />
                      <line x1="8" y1="18" x2="21" y2="18" />
                      <line x1="3" y1="6" x2="3.01" y2="6" />
                      <line x1="3" y1="12" x2="3.01" y2="12" />
                      <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                    List
                  </button>
                </div>
              </div>

              {/* Empty State */}
              {filteredDocs.length === 0 && (
                <div className="border border-dashed border-[#DCD6C9] bg-[#FFFFFF]/60 rounded-2xl p-14 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#F2EFE9] border border-[#E4DFD5] flex items-center justify-center mx-auto mb-4 text-[#8C867A]">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <p className="text-base font-semibold text-[#111110] mb-1">
                    {search
                      ? "No documents match your search filter."
                      : mode === "trash"
                      ? "Trash archive is empty."
                      : mode === "favorites"
                      ? "No starred documents yet."
                      : "No documents created yet."}
                  </p>
                  <p className="text-sm text-[#787265] max-w-sm mx-auto mb-5">
                    {mode === "all" && !search
                      ? "Generate a document or bring in your notes to start querying with DRAGEN."
                      : "Try tweaking your query or switching modes."}
                  </p>
                  {mode === "all" && !search && (
                    <button
                      onClick={() => navigate("/editor/new")}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#DCD6C9] bg-[#FAF8F5] text-sm font-semibold text-[#111110] hover:bg-[#F2EFE9] transition-all"
                    >
                      <span className="text-[#B58A3B]">✦</span>
                      <span>Create your first document</span>
                    </button>
                  )}
                </div>
              )}

              {/* Grid View */}
              {filteredDocs.length > 0 && view === "grid" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {filteredDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="group relative bg-[#FFFFFF] border border-[#E8E3D8] hover:border-[#111110] rounded-2xl p-4 sm:p-5 transition-all duration-150 shadow-xs hover:shadow-md flex flex-col justify-between min-h-[140px] sm:h-44"
                    >
                      <div className="flex items-start justify-between w-full">
                        <div className="w-9 h-9 rounded-xl bg-[#FAF8F5] border border-[#EAE6DF] flex items-center justify-center text-[#6B665E] group-hover:text-[#111110] group-hover:border-[#111110]/30 transition-colors">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {doc.isFavorite && (
                            <span className="text-[#B58A3B]">
                              <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                                <polygon points="10 2 12.5 7.5 18 8.3 14 12.2 15 17.5 10 14.8 5 17.5 6 12.2 2 8.3 7.5 7.5 10 2" />
                              </svg>
                            </span>
                          )}
                          <button
                            onClick={() => setOpenMenuId(openMenuId === doc.id ? null : doc.id)}
                            className="w-8 h-8 rounded-lg hover:bg-[#F2EFE9] flex items-center justify-center text-[#8C867A] hover:text-[#111110] transition-colors"
                            aria-label="Document actions"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="12" cy="12" r="2" />
                              <circle cx="19" cy="12" r="2" />
                              <circle cx="5" cy="12" r="2" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div>
                        {renamingId === doc.id ? (
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => commitRename(doc)}
                            onKeyDown={(e) => e.key === "Enter" && commitRename(doc)}
                            className="w-full text-base font-semibold text-[#111110] border border-[#111110] rounded-lg px-2 py-1 mb-1 outline-none bg-white"
                          />
                        ) : (
                          <button
                            onClick={() => navigate(`/editor/${doc.id}`)}
                            className="text-left w-full text-base font-semibold text-[#111110] mb-1.5 truncate group-hover:text-[#B58A3B] transition-colors"
                          >
                            {doc.title || "Untitled Document"}
                          </button>
                        )}
                        <p className="text-xs font-mono text-[#8C867A]">{timeAgo(doc.updatedAt)}</p>
                      </div>

                      {/* Dropdown Menu */}
                      {openMenuId === doc.id && (
                        <div className="absolute right-4 top-14 z-20 bg-[#FAF8F5] border border-[#E4DFD5] rounded-xl shadow-xl shadow-[#111110]/10 p-1.5 w-44 text-sm animate-in fade-in zoom-in-95 duration-100">
                          {mode === "trash" ? (
                            <>
                              <button
                                onClick={() => restoreDoc(doc)}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#F0EBE3] text-[#111110] font-medium transition-colors"
                              >
                                ↺ Restore
                              </button>
                              <button
                                onClick={() => deleteForever(doc.id)}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#FAECEB] text-[#A63529] font-medium transition-colors"
                              >
                                ✕ Delete forever
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => navigate(`/editor/${doc.id}`)}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#F0EBE3] text-[#111110] font-medium transition-colors"
                              >
                                ↗ Open
                              </button>
                              <button
                                onClick={() => startRename(doc)}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#F0EBE3] text-[#111110] font-medium transition-colors"
                              >
                                ✎ Rename
                              </button>
                              <button
                                onClick={() => toggleFavorite(doc)}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#F0EBE3] text-[#111110] font-medium transition-colors"
                              >
                                {doc.isFavorite ? "★ Unstar" : "☆ Star"}
                              </button>
                              <div className="my-1 border-t border-[#EAE6DF]" />
                              <button
                                onClick={() => moveToTrash(doc)}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#FAECEB] text-[#A63529] font-medium transition-colors"
                              >
                                ⌫ Move to trash
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* List View */}
              {filteredDocs.length > 0 && view === "list" && (
                <div className="border border-[#E8E3D8] rounded-2xl bg-[#FFFFFF] overflow-hidden shadow-xs">
                  {filteredDocs.map((doc, i) => (
                    <div
                      key={doc.id}
                      className={`relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3.5 sm:px-5 sm:py-3.5 hover:bg-[#FAF8F5] transition-colors ${
                        i !== 0 ? "border-t border-[#EAE6DF]" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto flex-1">
                        <div className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#EAE6DF] flex items-center justify-center text-[#6B665E] shrink-0">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                        </div>

                        {renamingId === doc.id ? (
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => commitRename(doc)}
                            onKeyDown={(e) => e.key === "Enter" && commitRename(doc)}
                            className="text-base font-medium text-[#111110] border border-[#111110] rounded px-2 py-0.5 outline-none bg-white max-w-sm w-full"
                          />
                        ) : (
                          <button
                            onClick={() => navigate(`/editor/${doc.id}`)}
                            className="text-base font-semibold text-[#111110] truncate hover:text-[#B58A3B] transition-colors text-left"
                          >
                            {doc.title || "Untitled Document"}
                          </button>
                        )}
                        {doc.isFavorite && (
                          <span className="text-[#B58A3B] shrink-0">
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                              <polygon points="10 2 12.5 7.5 18 8.3 14 12.2 15 17.5 10 14.8 5 17.5 6 12.2 2 8.3 7.5 7.5 10 2" />
                            </svg>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-[#EAE6DF]/60">
                        <span className="text-xs font-mono text-[#8C867A]">{timeAgo(doc.updatedAt)}</span>
                        <button
                          onClick={() => setOpenMenuId(openMenuId === doc.id ? null : doc.id)}
                          className="w-8 h-8 rounded-lg hover:bg-[#F2EFE9] flex items-center justify-center text-[#8C867A] hover:text-[#111110] transition-colors"
                          aria-label="Document actions"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="19" cy="12" r="2" />
                            <circle cx="5" cy="12" r="2" />
                          </svg>
                        </button>
                      </div>

                      {/* Dropdown Menu */}
                      {openMenuId === doc.id && (
                        <div className="absolute right-5 top-12 z-20 bg-[#FAF8F5] border border-[#E4DFD5] rounded-xl shadow-xl shadow-[#111110]/10 p-1.5 w-44 text-sm animate-in fade-in zoom-in-95 duration-100">
                          {mode === "trash" ? (
                            <>
                              <button
                                onClick={() => restoreDoc(doc)}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#F0EBE3] text-[#111110] font-medium transition-colors"
                              >
                                ↺ Restore
                              </button>
                              <button
                                onClick={() => deleteForever(doc.id)}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#FAECEB] text-[#A63529] font-medium transition-colors"
                              >
                                ✕ Delete forever
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => navigate(`/editor/${doc.id}`)}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#F0EBE3] text-[#111110] font-medium transition-colors"
                              >
                                ↗ Open
                              </button>
                              <button
                                onClick={() => startRename(doc)}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#F0EBE3] text-[#111110] font-medium transition-colors"
                              >
                                ✎ Rename
                              </button>
                              <button
                                onClick={() => toggleFavorite(doc)}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#F0EBE3] text-[#111110] font-medium transition-colors"
                              >
                                {doc.isFavorite ? "★ Unstar" : "☆ Star"}
                              </button>
                              <div className="my-1 border-t border-[#EAE6DF]" />
                              <button
                                onClick={() => moveToTrash(doc)}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#FAECEB] text-[#A63529] font-medium transition-colors"
                              >
                                ⌫ Move to trash
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}