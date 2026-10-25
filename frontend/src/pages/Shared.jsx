import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";

import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

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

function Shared() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [documents, setDocuments] = useState([]);
  const [tab, setTab] = useState("sharedToMe");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        setLoading(true);
        const endpoint =
          tab === "sharedToMe"
            ? "shared-documents/"
            : "shared-by-me/";

        const { data } = await api.get(endpoint);
        setDocuments(data || []);
      } catch (err) {
        console.error("Failed to fetch shared docs", err);
      } finally {
        setLoading(false);
      }
    };

    loadDocuments();
  }, [tab]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) =>
      doc.title?.toLowerCase().includes(search.toLowerCase())
    );
  }, [documents, search]);

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
          {/* Header & Meta */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 sm:mb-8 border-b border-[#EAE6DF]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#111110]">
                  Shared Knowledge
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase bg-[#EAE5DA] text-[#6B665E]">
                  Collaborative
                </span>
              </div>
              <p className="text-sm sm:text-base text-[#787265]">
                Documents shared with team collaborators and neural RAG access.
              </p>
            </div>

            {/* Segmented Control Tabs */}
            <div className="flex w-full sm:w-auto p-1 bg-[#F0ECE4] border border-[#E4DFD5] rounded-xl">
              <button
                onClick={() => setTab("sharedToMe")}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                  tab === "sharedToMe"
                    ? "bg-[#111110] text-[#FAF8F5] shadow-xs"
                    : "text-[#6B665E] hover:text-[#111110]"
                }`}
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <span>Shared with me</span>
              </button>

              <button
                onClick={() => setTab("sharedByMe")}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                  tab === "sharedByMe"
                    ? "bg-[#111110] text-[#FAF8F5] shadow-xs"
                    : "text-[#6B665E] hover:text-[#111110]"
                }`}
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span>Shared by me</span>
              </button>
            </div>
          </div>

          {/* Body Content */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 animate-pulse">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-44 bg-[#EBE7DF] rounded-2xl" />
              ))}
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="border border-dashed border-[#DCD6C9] bg-[#FFFFFF]/60 rounded-2xl p-8 sm:p-14 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F2EFE9] border border-[#E4DFD5] flex items-center justify-center mx-auto mb-4 text-[#8C867A]">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <p className="text-base font-semibold text-[#111110] mb-1">
                {search ? "No matching shared documents" : "No documents in this view"}
              </p>
              <p className="text-sm text-[#787265] max-w-sm mx-auto">
                {tab === "sharedToMe"
                  ? "When collaborators share drafts or indexes with you, they will appear here."
                  : "You haven't shared any documents with teammates yet."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
              {filteredDocuments.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => navigate(`/editor/${doc.id}`)}
                  className="group relative bg-[#FFFFFF] border border-[#E8E3D8] hover:border-[#111110] rounded-2xl p-4 sm:p-5 transition-all duration-150 shadow-xs hover:shadow-md flex flex-col justify-between min-h-[140px] sm:h-44 cursor-pointer"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between w-full">
                    <div className="w-9 h-9 rounded-xl bg-[#FAF8F5] border border-[#EAE6DF] flex items-center justify-center text-[#6B665E] group-hover:text-[#111110] group-hover:border-[#111110]/30 transition-colors">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>

                    <span className="text-[10px] font-bold text-[#6B665E] bg-[#F2EFE9] border border-[#E4DFD5] px-2 py-0.5 rounded-md tracking-wider uppercase">
                      {tab === "sharedToMe" ? "Collaborator" : "Owner"}
                    </span>
                  </div>

                  {/* Document Title & Timestamp */}
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

export default Shared;