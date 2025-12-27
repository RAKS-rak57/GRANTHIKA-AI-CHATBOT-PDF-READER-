import { Upload, X, FileText } from 'lucide-react';
import { useState } from 'react';

interface PDFUploadProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export default function PDFUpload({ onFileSelect, disabled = false }: PDFUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      setSelectedFile(file);
      onFileSelect(file);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      onFileSelect(file);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
  };

  if (selectedFile) {
    return (
      <div className="backdrop-blur-xl bg-purple-600/20 border border-purple-400/50 rounded-2xl p-4 flex items-center gap-3 hover:bg-purple-600/30 transition-all animate-slideUp">
        <div className="flex-shrink-0 w-10 h-10 bg-purple-600/40 rounded-lg flex items-center justify-center">
          <FileText size={20} className="text-purple-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-purple-200">{selectedFile.name}</p>
          <p className="text-xs text-purple-300/70">
            {(selectedFile.size / 1024).toFixed(2)} KB
          </p>
        </div>
        <button
          onClick={handleClear}
          className="flex-shrink-0 text-purple-300/70 hover:text-purple-200 transition-all"
        >
          <X size={18} />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={`rounded-2xl p-8 transition-all text-center cursor-pointer backdrop-blur-xl
  bg-white/10 border border-white/20
  shadow-xl shadow-black/30
  ${
        dragActive
          ? 'bg-white/20 border-purple-300/60 shadow-purple-500/30'
          : 'hover:bg-white/15 hover:border-purple-400/40'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <input
        type="file"
        onChange={handleChange}
        disabled={disabled}
        className="hidden"
        id="pdf-input"
      />
      <label htmlFor="pdf-input" className="cursor-pointer">
        <Upload
          size={40}
          className={`mx-auto mb-3 transition-all ${
            dragActive ? 'text-purple-300 scale-110' : 'text-purple-300/70'
          }`}
        />
        <p className="text-sm font-semibold text-purple-200">
          {dragActive ? 'Drop your files here' : 'Upload files to analyze'}
        </p>
        <p className="text-xs text-purple-300/60 mt-2">
          Drag and drop or click to select (PDFs, images, documents)
        </p>
      </label>
    </div>
  );
}
