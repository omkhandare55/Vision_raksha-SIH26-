// src/components/ImageCapture.jsx
// Dedicated Fundus Camera Image Importer & Clinical Sample Selector
// Replaces generic webcam with medical-grade fundus import workflow

import { useState, useRef, useCallback } from "react";
import { Upload, X, Eye, FileText, CheckCircle2 } from "lucide-react";

export default function ImageCapture({ onImageReady, disabled }) {
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
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 flex items-start gap-2.5">
        <Eye size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-blue-900">Fundus Camera Input Required</p>
          <p className="text-blue-700 mt-0.5">
            RetinAI evaluates <strong>interior retinal fundus photographs</strong> captured via handheld / desktop non-mydriatic fundus cameras (e.g., Remidio, Forus 3nethra, Volk VistaView) or smartphone ophthalmoscope attachments.
          </p>
        </div>
      </div>

      {/* ── Preview Mode ───────────────────────────────────── */}
      {preview ? (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden border-2 border-blue-400 bg-gray-950 p-2 text-center">
            <img
              src={preview}
              alt="Selected retinal fundus"
              className="max-h-72 mx-auto object-contain rounded-lg shadow-inner"
            />
            <button
              onClick={reset}
              className="absolute top-4 right-4 bg-white/90 hover:bg-red-50 hover:text-red-600 text-gray-700 rounded-full p-2 shadow-md transition"
              title="Remove image"
            >
              <X size={18} />
            </button>
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center bg-black/75 backdrop-blur-sm text-white px-3 py-1.5 rounded-md text-xs">
              <span className="truncate max-w-[200px] font-mono">{fileName}</span>
              <span className="text-blue-300 font-semibold">{fileSize}</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-600 font-medium">
            <CheckCircle2 size={15} />
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
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition
              ${dragOver
                ? "border-blue-600 bg-blue-50/80 scale-[0.99]"
                : "border-gray-300 hover:border-blue-400 hover:bg-blue-50/30"}
            `}
          >
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <Upload size={26} />
            </div>
            <p className="font-semibold text-gray-800 text-base">
              Import Retinal Fundus Photograph
            </p>
            <p className="text-xs text-gray-500 mt-1.5 max-w-sm mx-auto">
              Drag & drop fundus file here, or click to browse from Fundus Camera SD Card, USB storage, or PACS.
            </p>
            <span className="inline-block mt-3 text-[11px] font-mono bg-gray-100 text-gray-600 px-2.5 py-1 rounded">
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
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 flex items-start gap-2">
          <FileText size={16} className="mt-0.5 flex-shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
