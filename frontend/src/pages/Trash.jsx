import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import api from "../api/api";

function timeAgo(dateString) {
  if (!dateString) return "Recently";
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString();
}

function Trash() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fetchTrash = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("documents/?filter=trash");
      setDocs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };


useEffect(() => {
  let cancelled = false;

  const loadTrash = async () => {
    try {
      const { data } = await api.get("documents/?filter=trash");

      if (!cancelled) {
        setDocs(data || []);
      }
    } catch (err) {
      if (!cancelled) {
        console.error("Failed to load trash:", err);
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  };

  void loadTrash();

  return () => {
    cancelled = true;
  };
}, []);


  const restore = async (id) => {
    try {
      await api.patch(`documents/${id}/`, {
        is_trashed: false,
      });
      fetchTrash();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteForever = async (id) => {
    try {
      await api.delete(`documents/${id}/`);
      fetchTrash();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredDocs = docs.filter((d) =>
    d.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#111110] flex font-sans antialiased selection:bg-[#111110] selection:text-[#FAF8F5]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          search={search}
          setSearch={setSearch}
        />

        <main className="flex-1 p-6 sm:p-8 lg:p-10 max-w-7xl w-full mx-auto">
          {/* Header & Warning Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-8 border-b border-[#EAE6DF]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-3xl font-semibold tracking-tight text-[#111110]">
                  Trash Archive
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase bg-[#FAECEB] text-[#A63529] border border-[#F2C0BC]">
                  {filteredDocs.length} Archived
                </span>
              </div>
              <p className="text-base text-[#787265]">
                Trashed documents will be permanently purged after 30 days.
              </p>
            </div>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-[#EBE7DF] rounded-2xl" />
              ))}
            </div>
          ) : filteredDocs.length === 0 ? (
            /* Empty State */
            <div className="border border-dashed border-[#DCD6C9] bg-[#FFFFFF]/60 rounded-2xl p-14 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F2EFE9] border border-[#E4DFD5] flex items-center justify-center mx-auto mb-4 text-[#8C867A]">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </div>
              <p className="text-base font-semibold text-[#111110] mb-1">
                {search ? "No trashed items match your search" : "Trash archive is clean"}
              </p>
              <p className="text-sm text-[#787265] max-w-sm mx-auto">
                Items you remove from your workspace will appear here before being permanently deleted.
              </p>
            </div>
          ) : (
            /* Document Rows */
            <div className="border border-[#E8E3D8] rounded-2xl bg-[#FFFFFF] overflow-hidden shadow-xs divide-y divide-[#EAE6DF]">
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 hover:bg-[#FAF8F5] transition-colors"
                >
                  {/* Left: Document Info */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#FAF8F5] border border-[#EAE6DF] flex items-center justify-center text-[#8C867A] shrink-0">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-[#111110] truncate">
                        {doc.title || "Untitled Document"}
                      </h3>
                      <p className="text-xs font-mono text-[#8C867A] mt-0.5">
                        Deleted {timeAgo(doc.updated_at || doc.updatedAt)}
                      </p>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      onClick={() => restore(doc.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E4DFD5] bg-[#FFFFFF] hover:bg-[#F2EFE9] text-xs font-semibold text-[#111110] transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 text-[#6B665E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="1 4 1 10 7 10" />
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                      </svg>
                      <span>Restore</span>
                    </button>

                    <button
                      onClick={() => deleteForever(doc.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#F2C0BC] bg-[#FAECEB] hover:bg-[#F7D8D6] text-xs font-semibold text-[#A63529] transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 text-[#A63529]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      <span>Delete forever</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default Trash;