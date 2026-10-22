import { useEffect, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import FontFamily from "@tiptap/extension-font-family";
import { Extension, Mark, Node } from "@tiptap/core";

// ---------------------------------------------------------------------------
// Custom Tiptap Extensions
// ---------------------------------------------------------------------------

const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
});

const Subscript = Mark.create({
  name: "subscript",
  parseHTML() {
    return [{ tag: "sub" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["sub", HTMLAttributes, 0];
  },
});

const Superscript = Mark.create({
  name: "superscript",
  parseHTML() {
    return [{ tag: "sup" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["sup", HTMLAttributes, 0];
  },
});

const CustomLink = Mark.create({
  name: "customLink",
  priority: 1000,
  keepOnSplit: false,
  addAttributes() {
    return {
      href: { default: null },
      target: { default: "_blank" },
      rel: { default: "noopener noreferrer" },
    };
  },
  parseHTML() {
    return [{ tag: "a[href]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["a", { ...HTMLAttributes, class: "dragen-link text-[#2563eb] underline underline-offset-2 cursor-pointer" }, 0];
  },
});

// Semantic Table Nodes for full table editing and PDF table rendering
const Table = Node.create({
  name: "table",
  group: "block",
  content: "tableRow+",
  tableRole: "table",
  isolating: true,
  parseHTML() {
    return [{ tag: "table" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "table",
      { ...HTMLAttributes, class: "dragen-table border-collapse w-full my-4 border border-[#d4cebf]" },
      0,
    ];
  },
});

const TableRow = Node.create({
  name: "tableRow",
  content: "(tableCell | tableHeader)*",
  tableRole: "row",
  parseHTML() {
    return [{ tag: "tr" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["tr", HTMLAttributes, 0];
  },
});

const TableCell = Node.create({
  name: "tableCell",
  content: "block+",
  tableRole: "cell",
  isolating: true,
  parseHTML() {
    return [{ tag: "td" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "td",
      { ...HTMLAttributes, class: "border border-[#d4cebf] p-2 min-w-[60px]" },
      0,
    ];
  },
});

const TableHeader = Node.create({
  name: "tableHeader",
  content: "block+",
  tableRole: "header_cell",
  isolating: true,
  parseHTML() {
    return [{ tag: "th" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "th",
      { ...HTMLAttributes, class: "border border-[#d4cebf] p-2 bg-[#f7f4ef] font-semibold text-left min-w-[60px]" },
      0,
    ];
  },
});

function normalizeEditorContent(content) {
  if (!content) return "<p></p>";

  const doc = new DOMParser().parseFromString(content, "text/html");

  const blocks = doc.body.querySelectorAll(
    "h1, h2, h3, h4, h5, h6, p, ul, ol, blockquote, pre, table"
  );

  if (blocks.length > 1) {
    return doc.body.innerHTML;
  }

  const paragraph = doc.body.querySelector("p");
  if (!paragraph || !paragraph.querySelector("br")) {
    return doc.body.innerHTML || "<p></p>";
  }

  const result = [];
  let current = document.createElement("p");

  Array.from(paragraph.childNodes).forEach((node) => {
    if (node.nodeName === "BR") {
      if (current.innerHTML.trim()) {
        result.push(current.outerHTML);
      }
      current = document.createElement("p");
    } else {
      current.appendChild(node.cloneNode(true));
    }
  });

  if (current.innerHTML.trim()) {
    result.push(current.outerHTML);
  }

  return result.join("") || "<p></p>";
}

// ---------------------------------------------------------------------------
// TiptapEditor Component
// ---------------------------------------------------------------------------

function TiptapEditor({
  content,
  setContent,
  setStatus,
  socketRef,
  onEditorReady = () => {},
}) {
  const [align, setAlign] = useState("left");
  const [currentFontSize, setCurrentFontSize] = useState("");
  const [currentFontFamily, setCurrentFontFamily] = useState("Inter");
  const [showColorPalette, setShowColorPalette] = useState(false);
  const [showHighlightPalette, setShowHighlightPalette] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  const remoteUpdateRef = useRef(false);
  const colorPickerRef = useRef(null);
  const highlightPickerRef = useRef(null);

  const updateAlignment = useCallback((currentEditor) => {
    if (!currentEditor) return;
    const { $from } = currentEditor.state.selection;
    const currentNode = $from.parent;

    if (
      currentNode.type.name === "paragraph" ||
      currentNode.type.name === "heading" ||
      currentNode.type.name === "listItem"
    ) {
      setAlign(currentNode.attrs.textAlign || "left");
    }
  }, []);

  const updateStats = useCallback((currentEditor) => {
    if (!currentEditor) return;
    const text = currentEditor.getText();
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    setWordCount(words);
    setCharCount(chars);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: true,
      }),
      Underline,
      Subscript,
      Superscript,
      CustomLink,
      Table,
      TableRow,
      TableCell,
      TableHeader,
      TextStyle,
      FontSize,
      FontFamily,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ["heading", "paragraph", "listItem", "blockquote"],
      }),
    ],

    onSelectionUpdate: ({ editor: ed }) => {
      updateAlignment(ed);
      updateStats(ed);
    },

    onTransaction: ({ editor: ed }) => {
      updateAlignment(ed);
      updateStats(ed);
    },

    editorProps: {
      attributes: {
        class:
          "prose prose-neutral max-w-none focus:outline-none min-h-[720px] text-[#111110] leading-relaxed text-[16px] sm:text-[17px]",
      },
    },

    onUpdate: ({ editor: ed }) => {
      if (remoteUpdateRef.current) {
        remoteUpdateRef.current = false;
        return;
      }

      const html = ed.getHTML();
      setContent(html);
      setStatus("Unsaved changes");
      updateStats(ed);

      if (
        socketRef?.current &&
        socketRef.current.readyState === WebSocket.OPEN
      ) {
        socketRef.current.send(
          JSON.stringify({
            type: "content",
            message: html,
          })
        );
      }
    },
  });

  // Notify parent component about editor instance
  useEffect(() => {
    if (editor) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Sync content from outside
  useEffect(() => {
    if (!editor || content == null) return;
    const normalizedContent = normalizeEditorContent(content);

    if (normalizedContent !== editor.getHTML()) {
      remoteUpdateRef.current = true;
      editor.commands.setContent(normalizedContent, {
        emitUpdate: false,
      });
      updateStats(editor);
    }
  }, [content, editor, updateStats]);

  // Close color palettes when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) {
        setShowColorPalette(false);
      }
      if (highlightPickerRef.current && !highlightPickerRef.current.contains(e.target)) {
        setShowHighlightPalette(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const applyAlignment = (alignment) => {
    if (!editor) return;
    editor.chain().focus().setTextAlign(alignment).run();
    setAlign(alignment);
  };

  const setLink = () => {
    if (!editor) return;
    if (!linkUrl.trim()) {
      editor.chain().focus().unsetMark("customLink").run();
      setShowLinkModal(false);
      return;
    }
    const validUrl = linkUrl.startsWith("http://") || linkUrl.startsWith("https://")
      ? linkUrl.trim()
      : `https://${linkUrl.trim()}`;

    editor
      .chain()
      .focus()
      .setMark("customLink", { href: validUrl })
      .run();

    setShowLinkModal(false);
    setLinkUrl("");
  };

  const insertTable = () => {
    if (!editor) return;
    const tableHTML = `
      <table>
        <thead>
          <tr>
            <th>Header 1</th>
            <th>Header 2</th>
            <th>Header 3</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Cell 1</td>
            <td>Cell 2</td>
            <td>Cell 3</td>
          </tr>
          <tr>
            <td>Cell 4</td>
            <td>Cell 5</td>
            <td>Cell 6</td>
          </tr>
        </tbody>
      </table>
    `;
    editor.chain().focus().insertContent(tableHTML).run();
  };

  const executeFindReplace = (replaceAll = false) => {
    if (!editor || !findText) return;
    const currentHTML = editor.getHTML();
    if (!currentHTML.includes(findText)) {
      alert(`Text "${findText}" not found in document.`);
      return;
    }

    let updatedHTML = "";
    if (replaceAll) {
      updatedHTML = currentHTML.replaceAll(findText, replaceText);
    } else {
      updatedHTML = currentHTML.replace(findText, replaceText);
    }

    editor.commands.setContent(updatedHTML);
    setContent(updatedHTML);
    setStatus("Unsaved changes");
  };

  if (!editor) return null;

  return (
    <div className="w-full flex flex-col items-center">
      {/* ----------------- WORD-LIKE RICH TOOLBAR ----------------- */}
      <div className="sticky top-20 z-30 mb-8 flex flex-wrap items-center gap-1 p-2 rounded-2xl bg-[#FAF8F5]/95 backdrop-blur-md border border-[#E4DFD5] shadow-lg shadow-[#111110]/5 max-w-full">
        
        {/* 1. History (Undo / Redo) */}
        <div className="flex items-center gap-0.5 pr-1 border-r border-[#EAE6DF]">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-[#6B665E] hover:text-[#111110] hover:bg-[#F0EBE3] disabled:opacity-30 transition-colors"
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7v6h6" />
              <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
            </svg>
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-[#6B665E] hover:text-[#111110] hover:bg-[#F0EBE3] disabled:opacity-30 transition-colors"
            title="Redo (Ctrl+Y)"
            aria-label="Redo"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 7v6h-6" />
              <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
            </svg>
          </button>
        </div>

        {/* 2. Paragraph & Heading Style */}
        <select
          value={
            editor.isActive("heading", { level: 1 })
              ? "h1"
              : editor.isActive("heading", { level: 2 })
              ? "h2"
              : editor.isActive("heading", { level: 3 })
              ? "h3"
              : editor.isActive("heading", { level: 4 })
              ? "h4"
              : "p"
          }
          onChange={(e) => {
            const val = e.target.value;
            if (val === "p") editor.chain().focus().setParagraph().run();
            else if (val === "h1") editor.chain().focus().toggleHeading({ level: 1 }).run();
            else if (val === "h2") editor.chain().focus().toggleHeading({ level: 2 }).run();
            else if (val === "h3") editor.chain().focus().toggleHeading({ level: 3 }).run();
            else if (val === "h4") editor.chain().focus().toggleHeading({ level: 4 }).run();
          }}
          className="h-8 px-2 text-xs font-medium bg-[#FFFFFF] border border-[#E4DFD5] rounded-xl text-[#111110] outline-none focus:border-[#111110] cursor-pointer"
          title="Text Style"
        >
          <option value="p">Normal text</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
        </select>

        {/* 3. Font Family */}
        <select
          value={currentFontFamily}
          onChange={(e) => {
            const family = e.target.value;
            setCurrentFontFamily(family);
            editor.chain().focus().setFontFamily(family).run();
          }}
          className="h-8 px-2 text-xs font-medium bg-[#FFFFFF] border border-[#E4DFD5] rounded-xl text-[#111110] outline-none focus:border-[#111110] cursor-pointer max-w-[120px]"
          title="Font Family"
        >
          <option value="Inter">Inter (Sans)</option>
          <option value="Arial">Arial</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Georgia">Georgia (Serif)</option>
          <option value="Garamond">Garamond</option>
          <option value="Courier New">Courier (Mono)</option>
          <option value="Trebuchet MS">Trebuchet MS</option>
          <option value="Verdana">Verdana</option>
        </select>

        {/* 4. Font Size */}
        <select
          value={currentFontSize}
          onChange={(e) => {
            const size = e.target.value;
            setCurrentFontSize(size);
            if (size) {
              editor.chain().focus().setMark("textStyle", { fontSize: size }).run();
            } else {
              editor.chain().focus().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run();
            }
          }}
          className="h-8 px-2 text-xs font-medium bg-[#FFFFFF] border border-[#E4DFD5] rounded-xl text-[#111110] outline-none focus:border-[#111110] cursor-pointer"
          title="Font Size"
        >
          <option value="">Size</option>
          {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72].map((s) => (
            <option key={s} value={`${s}pt`}>
              {s} pt
            </option>
          ))}
        </select>

        <div className="h-4 w-[1px] bg-[#EAE6DF] mx-0.5" />

        {/* 5. Inline Formatting: Bold, Italic, Underline, Strike */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-bold transition-colors ${
              editor.isActive("bold") ? "bg-[#111110] text-[#FAF8F5]" : "text-[#6B665E] hover:text-[#111110] hover:bg-[#F0EBE3]"
            }`}
            title="Bold (Ctrl+B)"
          >
            B
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs italic font-serif transition-colors ${
              editor.isActive("italic") ? "bg-[#111110] text-[#FAF8F5]" : "text-[#6B665E] hover:text-[#111110] hover:bg-[#F0EBE3]"
            }`}
            title="Italic (Ctrl+I)"
          >
            I
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs underline underline-offset-2 font-medium transition-colors ${
              editor.isActive("underline") ? "bg-[#111110] text-[#FAF8F5]" : "text-[#6B665E] hover:text-[#111110] hover:bg-[#F0EBE3]"
            }`}
            title="Underline (Ctrl+U)"
          >
            U
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs line-through font-medium transition-colors ${
              editor.isActive("strike") ? "bg-[#111110] text-[#FAF8F5]" : "text-[#6B665E] hover:text-[#111110] hover:bg-[#F0EBE3]"
            }`}
            title="Strikethrough"
          >
            S
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleMark("subscript").run()}
            className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs transition-colors ${
              editor.isActive("subscript") ? "bg-[#111110] text-[#FAF8F5]" : "text-[#6B665E] hover:text-[#111110] hover:bg-[#F0EBE3]"
            }`}
            title="Subscript"
          >
            X<sub>2</sub>
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleMark("superscript").run()}
            className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs transition-colors ${
              editor.isActive("superscript") ? "bg-[#111110] text-[#FAF8F5]" : "text-[#6B665E] hover:text-[#111110] hover:bg-[#F0EBE3]"
            }`}
            title="Superscript"
          >
            X<sup>2</sup>
          </button>
        </div>

        <div className="h-4 w-[1px] bg-[#EAE6DF] mx-0.5" />

        {/* 6. Text Color & Highlight */}
        <div className="flex items-center gap-1">
          {/* Text Color Dropdown / Input */}
          <div className="relative" ref={colorPickerRef}>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowColorPalette((prev) => !prev)}
              className="h-8 px-2 flex items-center gap-1 rounded-xl border border-[#E4DFD5] bg-[#FFFFFF] text-xs font-semibold hover:border-[#111110]"
              title="Text Color"
            >
              <span className="font-bold border-b-2 border-[#111110]">A</span>
              <span className="text-[10px]">▾</span>
            </button>

            {showColorPalette && (
              <div className="absolute top-10 left-0 z-50 p-2.5 bg-[#FFFFFF] border border-[#E4DFD5] rounded-xl shadow-xl flex flex-col gap-2 w-44">
                <span className="text-[11px] font-semibold text-[#6B665E] uppercase tracking-wider">Palette</span>
                <div className="grid grid-cols-5 gap-1.5">
                  {["#111110", "#475569", "#dc2626", "#ea580c", "#d97706", "#059669", "#0284c7", "#2563eb", "#7c3aed", "#db2777"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        editor.chain().focus().setColor(c).run();
                        setShowColorPalette(false);
                      }}
                      className="w-6 h-6 rounded-md border border-[#E4DFD5] hover:scale-110 transition-transform"
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
                <div className="pt-2 border-t border-[#EAE6DF] flex items-center justify-between">
                  <span className="text-xs text-[#6B665E]">Custom:</span>
                  <input
                    type="color"
                    onChange={(e) => {
                      editor.chain().focus().setColor(e.target.value).run();
                    }}
                    className="w-6 h-6 p-0 border-0 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Highlight Color Dropdown */}
          <div className="relative" ref={highlightPickerRef}>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowHighlightPalette((prev) => !prev)}
              className={`h-8 px-2 flex items-center gap-1 rounded-xl border border-[#E4DFD5] text-xs font-semibold ${
                editor.isActive("highlight") ? "bg-[#fef08a] text-[#111110]" : "bg-[#FFFFFF] hover:border-[#111110]"
              }`}
              title="Highlight Color"
            >
              <span>✦</span>
              <span className="text-[10px]">▾</span>
            </button>

            {showHighlightPalette && (
              <div className="absolute top-10 left-0 z-50 p-2.5 bg-[#FFFFFF] border border-[#E4DFD5] rounded-xl shadow-xl flex flex-col gap-2 w-40">
                <span className="text-[11px] font-semibold text-[#6B665E] uppercase tracking-wider">Highlights</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { color: "#fef08a", name: "Yellow" },
                    { color: "#bbf7d0", name: "Green" },
                    { color: "#bfdbfe", name: "Blue" },
                    { color: "#fed7aa", name: "Orange" },
                    { color: "#fbcfe8", name: "Pink" },
                    { color: "#e9d5ff", name: "Purple" },
                  ].map((h) => (
                    <button
                      key={h.color}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        editor.chain().focus().setHighlight({ color: h.color }).run();
                        setShowHighlightPalette(false);
                      }}
                      className="w-6 h-6 rounded-md border border-[#E4DFD5] hover:scale-110 transition-transform"
                      style={{ backgroundColor: h.color }}
                      title={h.name}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    editor.chain().focus().unsetHighlight().run();
                    setShowHighlightPalette(false);
                  }}
                  className="w-full py-1 text-xs text-[#A63529] hover:bg-[#FAECEB] rounded-md font-medium transition-colors mt-1"
                >
                  Clear Highlight
                </button>
              </div>
            )}
          </div>

          {/* Clear Formatting */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-xs font-medium text-[#6B665E] hover:text-[#111110] hover:bg-[#F0EBE3] transition-colors"
            title="Clear all formatting"
          >
            T⃠
          </button>
        </div>

        <div className="h-4 w-[1px] bg-[#EAE6DF] mx-0.5" />

        {/* 7. Alignment */}
        <div className="flex items-center gap-0.5">
          {[
            { value: "left", label: "Left", icon: "M3 6h18M3 12h12M3 18h18" },
            { value: "center", label: "Center", icon: "M3 6h18M6 12h12M3 18h18" },
            { value: "right", label: "Right", icon: "M3 6h18M9 12h12M3 18h18" },
            { value: "justify", label: "Justify", icon: "M3 6h18M3 12h18M3 18h18" },
          ].map(({ value, label, icon }) => (
            <button
              key={value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyAlignment(value)}
              className={`w-8 h-8 flex items-center justify-center rounded-xl transition-colors ${
                align === value ? "bg-[#111110] text-[#FAF8F5]" : "text-[#6B665E] hover:text-[#111110] hover:bg-[#F0EBE3]"
              }`}
              title={`Align ${label}`}
              aria-label={`Align ${label}`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d={icon} />
              </svg>
            </button>
          ))}
        </div>

        <div className="h-4 w-[1px] bg-[#EAE6DF] mx-0.5" />

        {/* 8. Lists & Indentation */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`w-8 h-8 flex items-center justify-center rounded-xl transition-colors ${
              editor.isActive("bulletList") ? "bg-[#111110] text-[#FAF8F5]" : "text-[#6B665E] hover:text-[#111110] hover:bg-[#F0EBE3]"
            }`}
            title="Bullet list"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="9" y1="6" x2="20" y2="6" />
              <line x1="9" y1="12" x2="20" y2="12" />
              <line x1="9" y1="18" x2="20" y2="18" />
              <circle cx="4" cy="6" r="2" fill="currentColor" />
              <circle cx="4" cy="12" r="2" fill="currentColor" />
              <circle cx="4" cy="18" r="2" fill="currentColor" />
            </svg>
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-mono font-bold transition-colors ${
              editor.isActive("orderedList") ? "bg-[#111110] text-[#FAF8F5]" : "text-[#6B665E] hover:text-[#111110] hover:bg-[#F0EBE3]"
            }`}
            title="Numbered list"
          >
            1.
          </button>
        </div>

        <div className="h-4 w-[1px] bg-[#EAE6DF] mx-0.5" />

        {/* 9. Insert Tools: Link, Table, Quote, HR */}
        <div className="flex items-center gap-0.5">
          {/* Link Modal Toggle */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowLinkModal((prev) => !prev)}
            className={`w-8 h-8 flex items-center justify-center rounded-xl transition-colors ${
              editor.isActive("customLink") ? "bg-[#111110] text-[#FAF8F5]" : "text-[#6B665E] hover:text-[#111110] hover:bg-[#F0EBE3]"
            }`}
            title="Insert Hyperlink"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </button>

          {/* Table */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={insertTable}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-[#6B665E] hover:text-[#111110] hover:bg-[#F0EBE3] transition-colors"
            title="Insert 3x3 Table"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
            </svg>
          </button>

          {/* Blockquote */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-serif italic transition-colors ${
              editor.isActive("blockquote") ? "bg-[#111110] text-[#FAF8F5]" : "text-[#6B665E] hover:text-[#111110] hover:bg-[#F0EBE3]"
            }`}
            title="Blockquote"
          >
            “ ”
          </button>

          {/* Horizontal Rule */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-[#6B665E] hover:text-[#111110] hover:bg-[#F0EBE3] transition-colors"
            title="Horizontal Divider"
          >
            ―
          </button>
        </div>

        <div className="h-4 w-[1px] bg-[#EAE6DF] mx-0.5" />

        {/* 10. Find & Replace Toggle */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setShowFindReplace((prev) => !prev)}
          className={`h-8 px-2 flex items-center gap-1 rounded-xl text-xs font-medium transition-colors ${
            showFindReplace ? "bg-[#111110] text-[#FAF8F5]" : "text-[#6B665E] hover:text-[#111110] hover:bg-[#F0EBE3]"
          }`}
          title="Find and Replace"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span>Find</span>
        </button>
      </div>

      {/* ----------------- FIND & REPLACE BAR ----------------- */}
      {showFindReplace && (
        <div className="w-full max-w-[794px] mb-4 p-3 rounded-2xl bg-[#FFFFFF] border border-[#E4DFD5] shadow-md flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Find in document..."
            value={findText}
            onChange={(e) => setFindText(e.target.value)}
            className="flex-1 min-w-[140px] px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#E4DFD5] rounded-xl outline-none focus:border-[#111110]"
          />
          <input
            type="text"
            placeholder="Replace with..."
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            className="flex-1 min-w-[140px] px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#E4DFD5] rounded-xl outline-none focus:border-[#111110]"
          />
          <button
            type="button"
            onClick={() => executeFindReplace(false)}
            className="px-3 py-1.5 text-xs font-semibold bg-[#FAF8F5] hover:bg-[#F0EBE3] border border-[#E4DFD5] rounded-xl text-[#111110] transition-colors"
          >
            Replace
          </button>
          <button
            type="button"
            onClick={() => executeFindReplace(true)}
            className="px-3 py-1.5 text-xs font-semibold bg-[#111110] text-[#FAF8F5] hover:bg-[#262422] rounded-xl transition-colors"
          >
            Replace All
          </button>
          <button
            type="button"
            onClick={() => setShowFindReplace(false)}
            className="w-7 h-7 flex items-center justify-center text-xs text-[#8C867A] hover:text-[#111110]"
            title="Close"
          >
            ✕
          </button>
        </div>
      )}

      {/* ----------------- LINK POPUP MODAL ----------------- */}
      {showLinkModal && (
        <div className="w-full max-w-[400px] mb-4 p-3 rounded-2xl bg-[#FFFFFF] border border-[#E4DFD5] shadow-xl flex items-center gap-2">
          <input
            type="url"
            placeholder="https://example.com"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setLink()}
            className="flex-1 px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#E4DFD5] rounded-xl outline-none focus:border-[#111110]"
            autoFocus
          />
          <button
            type="button"
            onClick={setLink}
            className="px-3 py-1.5 text-xs font-semibold bg-[#111110] text-[#FAF8F5] rounded-xl hover:bg-[#262422]"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setShowLinkModal(false)}
            className="px-2 py-1 text-xs text-[#8C867A] hover:text-[#111110]"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ----------------- EDITORIAL A4 WRITING SHEET ----------------- */}
      <div className="dragen-document-pages w-full">
        <div className="dragen-page relative">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* ----------------- STATUS & WORD COUNT FOOTER ----------------- */}
      <div className="w-full max-w-[794px] mt-4 py-2 px-4 flex items-center justify-between text-xs font-mono text-[#8C867A] border-t border-[#EAE6DF]">
        <div className="flex items-center gap-4">
          <span>{wordCount} words</span>
          <span>{charCount} characters</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#10b981]" />
          <span>Editor Ready</span>
        </div>
      </div>
    </div>
  );
}

export default TiptapEditor;