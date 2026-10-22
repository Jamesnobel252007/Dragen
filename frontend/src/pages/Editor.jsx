import { useCallback, useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";

import TiptapEditor from "../components/TiptapEditor";
import api from "../api/api";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
const WS_BASE = import.meta.env.VITE_WS_URL || "ws://127.0.0.1:8000";

function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNewDoc = id === "new";


  const [sharing, setSharing] = useState(false);
  const [title, setTitle] = useState("Untitled Document");
  const [status, setStatus] = useState("Saved");
  const [content, setContent] = useState("<p></p>");
  const [fileUrl, setFileUrl] = useState("");
  const [isPdfDocument, setIsPdfDocument] = useState(false);
  const [pdfExtracting, setPdfExtracting] = useState(false);
  const [pdfExtractError, setPdfExtractError] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState("viewer");
  const socketRef = useRef(null);
  const isRemote = useRef(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [collaborators, setCollaborators] = useState([]);
  const [aiMessages, setAiMessages] = useState([]);
const [aiQuestion, setAiQuestion] = useState("");
const [aiLoading, setAiLoading] = useState(false);
const [aiError, setAiError] = useState("");
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [profileOpen, setProfileOpen] = useState(false);

  const profileRef = useRef(null);

  const avatarLetter =
    currentUser?.username?.charAt(0).toUpperCase() || "U";

  const isOwner = collaborators?.some(
    (c) => c.id === currentUser?.id && c.role === "owner"
  );

  const loadCollaborators = useCallback(async () => {
    if (!id || isNewDoc) return;

    try {
      const res = await api.get(`documents/${id}/collaborators/`);
      setCollaborators(res.data);
    } catch (err) {
      console.error(err);
    }
  }, [id, isNewDoc]);

  useEffect(() => {
    return () => {
      if (fileUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [fileUrl]);

  // Create a fresh document when arriving via /editor/new, then swap the
  // URL to the real id so refresh, sharing, and the WebSocket all work.
  useEffect(() => {
    const createNewDocument = async () => {
      try {
        setLoadingDoc(true);
        const { data } = await api.post("documents/", {
          title: "Untitled Document",
          content: "<p></p>",
        });
        navigate(`/editor/${data.id}`, { replace: true });
      } catch (err) {
        console.error(err);
        setLoadError("Couldn't create a new document. Try again.");
        setLoadingDoc(false);
      }
    };

    if (isNewDoc) createNewDocument();
  }, [isNewDoc, navigate]);

  useEffect(() => {
    const loadDocument = async () => {
      if (!id || isNewDoc) return;

      try {
        setLoadingDoc(true);
        setLoadError("");
        const { data } = await api.get(`documents/${id}/`);

        console.log("DOCUMENT DATA:", data);
        console.log("PDF FILE URL:", data.file);

        setTitle(data.title);


        setContent(data.content || "");



        if (data.file && data.file.toLowerCase().split("?")[0].endsWith(".pdf")) {
          setIsPdfDocument(true);
          setPdfExtractError("");

          // Load the original PDF for optional preview
          try {
            const pdfResponse = await api.get(
              `documents/${data.id}/pdf/`,
              {
                responseType: "blob",
              }
            );

            const blobUrl = URL.createObjectURL(pdfResponse.data);
            setFileUrl(blobUrl);
          } catch (pdfError) {
            console.error("PDF preview loading failed:", pdfError);
            setFileUrl("");
          }

          // If the PDF has not been converted into editable content yet,
          // ask the backend to extract it.
          if (!data.content?.trim()) {
            try {
              setPdfExtracting(true);

              const extractResponse = await api.post(
                `documents/${data.id}/extract/`
              );

              const extractedContent = extractResponse.data?.content || "";
              setPdfWarnings(extractResponse.data?.warnings || []);

              setContent(extractedContent || "<p></p>");
              setStatus(extractedContent ? "Saved" : "Ready");
            } catch (extractError) {
              console.error("PDF extraction failed:", extractError);

              const message =
                extractError.response?.data?.error ||
                "Unable to convert this PDF into editable content.";

              setPdfExtractError(message);
            } finally {
              setPdfExtracting(false);
            }
          }

       
       
        } 
        
        else {
          setIsPdfDocument(false);
          setFileUrl("");
          setPdfExtractError("");
        }

        await loadCollaborators();
      } catch (err) {
        console.error(err);
        setLoadError("Couldn't load this document. It may have been removed, or you may not have access.");
      } finally {
        setLoadingDoc(false);
      }

    };

    loadDocument();


  }, [id, isNewDoc, loadCollaborators]);

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const res = await api.get("user/");
        setCurrentUser(res.data);
      } catch (err) {
        console.error(err);
      }
    };

    loadCurrentUser();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowShareModal(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!id || isNewDoc) return;

    const token = localStorage.getItem("access");
    if (!token) return;

    const socket = new WebSocket(
      `${WS_BASE}/ws/documents/${id}/?token=${token}`
    );

    socketRef.current = socket;

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "online_users") {
        setOnlineUsers(data.users);
        return;
      }

      if (data.type === "content") {
        isRemote.current = true;
        setContent(data.message);
      }
    };

    socket.onerror = (e) => {
      console.error("WS error", e);
    };

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [id, isNewDoc]);

  const shareDocument = async () => {
    if (!shareEmail.trim()) return;

    setSharing(true);

    try {
      await api.post("share/", {
        document_id: id,
        email: shareEmail,
        role: shareRole,
      });
      await loadCollaborators();
      setShowShareModal(false);
      setShareEmail("");
      setShareRole("viewer");
    } catch (err) {
      alert(err.response?.data?.error || "Unable to share");
    } finally {
      setSharing(false);
    }
  };

  
  const [editorInstance, setEditorInstance] = useState(null);
  const [selectedText, setSelectedText] = useState("");
  const [showPdfComparison, setShowPdfComparison] = useState(false);
  const [aiActiveTab, setAiActiveTab] = useState("qa"); // "qa" or "write"
  const [writingAction, setWritingAction] = useState("improve");
  const [writingLoading, setWritingLoading] = useState(false);
  const [writingError, setWritingError] = useState("");
  const [proposedText, setProposedText] = useState("");
  const [proposedExplanation, setProposedExplanation] = useState("");
  const [capturedSelection, setCapturedSelection] = useState("");
  const [customWritingInstruction, setCustomWritingInstruction] = useState("");
  const [pdfWarnings, setPdfWarnings] = useState([]);

  const isDirtyRef = useRef(false);
  const saveVersionRef = useRef(0);
  const autosaveTimerRef = useRef(null);

  // Capture selection whenever selection updates
  const handleEditorReady = useCallback((ed) => {
    setEditorInstance(ed);
    ed.on("selectionUpdate", () => {
      const { from, to } = ed.state.selection;
      if (from !== to) {
        const sel = ed.state.doc.textBetween(from, to, " ");
        setSelectedText(sel);
      } else {
        setSelectedText("");
      }
    });
  }, []);

  const saveDocument = useCallback(async () => {
    if (!id || id === "new") return;

    const currentVersion = ++saveVersionRef.current;

    try {
      setStatus("Saving...");

      await api.patch(`documents/${id}/`, {
        title,
        content,
      });

      // Prevent stale save completion
      if (currentVersion === saveVersionRef.current) {
        isDirtyRef.current = false;
        setStatus("Saved");
      }
    } catch (err) {
      console.error("Document save failed:", err);
      if (currentVersion === saveVersionRef.current) {
        setStatus("Couldn't save");
      }
    }
  }, [id, title, content]);

  // Debounced Autosave (1500ms after user stops typing)
  useEffect(() => {
    if (!id || isNewDoc || loadingDoc) return;

    // Mark dirty
    isDirtyRef.current = true;
    setStatus("Unsaved changes");

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      if (isDirtyRef.current) {
        void saveDocument();
      }
    }, 1500);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [content, title, id, isNewDoc, loadingDoc, saveDocument]);

  // Transform selection using AI Writing Assistant
  const handleAiTransform = async (actionType = writingAction) => {
    const textToTransform = capturedSelection || selectedText;
    if (!textToTransform.trim() || !id || isNewDoc) {
      setWritingError("Please select text in the document first.");
      return;
    }

    setWritingLoading(true);
    setWritingError("");
    setProposedText("");
    setProposedExplanation("");
    setCapturedSelection(textToTransform);

    try {
      const response = await api.post(`documents/${id}/ai/rewrite/`, {
        text: textToTransform,
        action: actionType,
        instruction: customWritingInstruction,
      });

      setProposedText(response.data?.replacement || textToTransform);
      setProposedExplanation(response.data?.explanation || "Revisions ready for review.");
    } catch (err) {
      console.error("AI writing transform error:", err);
      setWritingError(err.response?.data?.error || "AI writing assistance failed.");
    } finally {
      setWritingLoading(false);
    }
  };

  // Accept & Replace selected text safely
  const acceptAiRevision = () => {
    if (!editorInstance || !proposedText) return;

    // Insert replacement at current selection or replace captured text
    const { from, to } = editorInstance.state.selection;
    if (from !== to) {
      editorInstance.chain().focus().insertContent(proposedText).run();
    } else {
      // Find and replace capturedSelection or insert at cursor
      const currentHTML = editorInstance.getHTML();
      if (capturedSelection && currentHTML.includes(capturedSelection)) {
        const updated = currentHTML.replace(capturedSelection, proposedText);
        editorInstance.commands.setContent(updated);
        setContent(updated);
      } else {
        editorInstance.chain().focus().insertContent(proposedText).run();
      }
    }

    setProposedText("");
    setProposedExplanation("");
    setCapturedSelection("");
    setStatus("Unsaved changes");
  };

  const rejectAiRevision = () => {
    setProposedText("");
    setProposedExplanation("");
    setCapturedSelection("");
  };



  
  const exportDocument = (format) => {
    if (!content) {
      alert("There is no content to export.");
      return;
    }

    const fileName =
      (title || "Untitled Document")
        .replace(/[<>:"/\\|?*]/g, "")
        .trim() || "Untitled Document";

    // ---------------- HTML ----------------
    if (format === "html") {
      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${fileName}</title>

  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 900px;
      margin: 40px auto;
      padding: 20px;
      line-height: 1.6;
      color: #111110;
    }

    h1 {
      margin-bottom: 30px;
    }

    img {
      max-width: 100%;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th,
    td {
      border: 1px solid #ccc;
      padding: 8px;
    }
  </style>
</head>

<body>

  <h1>${fileName}</h1>

  <div>
    ${content}
  </div>

</body>
</html>
`;

      const blob = new Blob([htmlContent], {
        type: "text/html;charset=utf-8",
      });

      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName}.html`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      return;
    }

    // ---------------- EXCEL ----------------
    if (format === "excel") {
      const worksheet = XLSX.utils.aoa_to_sheet([
        ["Document", fileName],
        [],
        ["Content"],
        [content.replace(/<[^>]*>/g, "")],
      ]);

      const workbook = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Document"
      );

      XLSX.writeFile(
        workbook,
        `${fileName}.xlsx`
      );

      return;
    }

    // ---------------- PDF ----------------
    if (format === "pdf") {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const margin = 20;
      const usableWidth = pageWidth - margin * 2;

      // Title
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);

      pdf.text(
        fileName,
        margin,
        25
      );

      // Content
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);

      const plainText = content
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim();

      const lines = pdf.splitTextToSize(
        plainText,
        usableWidth
      );

      let y = 35;

      lines.forEach((line) => {
        if (y > pageHeight - margin) {
          pdf.addPage();
          y = margin;
        }

        pdf.text(line, margin, y);
        y += 6;
      });

      pdf.save(`${fileName}.pdf`);
      return;
    }

    // ---------------- WORD (.doc) ----------------
    if (format === "doc" || format === "word") {
      const header = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office'
              xmlns:w='urn:schemas-microsoft-com:office:word'
              xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset='utf-8'>
          <title>${fileName}</title>
          <style>
            body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #111110; margin: 1in; }
            h1 { font-size: 20pt; font-weight: bold; margin-bottom: 14pt; }
            h2 { font-size: 16pt; font-weight: bold; margin-bottom: 12pt; }
            h3 { font-size: 13pt; font-weight: bold; margin-bottom: 10pt; }
            table { width: 100%; border-collapse: collapse; margin: 12pt 0; }
            th, td { border: 1pt solid #ccc; padding: 6pt; }
            th { background-color: #f3f3f3; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>${fileName}</h1>
          ${content}
        </body>
        </html>
      `;
      const blob = new Blob(["\ufeff", header], { type: "application/msword;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    }

    // ---------------- MARKDOWN (.md) ----------------
    if (format === "markdown" || format === "md") {
      const markdown = `# ${fileName}\n\n` + content
        .replace(/<h1>(.*?)<\/h1>/gi, "\n# $1\n")
        .replace(/<h2>(.*?)<\/h2>/gi, "\n## $1\n")
        .replace(/<h3>(.*?)<\/h3>/gi, "\n### $1\n")
        .replace(/<h4>(.*?)<\/h4>/gi, "\n#### $1\n")
        .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
        .replace(/<em>(.*?)<\/em>/gi, "*$1*")
        .replace(/<li>(.*?)<\/li>/gi, "- $1\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .trim();

      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    }

    // ---------------- PLAIN TEXT (.txt) ----------------
    if (format === "txt" || format === "text") {
      const text = `${fileName}\n\n` + content
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .trim();

      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    }

    console.warn("Unknown export format:", format);
  };


  const removeCollaborator = async (userId) => {
    if (!window.confirm("Remove this collaborator from this document?")) {
      return;
    }
    try {
      await api.delete(`documents/${id}/remove-collaborator/${userId}/`);
      setCollaborators((prev) => prev.filter((user) => user.id !== userId));
    } catch (err) {
      alert(err.response?.data?.error || "Unable to remove collaborator");
    }
  };

  const updateRole = async (userId, role) => {
    try {
      await api.patch(`collaborators/${userId}/`, { role });
      loadCollaborators();
    } catch (err) {
      console.error(err);
      alert("Unable to update role");
    }
  };


  const askDragenAI = async (question = aiQuestion) => {
  const trimmedQuestion = question.trim();

  if (!trimmedQuestion || !id || isNewDoc || aiLoading) {
    return;
  }

  setAiQuestion("");
  setAiError("");

  setAiMessages((prev) => [
    ...prev,
    {
      role: "user",
      content: trimmedQuestion,
    },
  ]);

  setAiLoading(true);

  try {
    const response = await api.post(
      `documents/${id}/ai/ask/`,
      {
        question: trimmedQuestion,
      }
    );

    const ai = response.data?.ai;

    setAiMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content:
          ai?.answer ||
          "I couldn't generate an answer for this question.",
        suggestions: Array.isArray(ai?.suggestions)
          ? ai.suggestions
          : [],
        sources: Array.isArray(ai?.sources)
          ? ai.sources
          : [],
      },
    ]);
  } catch (err) {
    console.error("Dragen AI error:", err);

    const message =
      err.response?.data?.error ||
      "Unable to get a response from Dragen AI.";

    setAiError(message);
  } finally {
    setAiLoading(false);
  }
};
  const handleLogout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");

    setProfileOpen(false);

    navigate("/");
  };
  if (loadingDoc) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] text-[#111110] flex items-center justify-center font-sans antialiased">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#111110] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-[#787265]">
            {isNewDoc ? "Initializing document canvas..." : "Retrieving document state..."}
          </p>
        </div>
      </div>
    );
  }
  
  if (loadError) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] text-[#111110] flex items-center justify-center p-6 font-sans antialiased">
        <div className="bg-[#FFFFFF] border border-[#E8E3D8] rounded-2xl p-8 max-w-md w-full text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-[#FAECEB] text-[#A63529] border border-[#F2C0BC] flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[#111110] mb-1">Access Restricted</h2>
          <p className="text-sm text-[#787265] mb-6">{loadError}</p>
          <button
            onClick={() => navigate("/documents")}
            className="w-full px-4 py-2.5 rounded-xl bg-[#111110] text-[#FAF8F5] text-sm font-semibold hover:bg-[#262422] transition-colors shadow-xs"
          >
            Return to Documents
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#111110] font-sans antialiased selection:bg-[#111110] selection:text-[#FAF8F5]">
      {/* Editorial Studio Header */}
      <header className="sticky top-0 z-40 bg-[#FAF8F5]/90 backdrop-blur-md border-b border-[#EAE6DF] px-4 sm:px-8 py-3 flex items-center justify-between transition-all">
        {/* Left: Navigation & Document Title */}
        <div className="flex items-center gap-3.5 min-w-0 flex-1 mr-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="w-9 h-9 rounded-xl hover:bg-[#F2EFE9] border border-transparent hover:border-[#E4DFD5] flex items-center justify-center text-[#6B665E] hover:text-[#111110] transition shrink-0"
            title="Back to dashboard"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <div className="w-9 h-9 rounded-xl bg-[#111110] text-[#FAF8F5] border border-[#2D2C29] flex items-center justify-center text-sm font-bold shadow-xs shrink-0">
            D
          </div>

          <div className="min-w-0 flex-1">
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setStatus("Unsaved changes");
              }}
              className="w-full text-base sm:text-lg font-semibold bg-transparent outline-none border-b border-transparent focus:border-[#111110] text-[#111110] truncate transition-colors"
              placeholder="Untitled Document"
            />

            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${status === "Saved" ? "bg-[#10B981]" : "bg-[#D97706] animate-pulse"
                  }`}
              />
              <span className="text-[11px] font-mono text-[#8C867A] uppercase tracking-wider">
                {status}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions & User Avatar */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            disabled={sharing}
            onClick={() => setShowShareModal(true)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E4DFD5] bg-[#FFFFFF] hover:bg-[#F2EFE9] text-xs font-semibold text-[#111110] transition shadow-xs"
          >
            <svg className="w-3.5 h-3.5 text-[#6B665E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <span>{sharing ? "Sharing..." : "Share"}</span>
          </button>

          <button
            onClick={saveDocument}
            className="px-4 py-2 rounded-xl bg-[#111110] hover:bg-[#262422] text-[#FAF8F5] text-xs font-semibold active:scale-[0.98] transition shadow-xs flex items-center gap-1.5"
          >
            <span>Save</span>
          </button>

          <div className="relative">
            <select
              defaultValue=""
              onChange={(e) => {
                exportDocument(e.target.value);
                e.target.value = "";
              }}
              className="px-3 py-2 rounded-xl border border-[#E4DFD5] bg-[#FFFFFF] hover:bg-[#F2EFE9] text-xs font-semibold text-[#111110] outline-none transition cursor-pointer appearance-none pr-7 shadow-xs"
            >
              <option value="" disabled>
                Export
              </option>
              <option value="pdf">PDF Document (.pdf)</option>
              <option value="doc">Word Document (.doc)</option>
              <option value="html">HTML Webpage (.html)</option>
              <option value="markdown">Markdown (.md)</option>
              <option value="txt">Plain Text (.txt)</option>
              <option value="excel">Excel Sheet (.xlsx)</option>
            </select>
            <svg
              className="w-3 h-3 text-[#8C867A] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 4.5L6 7.5L9 4.5" />
            </svg>
          </div>

          <div className="h-5 w-[1px] bg-[#EAE6DF] mx-1 hidden sm:block" />

          <div
            ref={profileRef}
            className="relative"
          >

            <button
              onClick={() =>
                setProfileOpen((prev) => !prev)
              }
              className="flex items-center gap-2 p-1 rounded-full hover:bg-[#F2EFE9] transition-colors focus:outline-none"
              aria-label="Open account menu"
              aria-expanded={profileOpen}
            >

              <div className="w-9 h-9 rounded-full bg-[#111110] text-[#FAF8F5] border border-[#2D2C29] flex items-center justify-center text-sm font-semibold shadow-xs">
                {avatarLetter}
              </div>

              <svg
                width="14"
                height="14"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                className={`text-[#847E72] transition-transform duration-200 ${profileOpen
                  ? "rotate-180 text-[#111110]"
                  : ""
                  }`}
              >
                <path d="M3 4.5L6 7.5L9 4.5" />
              </svg>

            </button>

            {/* PROFILE DROPDOWN */}

            {profileOpen && (
              <div className="absolute right-0 top-12 w-72 bg-[#FAF8F5] border border-[#E4DFD5] rounded-2xl shadow-2xl shadow-[#111110]/10 p-2 z-50 animate-in fade-in zoom-in-95 duration-100">

                {/* User Overview */}
                <div className="px-3.5 py-3 mb-1.5 rounded-xl bg-[#F3EFE8] border border-[#E9E4DB] flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#111110] flex items-center justify-center text-[#FAF8F5] text-base font-semibold shrink-0 shadow-xs">
                    {avatarLetter}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-base font-semibold text-[#111110] truncate leading-tight">
                        {currentUser?.username || "User"}
                      </p>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider bg-[#E8E2D6] text-[#6B665E]">
                        PRO
                      </span>
                    </div>
                    <p className="text-xs text-[#847E72] truncate mt-0.5">
                      {currentUser?.email || "No email connected"}
                    </p>
                  </div>
                </div>

                {/* Actions List */}
                <div className="space-y-0.5">
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      navigate("/profile");
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-base font-medium text-[#4D4942] hover:text-[#111110] hover:bg-[#F0EBE3] transition-colors text-left group"
                  >
                    <svg className="w-4 h-4 text-[#9E9789] group-hover:text-[#111110] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span>Profile</span>
                  </button>

                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      navigate("/settings");
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-base font-medium text-[#4D4942] hover:text-[#111110] hover:bg-[#F0EBE3] transition-colors text-left group"
                  >
                    <svg className="w-4 h-4 text-[#9E9789] group-hover:text-[#111110] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                    <span>Settings</span>
                  </button>

                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      alert("Help & support will be available soon.");
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-base font-medium text-[#4D4942] hover:text-[#111110] hover:bg-[#F0EBE3] transition-colors text-left group"
                  >
                    <svg className="w-4 h-4 text-[#9E9789] group-hover:text-[#111110] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span>Help & support</span>
                  </button>
                </div>

                {/* Logout Option */}
                <div className="mt-1.5 pt-1.5 border-t border-[#EAE6DF]">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-base font-medium text-[#A63529] hover:bg-[#FAECEB] transition-colors text-left group"
                  >
                    <svg className="w-4 h-4 text-[#A63529] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    <span>Log out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Editor Body Area */}
      <main className="px-4 sm:px-8 py-8">
        <div className="max-w-[1520px] mx-auto flex flex-col lg:flex-row gap-8 items-start">

          {/* ================= Editor Canvas ================= */}
          <section className="flex-1 w-full min-w-0">
  <div className="bg-[#FFFFFF] rounded-2xl border border-[#E8E3D8] shadow-sm min-h-[85vh] relative overflow-hidden">

    {pdfExtracting ? (
      <div className="min-h-[85vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-7 h-7 border-2 border-[#111110] border-t-transparent rounded-full animate-spin mx-auto mb-4" />

          <h3 className="text-sm font-semibold text-[#111110]">
            Preparing your PDF
          </h3>

          <p className="text-xs text-[#8C867A] mt-1">
            Converting the document into an editable format...
          </p>
        </div>
      </div>
    ) : (
      <div className="p-6 sm:p-12">

        {isPdfDocument && (
          <div className="mb-6 flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-[#F3EFE8] border border-[#E4DFD5]">

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm">📄</span>

                <p className="text-xs font-semibold text-[#111110]">
                  PDF imported
                </p>
              </div>

              <p className="text-[11px] text-[#8C867A] mt-1">
                This document is now editable in Dragen.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {fileUrl && (
                <button
                  type="button"
                  onClick={() => setShowPdfComparison((prev) => !prev)}
                  className="px-3 py-2 rounded-lg border border-[#E4DFD5] bg-[#FFFFFF] hover:bg-[#F2EFE9] text-[11px] font-semibold text-[#111110] transition flex items-center gap-1.5"
                >
                  <span>{showPdfComparison ? "Hide Original" : "Compare with Original"}</span>
                </button>
              )}

              {fileUrl && (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-lg border border-[#E4DFD5] bg-[#FFFFFF] hover:bg-[#F2EFE9] text-[11px] font-semibold text-[#111110] transition"
                >
                  Open PDF ↗
                </a>
              )}
            </div>

          </div>
        )}

        {pdfWarnings.length > 0 && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#92400E]">
            <p className="font-semibold mb-1">Import Information:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {pdfWarnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {pdfExtractError && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-[#FAECEB] border border-[#F2C0BC]">
            <p className="text-xs font-semibold text-[#A63529]">
              PDF conversion failed
            </p>
            <p className="text-[11px] text-[#A63529] mt-1">
              {pdfExtractError}
            </p>
          </div>
        )}

        {/* Split View for PDF Comparison if active */}
        {showPdfComparison && fileUrl ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8 border-b border-[#EAE6DF] pb-8">
            <div className="border border-[#E4DFD5] rounded-xl overflow-hidden shadow-xs">
              <div className="bg-[#FAF8F5] px-4 py-2 border-b border-[#E4DFD5] text-xs font-semibold text-[#6B665E] flex items-center justify-between">
                <span>Original PDF Document</span>
                <span className="text-[10px] font-mono">Read-Only</span>
              </div>
              <iframe
                src={fileUrl}
                title="Original PDF Preview"
                className="w-full h-[800px] border-0"
              />
            </div>
            <div>
              <div className="bg-[#FAF8F5] px-4 py-2 border-b border-[#E4DFD5] text-xs font-semibold text-[#6B665E] mb-4 rounded-xl flex items-center justify-between">
                <span>Editable Dragen Canvas</span>
                <span className="text-[10px] font-mono text-[#10B981]">Live Reflow</span>
              </div>
              <TiptapEditor
                content={content}
                setContent={setContent}
                setStatus={setStatus}
                socketRef={socketRef}
                isRemote={isRemote}
                onEditorReady={handleEditorReady}
                onSaveShortcut={saveDocument}
              />
            </div>
          </div>
        ) : (
          <TiptapEditor
            content={content}
            setContent={setContent}
            setStatus={setStatus}
            socketRef={socketRef}
            isRemote={isRemote}
            onEditorReady={handleEditorReady}
            onSaveShortcut={saveDocument}
          />
        )}
      </div>
    )}


  </div>
</section>

          {/* ================= Collaboration Panel ================= */}
          <aside className="w-full lg:w-[320px] lg:sticky lg:top-24 space-y-5 shrink-0">

            {/* ONLINE ACTIVE USERS */}
            <div className="bg-[#FFFFFF] rounded-2xl border border-[#E8E3D8] shadow-xs p-5">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#EAE6DF]">
                <h3 className="text-sm font-semibold text-[#111110] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                  Live Presence
                </h3>
                <span className="text-[10px] font-mono text-[#8C867A] uppercase">
                  {onlineUsers.length} Online
                </span>
              </div>

              {onlineUsers.length === 0 ? (
                <p className="text-xs text-[#8C867A] italic py-2">No other collaborators active</p>
              ) : (
                <div className="space-y-2">
                  {onlineUsers.map((user, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg bg-[#FAF8F5] border border-[#EAE6DF] text-xs font-medium text-[#111110]"
                    >
                      <div className="w-2 h-2 rounded-full bg-[#10B981]" />
                      <span className="truncate">{user}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
{/* ================= DRAGEN AI SIDEBAR ================= */}
<div className="bg-[#FFFFFF] rounded-2xl border border-[#E8E3D8] shadow-xs overflow-hidden">

  {/* AI Header with Tabs */}
  <div className="border-b border-[#EAE6DF] bg-[#FAF8F5]">
    <div className="px-5 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-[#111110] text-[#FAF8F5] flex items-center justify-center text-xs">
          ✦
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#111110]">
            Dragen AI
          </h3>
          <p className="text-[10px] text-[#8C867A]">
            {aiActiveTab === "qa" ? "Document Intelligence" : "Writing & Revisions"}
          </p>
        </div>
      </div>

      {aiActiveTab === "qa" && aiMessages.length > 0 && (
        <button
          onClick={() => {
            setAiMessages([]);
            setAiError("");
          }}
          className="text-[10px] font-semibold text-[#8C867A] hover:text-[#111110] transition"
        >
          Clear
        </button>
      )}
    </div>

    {/* Tab Switcher */}
    <div className="flex border-t border-[#EAE6DF] bg-[#F7F4EF]">
      <button
        type="button"
        onClick={() => setAiActiveTab("qa")}
        className={`flex-1 py-2 text-xs font-semibold text-center transition ${
          aiActiveTab === "qa"
            ? "bg-[#FFFFFF] text-[#111110] border-b-2 border-[#111110]"
            : "text-[#8C867A] hover:text-[#111110]"
        }`}
      >
        Document Q&A
      </button>
      <button
        type="button"
        onClick={() => {
          setAiActiveTab("write");
          if (selectedText && !capturedSelection) {
            setCapturedSelection(selectedText);
          }
        }}
        className={`flex-1 py-2 text-xs font-semibold text-center transition ${
          aiActiveTab === "write"
            ? "bg-[#FFFFFF] text-[#111110] border-b-2 border-[#111110]"
            : "text-[#8C867A] hover:text-[#111110]"
        }`}
      >
        Writing Assistant
      </button>
    </div>
  </div>

  {/* TAB 1: DOCUMENT Q&A */}
  {aiActiveTab === "qa" ? (
    <>
      <div className="max-h-[460px] overflow-y-auto px-4 py-4 space-y-4">
        {aiMessages.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm font-semibold text-[#111110]">
              Ask Dragen about this document
            </p>
            <p className="text-xs text-[#8C867A] mt-1 leading-relaxed">
              Answers are grounded strictly in your document text.
            </p>

            <div className="mt-4 space-y-2 text-left">
              {[
                "What is the main topic of this document?",
                "Summarize the key points in 3 bullets.",
                "Extract any dates, names, or deadlines.",
              ].map((question) => (
                <button
                  key={question}
                  onClick={() => askDragenAI(question)}
                  className="w-full text-left px-3 py-2.5 rounded-xl border border-[#E4DFD5] bg-[#FAF8F5] hover:bg-[#F0EBE3] text-xs text-[#4D4942] leading-relaxed transition"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : (
          aiMessages.map((message, index) => (
            <div
              key={index}
              className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  message.role === "user"
                    ? "max-w-[90%] rounded-2xl rounded-br-md bg-[#111110] text-[#FAF8F5] px-3.5 py-2.5 text-xs"
                    : "max-w-[95%] rounded-2xl rounded-bl-md bg-[#F3EFE8] border border-[#E4DFD5] text-[#111110] px-3.5 py-3 text-xs"
                }
              >
                <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>

                {/* Suggestions */}
                {message.role === "assistant" && message.suggestions?.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-[#E4DFD5]">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-[#8C867A] mb-1.5">
                      Suggested follow-ups
                    </p>
                    <div className="space-y-1">
                      {message.suggestions.slice(0, 3).map((suggestion, suggestionIndex) => (
                        <button
                          key={suggestionIndex}
                          onClick={() => askDragenAI(suggestion)}
                          disabled={aiLoading}
                          className="w-full text-left text-[11px] px-2.5 py-1.5 rounded-lg border border-[#E4DFD5] bg-[#FFFFFF] hover:bg-[#FAF8F5] text-[#4D4942] transition"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sources with chunk similarity */}
                {message.role === "assistant" && message.sources?.length > 0 && (
                  <details className="mt-2.5 pt-2 border-t border-[#E4DFD5]">
                    <summary className="cursor-pointer text-[9px] uppercase tracking-wider font-bold text-[#8C867A]">
                      {message.sources.length} Grounded Sources
                    </summary>
                    <div className="mt-1.5 space-y-1.5">
                      {message.sources.map((source, sourceIndex) => (
                        <div key={sourceIndex} className="p-2 rounded-lg bg-[#FFFFFF] border border-[#E4DFD5] text-[10px]">
                          <div className="flex items-center justify-between font-semibold mb-0.5">
                            <span>Chunk {source.chunkIndex + 1}</span>
                            <span className="font-mono text-[#8C867A]">
                              {(source.similarity * 100).toFixed(0)}% match
                            </span>
                          </div>
                          <p className="line-clamp-3 text-[#787265]">{source.text}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </div>
          ))
        )}

        {aiLoading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-[#F3EFE8] border border-[#E4DFD5] px-3.5 py-2.5 text-xs text-[#8C867A] flex items-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-[#111110] border-t-transparent rounded-full animate-spin" />
              <span>Analyzing document context...</span>
            </div>
          </div>
        )}
      </div>

      {aiError && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-xl bg-[#FAECEB] border border-[#F2C0BC] text-xs text-[#A63529]">
          {aiError}
        </div>
      )}

      {/* Q&A Input */}
      <div className="p-3 border-t border-[#EAE6DF] bg-[#FAF8F5]">
        <div className="flex items-end gap-2">
          <textarea
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                askDragenAI();
              }
            }}
            placeholder="Ask about this document..."
            rows={2}
            disabled={aiLoading}
            className="flex-1 resize-none px-3 py-2 rounded-xl border border-[#E4DFD5] bg-[#FFFFFF] text-xs text-[#111110] placeholder:text-[#9E9789] outline-none focus:border-[#111110] transition"
          />
          <button
            onClick={() => askDragenAI()}
            disabled={!aiQuestion.trim() || aiLoading}
            className="w-8 h-8 shrink-0 rounded-xl bg-[#111110] text-[#FAF8F5] flex items-center justify-center hover:bg-[#262422] transition disabled:opacity-40"
            title="Ask Dragen AI"
          >
            {aiLoading ? (
              <div className="w-3 h-3 border-2 border-[#FAF8F5] border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </>
  ) : (
    /* TAB 2: EDITORIAL WRITING ASSISTANT */
    <div className="p-4 space-y-4 max-h-[560px] overflow-y-auto">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-[#111110]">
            Target Selection
          </label>
          {selectedText && (
            <button
              type="button"
              onClick={() => setCapturedSelection(selectedText)}
              className="text-[11px] font-semibold text-[#2563eb] hover:underline"
            >
              Use Selected Text
            </button>
          )}
        </div>
        <textarea
          value={capturedSelection || selectedText}
          onChange={(e) => setCapturedSelection(e.target.value)}
          placeholder="Select text in the editor, or paste text here to revise..."
          rows={3}
          className="w-full p-2.5 text-xs bg-[#FAF8F5] border border-[#E4DFD5] rounded-xl outline-none focus:border-[#111110] resize-none"
        />
      </div>

      {/* Action buttons */}
      <div>
        <label className="block text-xs font-semibold text-[#111110] mb-2">
          Transformation Style
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { id: "fix_grammar", label: "Fix Grammar & Typos" },
            { id: "improve", label: "Improve Clarity" },
            { id: "professional", label: "Professional Tone" },
            { id: "academic", label: "Academic Tone" },
            { id: "concise", label: "Make Concise" },
            { id: "expand", label: "Expand & Elaborate" },
            { id: "simplify", label: "Simplify Language" },
          ].map((act) => (
            <button
              key={act.id}
              type="button"
              onClick={() => {
                setWritingAction(act.id);
                handleAiTransform(act.id);
              }}
              disabled={writingLoading || (!capturedSelection && !selectedText)}
              className={`p-2 text-left rounded-xl border text-xs font-medium transition ${
                writingAction === act.id
                  ? "bg-[#111110] text-[#FAF8F5] border-[#111110]"
                  : "bg-[#FFFFFF] hover:bg-[#F2EFE9] border-[#E4DFD5] text-[#111110]"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {act.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Instruction */}
      <div>
        <label className="block text-xs font-semibold text-[#111110] mb-1">
          Custom Instruction (Optional)
        </label>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={customWritingInstruction}
            onChange={(e) => setCustomWritingInstruction(e.target.value)}
            placeholder="e.g., Make it bullet points or persuasive..."
            className="flex-1 px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#E4DFD5] rounded-xl outline-none focus:border-[#111110]"
          />
          <button
            type="button"
            onClick={() => handleAiTransform(writingAction)}
            disabled={writingLoading || (!capturedSelection && !selectedText)}
            className="px-3 py-1.5 bg-[#111110] text-[#FAF8F5] rounded-xl text-xs font-semibold hover:bg-[#262422] disabled:opacity-40"
          >
            {writingLoading ? "Working..." : "Run"}
          </button>
        </div>
      </div>

      {writingError && (
        <div className="p-2.5 rounded-xl bg-[#FAECEB] border border-[#F2C0BC] text-xs text-[#A63529]">
          {writingError}
        </div>
      )}

      {/* PROPOSED REVISION REVIEW CARD */}
      {proposedText && (
        <div className="p-3 bg-[#FAF8F5] border-2 border-[#10B981]/40 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#065F46] flex items-center gap-1.5">
              <span>✦</span> Proposed Revision
            </span>
            <span className="text-[10px] font-mono text-[#8C867A]">Ready to Apply</span>
          </div>

          <div className="p-2.5 bg-[#FFFFFF] border border-[#E4DFD5] rounded-lg text-xs leading-relaxed text-[#111110] max-h-36 overflow-y-auto whitespace-pre-wrap">
            {proposedText}
          </div>

          {proposedExplanation && (
            <p className="text-[11px] text-[#6B665E] italic">
              Note: {proposedExplanation}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1 border-t border-[#EAE6DF]">
            <button
              type="button"
              onClick={acceptAiRevision}
              className="flex-1 py-2 px-3 rounded-lg bg-[#10B981] hover:bg-[#059669] text-[#FFFFFF] text-xs font-semibold transition shadow-xs flex items-center justify-center gap-1.5"
            >
              <span>✓ Accept & Replace</span>
            </button>
            <button
              type="button"
              onClick={rejectAiRevision}
              className="py-2 px-3 rounded-lg border border-[#E4DFD5] bg-[#FFFFFF] hover:bg-[#F2EFE9] text-xs font-semibold text-[#111110] transition"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(proposedText);
                alert("Copied revision to clipboard!");
              }}
              className="py-2 px-2.5 rounded-lg border border-[#E4DFD5] bg-[#FFFFFF] hover:bg-[#F2EFE9] text-xs text-[#6B665E] transition"
              title="Copy to clipboard"
            >
              📋
            </button>
          </div>
        </div>
      )}
    </div>
  )}

</div>


            {/* COLLABORATORS LIST */}
            <div className="bg-[#FFFFFF] rounded-2xl border border-[#E8E3D8] shadow-xs p-5">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#EAE6DF]">
                <h3 className="text-sm font-semibold text-[#111110]">
                  Permissions & Roles
                </h3>
                <span className="text-[10px] font-mono text-[#8C867A]">
                  {collaborators.length} Members
                </span>
              </div>

              <div className="max-h-[380px] overflow-y-auto divide-y divide-[#EAE6DF]">
                {collaborators.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold text-[#111110] truncate">
                          {user.username}
                        </p>
                        {user.role === "owner" && (
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-[#EAE5DA] text-[#6B665E] px-1.5 py-0.2 rounded">
                            Owner
                          </span>
                        )}
                      </div>
                      {user.role !== "owner" && (
                        <p className="text-[11px] text-[#8C867A] capitalize mt-0.5 font-mono">
                          {user.role}
                        </p>
                      )}
                    </div>

                    {isOwner && user.role !== "owner" ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <select
                          value={user.role}
                          onChange={(e) => updateRole(user.id, e.target.value)}
                          className="text-[11px] border border-[#E4DFD5] bg-[#FAF8F5] rounded-lg px-2 py-1 outline-none text-[#111110] font-medium cursor-pointer"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                        </select>

                        <button
                          onClick={() => removeCollaborator(user.id)}
                          className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[#FAECEB] text-[#8C867A] hover:text-[#A63529] transition-colors"
                          title="Remove collaborator"
                        >
                          ✕
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

                      </aside>
        </div>
      </main>

      {/* SHARE MODAL DIALOG */}
      {showShareModal && (
        <div
          className="fixed inset-0 bg-[#111110]/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-100"
          onClick={() => setShowShareModal(false)}
        >
          <div
            className="bg-[#FAF8F5] border border-[#E4DFD5] rounded-2xl w-full max-w-md p-6 sm:p-7 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#EAE6DF]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#111110] text-[#FAF8F5] flex items-center justify-center text-xs font-semibold">
                  ✦
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#111110]">Grant Document Access</h2>
                  <p className="text-xs text-[#787265] mt-0.5">
                    Invite collaborators with view or write permissions.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowShareModal(false)}
                className="w-7 h-7 rounded-lg hover:bg-[#F0EBE3] flex items-center justify-center text-[#8C867A] hover:text-[#111110] transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B665E]">
                  Collaborator Email
                </label>
                <input
                  type="email"
                  placeholder="collaborator@domain.com"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4DFD5] bg-[#FFFFFF] text-sm text-[#111110] placeholder:text-[#9E9789] outline-none focus:border-[#111110] transition shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B665E]">
                  Permission Role
                </label>
                <select
                  value={shareRole}
                  onChange={(e) => setShareRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4DFD5] bg-[#FFFFFF] text-sm font-medium text-[#111110] outline-none focus:border-[#111110] cursor-pointer"
                >
                  <option value="viewer">Viewer (Read only)</option>
                  <option value="editor">Editor (Full edit & synthesize)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#EAE6DF] mt-6">
                <button
                  onClick={() => setShowShareModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-[#E4DFD5] bg-[#FFFFFF] hover:bg-[#F2EFE9] text-xs font-semibold text-[#111110] transition-colors"
                >
                  Cancel
                </button>

                <button
                  onClick={shareDocument}
                  disabled={sharing}
                  className="px-5 py-2.5 rounded-xl bg-[#111110] text-[#FAF8F5] text-xs font-semibold hover:bg-[#262422] transition-colors shadow-xs disabled:opacity-50"
                >
                  {sharing ? "Sending invite..." : "Send Invite"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Editor;