import { useRef, type ChangeEvent } from 'react';
import { Download, FileText, Printer, RotateCcw, Upload } from 'lucide-react';

interface WorkspaceToolbarProps {
  lastSavedAt: string | null;
  onLoadSample: () => void;
  onExportJson: () => void;
  onImportJsonFile: (file: File) => void;
  onPrint: () => void;
  onRequestReset: () => void;
  isReviewing: boolean;
}

function formatSavedTime(iso: string | null): string {
  if (!iso) return '자동 저장 대기';
  try {
    const date = new Date(iso);
    return `브라우저 자동 저장됨 (${date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    })})`;
  } catch {
    return '브라우저 자동 저장됨';
  }
}

export function WorkspaceToolbar({
  lastSavedAt,
  onLoadSample,
  onExportJson,
  onImportJsonFile,
  onPrint,
  onRequestReset,
  isReviewing,
}: WorkspaceToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImportJsonFile(file);
    }
    event.target.value = '';
  };

  return (
    <section className="no-print border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-[1440px] px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1.5">
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              AI 수행평가 설계 점검 도우미
            </h1>
            <p className="text-sm text-slate-600">
              평가의 기준은 명확하게, 피드백의 방향은 구체적으로
            </p>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-1 text-xs text-slate-500">
              <span>{formatSavedTime(lastSavedAt)}</span>
              <span aria-hidden="true">·</span>
              <span>AI 점검은 버튼 클릭 시 1회만 실행</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-600">
                현재 1차 테스트 버전은 서버의 개발자 테스트 키를 사용하므로 불특정 다수에게 공개 배포하지 마세요
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onLoadSample}
              disabled={isReviewing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              <span>예시 문항 불러오기</span>
            </button>

            <button
              type="button"
              onClick={onExportJson}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              <span>JSON 내보내기</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="sr-only"
              aria-label="JSON 프로젝트 파일 불러오기"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isReviewing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              <span>JSON 불러오기</span>
            </button>

            <button
              type="button"
              onClick={onPrint}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              <span>인쇄 / PDF 저장</span>
            </button>

            <button
              type="button"
              onClick={onRequestReset}
              disabled={isReviewing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-rose-700 transition-colors hover:border-rose-200 hover:bg-rose-50 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>새 평가 시작</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
