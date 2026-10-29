import React, { useState } from 'react';
import { AlertCircle, FileText, Loader2, ScanLine, Trash2, UploadCloud } from 'lucide-react';
import { ApiError, apiClient } from '../../lib/apiClient';

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_FILES = 50;

export const ScanReview: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<Awaited<ReturnType<typeof apiClient.ocr.extractPreview>> | null>(
    null
  );
  const [waitBeforeEachImage, setWaitBeforeEachImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const addFiles = (selected: FileList | File[]) => {
    const additions: File[] = [];
    const errors: string[] = [];
    const existing = new Set(files.map((file) => `${file.name}-${file.size}-${file.lastModified}`));

    for (const file of Array.from(selected)) {
      if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) {
        errors.push(`${file.name}: use PDF, JPG, JPEG, or PNG.`);
      } else if (file.size === 0 || file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: file must be no larger than 15 MB.`);
      } else if (existing.has(`${file.name}-${file.size}-${file.lastModified}`)) {
        errors.push(`${file.name}: already selected.`);
      } else if (files.length + additions.length >= MAX_FILES) {
        errors.push(`You can select up to ${MAX_FILES} files.`);
        break;
      } else {
        additions.push(file);
        existing.add(`${file.name}-${file.size}-${file.lastModified}`);
      }
    }

    if (additions.length) {
      setFiles((current) => [...current, ...additions]);
      setResults(null);
    }
    setError(errors.join(' '));
  };

  const processFiles = async () => {
    if (!files.length) {
      setError('Select at least one image or PDF first.');
      return;
    }

    setIsProcessing(true);
    setError('');
    setResults(null);
    try {
      setResults(await apiClient.ocr.extractPreview(files, waitBeforeEachImage));
    } catch (requestError) {
      setError(
        requestError instanceof ApiError
          ? requestError.message
          : 'OCR request failed. Check that the backend is running.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const clearFiles = () => {
    setFiles([]);
    setResults(null);
    setError('');
  };

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-surface-border bg-white p-5 shadow-subtle">
        <div className="flex items-center gap-2">
          <ScanLine className="h-5 w-5 text-teal-600" />
          <h1 className="text-xl font-bold tracking-tight text-navy-900">OCR Extraction Preview</h1>
          <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700">
            Qwen2.5-VL
          </span>
        </div>
        <p className="mt-2 text-sm text-content-secondary">
          The FastAPI backend runs Qwen on its CUDA GPU. This developer preview extracts text only;
          it does not grade or publish marks.
        </p>
      </header>

      <section className="rounded-2xl border border-surface-border bg-white p-5 shadow-subtle">
        <label
          htmlFor="ocr-file-input"
          onDragOver={(event) => {
            event.preventDefault();
            if (!isProcessing) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            if (!isProcessing) addFiles(event.dataTransfer.files);
          }}
          className={`block w-full rounded-xl border-2 border-dashed p-8 text-center transition-colors focus-within:ring-2 focus-within:ring-teal-500 ${
            isDragging
              ? 'border-teal-500 bg-teal-50'
              : 'border-surface-border bg-surface-bg/40'
          } ${isProcessing ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-teal-500/60'}`}
        >
          <input
            id="ocr-file-input"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            multiple
            disabled={isProcessing}
            className="sr-only"
            onChange={(event) => {
              if (event.target.files?.length) addFiles(event.target.files);
              event.target.value = '';
            }}
          />
          <UploadCloud className="mx-auto mb-2 h-9 w-9 text-teal-600" />
          <p className="font-semibold text-navy-900">
            Drop one or more answer sheets here, or click to browse
          </p>
          <p className="mt-1 text-xs text-content-secondary">
            PDF, JPG, JPEG, or PNG · up to 15 MB each · maximum {MAX_FILES} files
          </p>
        </label>

        <label className="mt-4 flex w-fit cursor-pointer items-center gap-2 text-sm text-navy-900">
          <input
            type="checkbox"
            checked={waitBeforeEachImage}
            disabled={isProcessing}
            onChange={(event) => setWaitBeforeEachImage(event.target.checked)}
            className="rounded border-surface-border text-teal-600 focus:ring-teal-500"
          />
          Wait 5 seconds before processing each image/page
        </label>

        {files.length > 0 && (
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-navy-900">Selected files ({files.length})</h2>
              <button
                type="button"
                onClick={clearFiles}
                disabled={isProcessing}
                className="text-xs font-semibold text-content-secondary hover:text-rose-600 disabled:opacity-50"
              >
                Clear all
              </button>
            </div>
            <ul className="max-h-56 space-y-2 overflow-y-auto">
              {files.map((file) => (
                <li
                  key={`${file.name}-${file.size}-${file.lastModified}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-surface-border px-3 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2 text-sm text-navy-900">
                    <FileText className="h-4 w-4 shrink-0 text-teal-600" />
                    <span className="truncate">{file.name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFiles((current) => current.filter((item) => item !== file));
                      setResults(null);
                    }}
                    disabled={isProcessing}
                    className="rounded p-1 text-content-muted hover:text-rose-600 disabled:opacity-50"
                    aria-label={`Remove ${file.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-800"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={processFiles}
          disabled={isProcessing || files.length === 0}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
          {isProcessing ? 'Extracting text…' : 'Run OCR'}
        </button>
      </section>

      <section className="space-y-3" aria-live="polite">
        <div>
          <h2 className="text-lg font-bold text-navy-900">Extracted text</h2>
          <p className="text-xs text-content-secondary">
            {results
              ? `${results.modelVersion} · ${results.results.length} file(s) processed`
              : 'OCR results will appear here for verification.'}
          </p>
        </div>
        {results ? (
          results.results.map((result) => (
            <div
              key={result.fileName}
              className="rounded-xl border border-surface-border bg-white p-4 shadow-subtle"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="truncate text-sm font-semibold text-navy-900">{result.fileName}</h3>
                <span className="shrink-0 text-xs text-content-secondary">
                  {result.pagesProcessed} page(s)
                </span>
              </div>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-bg p-3 text-sm text-navy-900">
                {result.extractedText || '[No text extracted]'}
              </pre>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-surface-border bg-white p-4 text-sm text-content-secondary shadow-subtle">
            {isProcessing ? 'Waiting for OCR extraction…' : 'Extracted text will be shown in this panel.'}
          </div>
        )}
      </section>
    </div>
  );
};
