import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileText, X } from 'lucide-react';

const formatBytes = (bytes) => {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

export default function UploadZone({ file, onFileChange }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    // Formats the local parser can actually read (see services/documentParser.js).
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
    },
    multiple: false,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles[0]) onFileChange(acceptedFiles[0]);
    },
  });

  if (file) {
    return (
      <div className="card p-5 flex items-center gap-4 animate-fade-in-up">
        <div className="h-12 w-12 rounded-xl bg-brand-50 grid place-items-center">
          <FileText className="h-6 w-6 text-brand-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">
            {file.name}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {formatBytes(file.size)} · ready to analyze
          </p>
        </div>
        <button
          type="button"
          onClick={() => onFileChange(null)}
          className="btn-ghost !px-2.5"
          aria-label="Remove file"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={[
        'card p-10 cursor-pointer transition-all border-dashed',
        isDragActive
          ? 'border-brand-400 bg-brand-50/40 ring-2 ring-brand-200'
          : 'hover:border-slate-300 hover:bg-slate-50/60',
      ].join(' ')}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center text-center">
        <div className="h-14 w-14 rounded-2xl bg-brand-50 grid place-items-center mb-4">
          <UploadCloud className="h-7 w-7 text-brand-600" />
        </div>
        <p className="text-sm font-medium text-slate-900">
          {isDragActive ? 'Drop the file here' : 'Drag & drop a document'}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          or <span className="text-brand-600 font-medium">browse</span> ·
          PDF, DOCX, TXT, MD (max 20 MB)
        </p>
      </div>
    </div>
  );
}
