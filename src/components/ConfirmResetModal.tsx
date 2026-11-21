import { AlertTriangle, Download, X } from 'lucide-react';

interface ConfirmResetModalProps {
  open: boolean;
  onCancel: () => void;
  onExportFirst: () => void;
  onConfirmReset: () => void;
}

export function ConfirmResetModal({
  open,
  onCancel,
  onExportFirst,
  onConfirmReset,
}: ConfirmResetModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-dialog-title"
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" aria-hidden="true" />
            <h2 id="reset-dialog-title" className="text-base font-bold text-slate-900">
              새 평가 시작 (초기화 확인)
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="닫기"
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          현재 입력 중인 수행평가 문항, 세부 채점 기준, 그리고 브라우저에 저장된 AI 점검 결과가 모두 초기화됩니다. 필요한 경우 먼저 JSON 파일로 저장해 두시기 바랍니다.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onExportFirst}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            <span>먼저 JSON 저장</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap cursor-pointer"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onConfirmReset}
              className="rounded-lg bg-rose-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-800 whitespace-nowrap cursor-pointer"
            >
              초기화하고 새로 시작
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
