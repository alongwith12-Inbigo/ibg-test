import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
} from 'react';
import {
  AlertCircle,
  Check,
  CheckSquare,
  ClipboardPaste,
  FileText,
  Image as ImageIcon,
  Loader2,
  Square,
  Upload,
  X,
} from 'lucide-react';
import type {
  CriteriaExtractionRequest,
  ExtractedCriteriaResult,
  ExtractedCriterionDraft,
} from '../types/assessment.ts';

interface CriteriaImportBoxProps {
  externalPastedFile: File | null;
  onConsumeExternalPastedFile: () => void;
  onApplyExtractedCriteria: (
    items: ExtractedCriterionDraft[],
    mode: 'append' | 'replace',
  ) => void;
  disabled?: boolean;
}

interface AttachedSource {
  fileName: string;
  sizeBytes: number;
  previewUrl: string | null;
  payload: CriteriaExtractionRequest;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const TEXT_EXTENSIONS = ['.txt', '.csv', '.tsv', '.md'];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('파일을 읽을 수 없습니다.'));
    reader.readAsDataURL(file);
  });
}

function inferTextMime(fileName: string, mime: string): string | null {
  const lowerName = fileName.toLowerCase();
  if (mime === 'text/csv' || lowerName.endsWith('.csv')) return 'text/csv';
  if (mime === 'text/tab-separated-values' || lowerName.endsWith('.tsv')) {
    return 'text/tab-separated-values';
  }
  if (mime === 'text/markdown' || lowerName.endsWith('.md')) return 'text/markdown';
  if (mime === 'text/plain' || TEXT_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
    return 'text/plain';
  }
  return null;
}

export function CriteriaImportBox({
  externalPastedFile,
  onConsumeExternalPastedFile,
  onApplyExtractedCriteria,
  disabled = false,
}: CriteriaImportBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [attached, setAttached] = useState<AttachedSource | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedCriteriaResult | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inFlightRef = useRef(false);

  const revokePreview = (url: string | null) => {
    if (url) URL.revokeObjectURL(url);
  };

  useEffect(() => {
    return () => {
      if (attached?.previewUrl) URL.revokeObjectURL(attached.previewUrl);
    };
  }, [attached]);

  const prepareFile = async (file: File, fromPaste = false) => {
    setErrorMsg(null);
    setExtracted(null);
    setSelectedIndices([]);

    if (file.size > MAX_FILE_BYTES) {
      setErrorMsg('파일 크기가 10MB를 초과합니다. 10MB 이하의 이미지나 PDF를 사용해 주세요.');
      return;
    }

    const lowerName = file.name.toLowerCase();
    if (
      lowerName.endsWith('.hwp') ||
      lowerName.endsWith('.hwpx') ||
      lowerName.endsWith('.doc') ||
      lowerName.endsWith('.docx')
    ) {
      setErrorMsg(
        'HWP·Word 문서는 채점 기준표 영역을 화면 캡처해 Ctrl+V로 붙여넣거나, PDF·이미지로 저장해 첨부하시면 정확히 인식할 수 있습니다.',
      );
      return;
    }

    const mime = file.type.toLowerCase();

    if (IMAGE_MIMES.has(mime)) {
      try {
        const base64Data = await readFileAsBase64(file);
        const previewUrl = URL.createObjectURL(file);
        revokePreview(attached?.previewUrl ?? null);
        setAttached({
          fileName: fromPaste ? '클립보드 붙여넣기 이미지' : file.name || '이미지 파일',
          sizeBytes: file.size,
          previewUrl,
          payload: {
            kind: 'file',
            mimeType: mime,
            fileName: file.name || 'clipboard-image.png',
            base64Data,
          },
        });
        setIsOpen(true);
      } catch {
        setErrorMsg('이미지를 읽는 중 오류가 발생했습니다.');
      }
      return;
    }

    if (mime === 'application/pdf' || lowerName.endsWith('.pdf')) {
      try {
        const base64Data = await readFileAsBase64(file);
        revokePreview(attached?.previewUrl ?? null);
        setAttached({
          fileName: file.name || '채점기준.pdf',
          sizeBytes: file.size,
          previewUrl: null,
          payload: {
            kind: 'file',
            mimeType: 'application/pdf',
            fileName: file.name || 'rubric.pdf',
            base64Data,
          },
        });
        setIsOpen(true);
      } catch {
        setErrorMsg('PDF 파일을 읽는 중 오류가 발생했습니다.');
      }
      return;
    }

    const textMime = inferTextMime(file.name, mime);
    if (textMime) {
      try {
        const textContent = (await file.text()).trim();
        if (!textContent) {
          setErrorMsg('선택한 텍스트 파일의 내용이 비어 있습니다.');
          return;
        }
        revokePreview(attached?.previewUrl ?? null);
        setAttached({
          fileName: file.name || '채점기준.txt',
          sizeBytes: file.size,
          previewUrl: null,
          payload: {
            kind: 'text',
            mimeType: textMime,
            fileName: file.name,
            textContent,
          },
        });
        setIsOpen(true);
      } catch {
        setErrorMsg('텍스트 파일을 읽는 중 오류가 발생했습니다.');
      }
      return;
    }

    setErrorMsg(
      '지원하지 않는 파일 형식입니다. 이미지(PNG, JPG, WEBP), PDF, 또는 텍스트(TXT, CSV, MD) 파일을 첨부해 주세요.',
    );
  };

  useEffect(() => {
    if (externalPastedFile) {
      void prepareFile(externalPastedFile, true);
      onConsumeExternalPastedFile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalPastedFile]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void prepareFile(file, false);
    }
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (disabled || extracting) return;
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void prepareFile(file, false);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    if (disabled || extracting) return;
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          event.preventDefault();
          void prepareFile(file, true);
          return;
        }
      }
    }

    const plainText = event.clipboardData?.getData('text/plain')?.trim();
    if (plainText) {
      event.preventDefault();
      revokePreview(attached?.previewUrl ?? null);
      setErrorMsg(null);
      setExtracted(null);
      setAttached({
        fileName: '붙여넣은 텍스트 기준표',
        sizeBytes: new Blob([plainText]).size,
        previewUrl: null,
        payload: {
          kind: 'text',
          mimeType: 'text/plain',
          fileName: 'pasted-rubric.txt',
          textContent: plainText,
        },
      });
    }
  };

  const handleExtract = async () => {
    if (!attached || inFlightRef.current || extracting || disabled) return;

    inFlightRef.current = true;
    setExtracting(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/extract-criteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attached.payload),
      });

      const data = (await response.json().catch(() => null)) as {
        extracted?: ExtractedCriteriaResult;
        error?: string;
      } | null;

      if (!response.ok || !data?.extracted) {
        setErrorMsg(
          data?.error ??
            '자료에서 채점 기준을 추출하지 못했습니다. 다른 이미지나 파일로 다시 시도해 주세요.',
        );
        return;
      }

      if (data.extracted.criteria.length === 0) {
        setErrorMsg(
          data.extracted.notes ||
            '첨부된 자료에서 평가 요소와 채점 기준표를 찾지 못했습니다. 표 영역이 선명하게 보이도록 다시 캡처해 주세요.',
        );
        return;
      }

      setExtracted(data.extracted);
      setSelectedIndices(data.extracted.criteria.map((_, idx) => idx));
    } catch {
      setErrorMsg('서버 연결 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      inFlightRef.current = false;
      setExtracting(false);
    }
  };

  const toggleSelectIndex = (idx: number) => {
    setSelectedIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx],
    );
  };

  const clearAttachment = () => {
    revokePreview(attached?.previewUrl ?? null);
    setAttached(null);
    setExtracted(null);
    setSelectedIndices([]);
    setErrorMsg(null);
  };

  const handleApply = (mode: 'append' | 'replace') => {
    if (!extracted) return;
    const chosen = extracted.criteria.filter((_, idx) => selectedIndices.includes(idx));
    if (chosen.length === 0) return;
    onApplyExtractedCriteria(chosen, mode);
    clearAttachment();
    setIsOpen(false);
  };

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-xs text-slate-700">
          <ClipboardPaste className="h-3.5 w-3.5 text-[#1E3A5F] shrink-0" aria-hidden="true" />
          <span className="font-medium text-slate-800">
            파일 첨부 · 이미지 붙여넣기(Ctrl+V)로 평가 요소 등록
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="text-xs font-semibold text-[#1E3A5F] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
        >
          {isOpen ? '접기' : '열기'}
        </button>
      </div>

      {isOpen ? (
        <div className="space-y-3 border-t border-slate-200 bg-white p-3.5">
          {/* Drop & Paste Zone */}
          <div
            tabIndex={0}
            role="region"
            aria-label="채점 기준표 파일 첨부 및 이미지 붙여넣기 영역"
            onPaste={handlePaste}
            onDragOver={(e) => {
              e.preventDefault();
              if (!disabled && !extracting) setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`rounded-lg border border-dashed p-4 text-center transition-colors focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/15 ${
              isDragging
                ? 'border-[#1E3A5F] bg-slate-50'
                : 'border-slate-300 bg-slate-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,.pdf,.txt,.csv,.tsv,.md"
              onChange={handleFileChange}
              className="sr-only"
              aria-label="채점 기준표 파일 선택"
            />

            <p className="text-xs font-medium text-slate-800">
              이 영역을 클릭한 뒤 <span className="font-semibold text-[#1E3A5F]">Ctrl+V(⌘V)</span>로 캡처한 기준표 이미지를 붙여넣거나 파일을 끌어다 놓으세요
            </p>
            <p className="mt-1 text-xs text-slate-500">
              지원 형식: 이미지(PNG, JPG, WEBP) · PDF · 텍스트(TXT, CSV, MD) · 최대 10MB
            </p>

            <div className="mt-3 flex justify-center">
              <button
                type="button"
                disabled={disabled || extracting}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                <span>파일 찾아보기</span>
              </button>
            </div>
          </div>

          {/* Attached Source Preview & Explicit Trigger */}
          {attached ? (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  {attached.previewUrl ? (
                    <img
                      src={attached.previewUrl}
                      alt={attached.fileName}
                      className="h-12 w-16 rounded border border-slate-200 bg-white object-cover shrink-0"
                    />
                  ) : attached.payload.kind === 'file' ? (
                    <div className="flex h-10 w-10 items-center justify-center rounded border border-slate-200 bg-white shrink-0">
                      <ImageIcon className="h-4 w-4 text-slate-500" aria-hidden="true" />
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded border border-slate-200 bg-white shrink-0">
                      <FileText className="h-4 w-4 text-slate-500" aria-hidden="true" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-slate-900">
                      {attached.fileName}
                    </div>
                    <div className="tabular-nums text-xs text-slate-500">
                      {formatFileSize(attached.sizeBytes)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={clearAttachment}
                    disabled={extracting}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>취소</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExtract}
                    disabled={disabled || extracting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E3A5F] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#162C49] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 whitespace-nowrap cursor-pointer"
                  >
                    {extracting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        <span>기준 추출 중...</span>
                      </>
                    ) : (
                      <span>첨부 자료에서 기준 추출</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Extraction Error */}
          {errorMsg ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-900"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 text-rose-700 shrink-0" aria-hidden="true" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          ) : null}

          {/* Extracted Criteria Preview before Applying */}
          {extracted ? (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    추출된 평가 요소 ({extracted.criteria.length}개)
                  </h4>
                  <p className="text-xs text-slate-500">
                    등록할 항목을 확인한 뒤 추가 또는 대체 버튼을 눌러 반영하세요.
                  </p>
                </div>
              </div>

              {extracted.notes ? (
                <p className="rounded bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  {extracted.notes}
                </p>
              ) : null}

              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {extracted.criteria.map((item, idx) => {
                  const checked = selectedIndices.includes(idx);
                  return (
                    <div
                      key={idx}
                      className={`rounded-md border p-2.5 text-xs ${
                        checked
                          ? 'border-slate-300 bg-slate-50/70'
                          : 'border-slate-200 bg-white opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => toggleSelectIndex(idx)}
                          className="flex items-center gap-2 text-left font-semibold text-slate-900 cursor-pointer"
                        >
                          {checked ? (
                            <CheckSquare
                              className="h-4 w-4 text-[#1E3A5F] shrink-0"
                              aria-hidden="true"
                            />
                          ) : (
                            <Square
                              className="h-4 w-4 text-slate-400 shrink-0"
                              aria-hidden="true"
                            />
                          )}
                          <span>{item.elementName}</span>
                        </button>
                        <span className="font-mono-tabular font-semibold text-[#1E3A5F] shrink-0">
                          {item.points}점
                        </span>
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap pl-6 leading-relaxed text-slate-700">
                        {item.criteriaDescription}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-2.5">
                <button
                  type="button"
                  disabled={selectedIndices.length === 0}
                  onClick={() => handleApply('append')}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5 text-[#1E3A5F]" aria-hidden="true" />
                  <span>기존 목록에 추가 ({selectedIndices.length})</span>
                </button>
                <button
                  type="button"
                  disabled={selectedIndices.length === 0}
                  onClick={() => handleApply('replace')}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#1E3A5F] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#162C49] disabled:opacity-40 whitespace-nowrap cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>현재 목록 대체 ({selectedIndices.length})</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
