import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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

function Favorites() {
  const [docs, setDocs] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

 
  const fetchFavorites = async ({ showLoading = true } = {}) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      const { data } = await api.get("documents/?filter=favorites");
      setDocs(data || []);
    } catch (err) {
      console.error("Failed to fetch favorites:", err);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadFavorites = async () => {
      try {
        const { data } = await api.get("documents/?filter=favorites");

        if (!cancelled) {
          setDocs(data || []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch favorites:", err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadFavorites();

    return () => {
      cancelled = true;
    };
  }, []);


const toggleFavorite = async (id, value) => {
  try {
    await api.patch(`documents/${id}/`, {
      is_favorite: value,
    });

    await fetchFavorites({ showLoading: false });
  } catch (err) {
    console.error("Failed to update favorite:", err);
  }
};

  const filtered = docs.filter((d) =>
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

        <main className="flex-1 p-4 sm:p-8 lg:p-10 max-w-7xl w-full mx-auto">
          {/* Header & Metadata */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 sm:mb-8 border-b border-[#EAE6DF]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#111110]">
                  Starred Knowledge
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase bg-[#EAE5DA] text-[#6B665E]">
                  {filtered.length} Pinned
                </span>
              </div>
              <p className="text-sm sm:text-base text-[#787265]">
                Quick-access records and prioritized reference documents.
              </p>
            </div>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 animate-pulse">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-44 bg-[#EBE7DF] rounded-2xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            /* Empty State */
            <div className="border border-dashed border-[#DCD6C9] bg-[#FFFFFF]/60 rounded-2xl p-8 sm:p-14 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F2EFE9] border border-[#E4DFD5] flex items-center justify-center mx-auto mb-4 text-[#B58A3B]">
                <svg className="w-6 h-6 fill-current" viewBox="0 0 20 20">
                  <polygon points="10 2 12.5 7.5 18 8.3 14 12.2 15 17.5 10 14.8 5 17.5 6 12.2 2 8.3 7.5 7.5 10 2" />
                </svg>
              </div>
              <p className="text-base font-semibold text-[#111110] mb-1">
                {search ? "No starred documents match your search" : "No starred documents yet"}
              </p>
              <p className="text-sm text-[#787265] max-w-sm mx-auto mb-5">
                Star documents from your workspace to pin them here for rapid access and synthesis.
              </p>
              <button
                onClick={() => navigate("/documents")}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#DCD6C9] bg-[#FAF8F5] text-sm font-semibold text-[#111110] hover:bg-[#F2EFE9] transition-all"
              >
                <span>Browse all documents</span>
              </button>
            </div>
          ) : (
            /* Document Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
              {filtered.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => navigate(`/editor/${doc.id}`)}
                  className="group relative bg-[#FFFFFF] border border-[#E8E3D8] hover:border-[#111110] rounded-2xl p-4 sm:p-5 transition-all duration-150 shadow-xs hover:shadow-md flex flex-col justify-between min-h-[140px] sm:h-44 cursor-pointer"
                >
                  {/* Top Preview & Star Toggle */}
                  <div className="flex items-start justify-between w-full">
                    <div className="w-9 h-9 rounded-xl bg-[#FAF8F5] border border-[#EAE6DF] flex items-center justify-center text-[#6B665E] group-hover:text-[#111110] group-hover:border-[#111110]/30 transition-colors">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(doc.id, false);
                      }}
                      className="w-8 h-8 rounded-lg hover:bg-[#FAECEB] flex items-center justify-center text-[#B58A3B] hover:text-[#A63529] transition-colors"
                      title="Remove from favorites"
                      aria-label="Remove from favorites"
                    >
                      <svg className="w-4 h-4 fill-current group-hover/star:hidden" viewBox="0 0 20 20">
                        <polygon points="10 2 12.5 7.5 18 8.3 14 12.2 15 17.5 10 14.8 5 17.5 6 12.2 2 8.3 7.5 7.5 10 2" />
                      </svg>
                    </button>
                  </div>

                  {/* Title & Timestamp */}
                  <div>
                    <h3 className="text-base font-semibold text-[#111110] truncate group-hover:text-[#B58A3B] transition-colors mb-1.5">
                      {doc.title || "Untitled Document"}
                    </h3>
                    <div className="flex items-center gap-2 text-xs font-mono text-[#8C867A]">
                      <span>Updated {timeAgo(doc.updated_at || doc.updatedAt)}</span>
                    </div>
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

export default Favorites;