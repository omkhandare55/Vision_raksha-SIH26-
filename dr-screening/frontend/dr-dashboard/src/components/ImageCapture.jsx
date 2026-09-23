// src/components/ImageCapture.jsx
// Dedicated Fundus Camera Image Importer & Clinical Sample Selector
// Replaces generic webcam with medical-grade fundus import workflow

import { useState, useRef, useCallback } from "react";
import { Upload, X, Eye, FileText, CheckCircle2 } from "lucide-react";

export default function ImageCapture({ onImageReady }) {
  const [preview, setPreview]     = useState(null);
  const [fileName, setFileName]   = useState("");
  const [fileSize, setFileSize]   = useState("");
  const [dragOver, setDragOver]   = useState(false);
  const [error, setError]         = useState(null);

  const fileInputRef = useRef();

  // ── File pick / drag-drop ──────────────────────────────
  const handleFile = useCallback((file) => {
    setError(null);
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/tiff"];
    if (!allowed.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|tif|tiff|dcm)$/i)) {
      setError("Please upload a valid fundus image (JPEG, PNG, WEBP, or TIFF).");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError("File size exceeds 25 MB limit.");
      return;
    }

    const url = URL.createObjectURL(file);
    setPreview(url);
    setFileName(file.name);
    setFileSize((file.size / (1024 * 1024)).toFixed(2) + " MB");
    onImageReady(file);
  }, [onImageReady]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const reset = () => {
    setPreview(null);
    setFileName("");
    setFileSize("");
    setError(null);
    onImageReady(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      {/* ── Guidance Banner ────────────────────────────────── */}
      <div className="bg-[#E8F7F6] border border-[#22AEB0]/15 rounded-xl p-4 text-xs text-[#1F2F42] flex items-start gap-3">
        <Eye size={18} className="text-[#22AEB0] flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-[#1F2F42]">Fundus Camera Input Required</p>
          <p className="text-[#657685] mt-0.5 leading-relaxed font-medium">
            VisionRaksha evaluates <strong className="text-[#263746]">interior retinal fundus photographs</strong> captured via handheld / desktop non-mydriatic fundus cameras (e.g., Remidio, Forus 3nethra, Volk VistaView) or smartphone ophthalmoscope attachments.
          </p>
        </div>
      </div>

      {/* ── Preview Mode ───────────────────────────────────── */}
      {preview ? (
        <div className="space-y-3">
          <div className="relative rounded-2xl overflow-hidden border-2 border-[#22AEB0] bg-[#0a0a0a] p-2.5 text-center shadow-card-hover">
            <img
              src={preview}
              alt="Selected retinal fundus"
              className="max-h-72 mx-auto object-contain rounded-xl shadow-inner"
            />
            <button
              onClick={reset}
              className="absolute top-4 right-4 bg-white/90 hover:bg-rose-50 hover:text-rose-600 text-[#657685] rounded-xl p-2 shadow-md transition cursor-pointer"
              title="Remove image"
            >
              <X size={18} />
            </button>
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center bg-[#1F2F42]/90 backdrop-blur-md text-white px-4 py-2.5 rounded-xl text-xs border border-[#22AEB0]/20">
              <span className="truncate max-w-[200px] font-mono text-[#76D6D2] font-semibold">{fileName}</span>
              <span className="text-[#22AEB0] font-bold">{fileSize}</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-1.5 text-xs text-[#22AEB0] font-bold bg-[#E8F7F6] py-2.5 rounded-xl border border-[#22AEB0]/15">
            <CheckCircle2 size={16} />
            <span>Fundus photo loaded. Review patient vitals and click <strong>Analyse Image</strong> below.</span>
          </div>
        </div>
      ) : (
        /* ── Upload & Dropzone ──────────────────────────────── */
        <div className="space-y-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current.click()}
            className={`
              border-2 border-dashed rounded-2xl p-9 text-center cursor-pointer transition-all duration-200
              ${dragOver
                ? "border-[#22AEB0] bg-[#E8F7F6] scale-[0.99]"
                : "border-[#E1E9EC] hover:border-[#22AEB0] hover:bg-[#F7FAFB] bg-white"}
            `}
          >
            <div className="w-16 h-16 mx-auto mb-3.5 rounded-2xl bg-[#E8F7F6] border border-[#22AEB0]/15 flex items-center justify-center text-[#22AEB0]">
              <Upload size={28} strokeWidth={1.5} />
            </div>
            <p className="font-bold text-[#1F2F42] text-base">
              Import Retinal Fundus Photograph
            </p>
            <p className="text-xs text-[#657685] mt-1.5 max-w-sm mx-auto leading-relaxed font-medium">
              Drag & drop fundus file here, or click to browse from Fundus Camera SD Card, USB storage, or PACS.
            </p>
            <span className="inline-block mt-3 text-[11px] font-mono bg-[#F7FAFB] text-[#657685] font-semibold px-3.5 py-1 rounded-lg border border-[#E1E9EC]">
              Formats: JPEG · PNG · WEBP · TIFF (Max 25MB)
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/tiff"
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5 flex items-start gap-2 font-medium">
          <FileText size={16} className="mt-0.5 flex-shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
