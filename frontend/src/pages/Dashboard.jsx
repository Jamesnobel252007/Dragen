import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";

async function fetchDashboardData() {
  const { data: documents } = await api.get("documents/");

  const activeDocuments = documents.filter((doc) => !doc.is_trashed);

  const stats = {
    totalDocs: activeDocuments.length,

    favoriteDocs: activeDocuments.filter(
      (doc) => doc.is_favorite
    ).length,

    // Until you have a dedicated shared endpoint
    sharedDocs: activeDocuments.filter(
      (doc) => doc.owner !== null
    ).length,

    storageUsedMB: 0,
    storageLimitMB: 500,
  };

  const recentDocuments = activeDocuments
    .sort(
      (a, b) =>
        new Date(b.updated_at) -
        new Date(a.updated_at)
    )
    .slice(0, 4)
    .map((doc) => ({
      id: doc.id,
      title: doc.title,
      updatedAt: doc.updated_at,
      isFavorite: doc.is_favorite,
      isShared: doc.owner !== null,
    }));

  return {
    stats,
    recentDocuments,
  };
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

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  useEffect(() => {
    fetchDashboardData()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleCreateDocument = () => {
    navigate("/editor/new");
  };

  const handleUploadPDF = async (event) => {
    const file = event.target.files?.[0];

    // Reset the input so the same file can be selected again
    event.target.value = "";

    if (!file) return;

    setUploadError("");
    setUploadSuccess("");

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Only PDF files are allowed.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("PDF file size cannot exceed 10 MB.");
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await api.post("documents/upload/", formData);

      setUploadSuccess(`"${file.name}" uploaded successfully. Opening editor...`);

      if (uploadRes.data?.id) {
        navigate(`/editor/${uploadRes.data.id}`);
        return;
      }

      // Refresh dashboard so the new document appears immediately
      const refreshedData = await fetchDashboardData();
      setData(refreshedData);
    } catch (error) {
      console.error("PDF upload failed:", error);

      const message =
        error.response?.data?.file?.[0] ||
        error.response?.data?.error ||
        "Failed to upload PDF. Please try again.";

      setUploadError(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex font-sans antialiased text-[#111110] selection:bg-[#111110] selection:text-[#FAF8F5]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          search={search}
          setSearch={setSearch}
        />

        <main className="flex-1 p-6 sm:p-8 lg:p-10 max-w-7xl w-full mx-auto">
          {loading ? (
            <div className="space-y-8 animate-pulse">
              <div className="flex items-center justify-between">
                <div>
                  <div className="h-8 w-56 bg-[#EBE7DF] rounded-xl mb-2" />
                  <div className="h-4 w-72 bg-[#EBE7DF] rounded-lg" />
                </div>
                <div className="h-11 w-36 bg-[#EBE7DF] rounded-xl" />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-28 bg-[#EBE7DF] rounded-2xl" />
                ))}
              </div>
              <div className="h-48 bg-[#EBE7DF] rounded-2xl" />
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-[#FAECEB] border border-[#F2C0BC] text-[#A63529] max-w-lg flex items-center gap-3">
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-medium">{error}</p>
            </div>
          ) : (
            <DashboardContent
  data={data}
  navigate={navigate}
  handleCreateDocument={handleCreateDocument}
  handleUploadPDF={handleUploadPDF}
  uploading={uploading}
  uploadError={uploadError}
  uploadSuccess={uploadSuccess}
/>
          )}
        </main>
      </div>
    </div>
  );
}
function DashboardContent({
  data,
  navigate,
  handleCreateDocument,
  handleUploadPDF,
  uploading,
  uploadError,
  uploadSuccess,
}) {
  const { stats, recentDocuments } = data;
  const storagePercent = Math.round((stats.storageUsedMB / stats.storageLimitMB) * 100);

  const statCards = [
    {
      label: "Total documents",
      value: stats.totalDocs,
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      ),
    },
    {
      label: "Shared with you",
      value: stats.sharedDocs,
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      label: "Starred favorites",
      value: stats.favoriteDocs,
      icon: (
        <svg className="w-5 h-5 text-[#B58A3B]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ),
    },
    {
      label: "Storage used",
      value: `${storagePercent}%`,
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
          <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
          <line x1="6" y1="6" x2="6.01" y2="6" />
          <line x1="6" y1="18" x2="6.01" y2="18" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-10">
      {/* Overview Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#EAE6DF]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-semibold tracking-tight text-[#111110]">
              Workspace Overview
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase bg-[#EAE5DA] text-[#6B665E]">
              Active
            </span>
          </div>
          <p className="text-base text-[#787265]">
            Manage, organize, and synthesize your intelligent documents.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Upload PDF */}
          <label
            className={`inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl border border-[#E4DFD5] bg-[#FAF8F5] text-[#111110] text-base font-semibold transition-all shadow-sm ${uploading
              ? "opacity-60 cursor-not-allowed"
              : "hover:bg-[#F3EFE8] hover:border-[#D5CEC1] cursor-pointer active:scale-[0.98]"
              }`}
          >
            <span className="text-lg text-[#B58A3B]">
              {uploading ? "..." : "↑"}
            </span>

            <span>
              {uploading ? "Uploading..." : "Upload PDF"}
            </span>

            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleUploadPDF}
              disabled={uploading}
              className="hidden"
            />
          </label>

          {/* New Document */}
          <button
            onClick={handleCreateDocument}
            className="inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-[#111110] text-[#FAF8F5] text-base font-semibold hover:bg-[#262422] active:scale-[0.98] transition-all shadow-md shadow-[#111110]/10 shrink-0 group"
          >
            <span className="text-base text-[#B58A3B] group-hover:rotate-90 transition-transform">
              ✦
            </span>

            <span>New Document</span>
          </button>
        </div>

        {uploadError && (
  <div className="mt-4 px-4 py-3 rounded-xl bg-[#A63529]/10 border border-[#A63529]/20 text-[#A63529] text-sm">
    {uploadError}
  </div>
)}

{uploadSuccess && (
  <div className="mt-4 px-4 py-3 rounded-xl bg-[#B58A3B]/10 border border-[#B58A3B]/20 text-[#6B665E] text-sm">
    {uploadSuccess}
  </div>
)}
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-[#FFFFFF] border border-[#E8E3D8] rounded-2xl p-5 shadow-xs hover:border-[#D4CEBF] transition-colors"
          >
            <div className="flex items-center justify-between mb-3 text-[#787265]">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8C867A]">
                {card.label}
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#FAF8F5] border border-[#EAE6DF] flex items-center justify-center text-[#111110]">
                {card.icon}
              </div>
            </div>
            <p className="text-3xl font-semibold tracking-tight text-[#111110]">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Recent Documents Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-[#111110]">
              Recent Documents
            </h2>
            <span className="text-xs font-mono text-[#8C867A]">
              ({recentDocuments.length})
            </span>
          </div>
          <button
            onClick={() => navigate("/documents")}
            className="text-sm font-semibold text-[#111110] hover:text-[#B58A3B] transition-colors underline-offset-4 hover:underline"
          >
            View all →
          </button>
        </div>

        {recentDocuments.length === 0 ? (
          <div className="border border-dashed border-[#DCD6C9] bg-[#FFFFFF]/60 rounded-2xl p-14 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#F2EFE9] border border-[#E4DFD5] flex items-center justify-center mx-auto mb-4 text-[#8C867A]">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <p className="text-base font-semibold text-[#111110] mb-1">
              No documents created yet
            </p>
            <p className="text-sm text-[#787265] max-w-sm mx-auto mb-5">
              Start writing, drafting research notes, or generating structured RAG knowledge.
            </p>
            <button
              onClick={handleCreateDocument}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#DCD6C9] bg-[#FAF8F5] text-sm font-semibold text-[#111110] hover:bg-[#F2EFE9] transition-all"
            >
              <span className="text-[#B58A3B]">✦</span>
              <span>Create your first document</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentDocuments.map((doc) => (
              <button
                key={doc.id}
                onClick={() => navigate(`/editor/${doc.id}`)}
                className="group text-left bg-[#FFFFFF] border border-[#E8E3D8] hover:border-[#111110] rounded-2xl p-5 transition-all duration-150 shadow-xs hover:shadow-md flex flex-col justify-between h-44 relative overflow-hidden"
              >
                {/* Top preview icon row */}
                <div className="flex items-start justify-between w-full">
                  <div className="w-9 h-9 rounded-xl bg-[#FAF8F5] border border-[#EAE6DF] flex items-center justify-center text-[#6B665E] group-hover:text-[#111110] group-hover:border-[#111110]/30 transition-colors">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>

                  {doc.isFavorite && (
                    <span className="text-[#B58A3B]">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                        <polygon points="10 2 12.5 7.5 18 8.3 14 12.2 15 17.5 10 14.8 5 17.5 6 12.2 2 8.3 7.5 7.5 10 2" />
                      </svg>
                    </span>
                  )}
                </div>

                {/* Title & Metadata */}
                <div>
                  <h3 className="text-base font-semibold text-[#111110] truncate group-hover:text-[#B58A3B] transition-colors mb-2">
                    {doc.title || "Untitled Document"}
                  </h3>
                  <div className="flex items-center gap-2 text-xs font-mono text-[#8C867A]">
                    <span>{timeAgo(doc.updatedAt)}</span>
                    {doc.isShared && (
                      <span className="px-1.5 py-0.5 rounded bg-[#F2EFE9] text-[#6B665E] font-sans text-[10px] font-semibold uppercase">
                        Shared
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}