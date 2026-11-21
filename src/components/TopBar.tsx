import { Loader2, Play } from 'lucide-react';

export type WorkspaceSection = 'input' | 'inspection' | 'improvements' | 'report';

interface TopBarProps {
  activeSection: WorkspaceSection;
  onSelectSection: (section: WorkspaceSection) => void;
  onRunReview: () => void;
  isReviewing: boolean;
  canRunAi: boolean;
  hasReviewResult: boolean;
}

const NAV_ITEMS: ReadonlyArray<{ id: WorkspaceSection; label: string }> = [
  { id: 'input', label: '문항·기준 입력' },
  { id: 'inspection', label: 'AI 설계 점검' },
  { id: 'improvements', label: '개선안 검토' },
  { id: 'report', label: '인쇄 보고서' },
];

export function TopBar({
  activeSection,
  onSelectSection,
  onRunReview,
  isReviewing,
  canRunAi,
  hasReviewResult,
}: TopBarProps) {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-6 py-3.5">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onSelectSection('input');
          }}
          className="font-display text-base font-bold tracking-tight text-[#0F172A] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1E3A5F]"
        >
          AI 수행평가 설계 점검 도우미
        </a>

        {/* Zone 2: 4 single-line navigation links */}
        <nav
          aria-label="작업 영역 이동"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSection(item.id)}
                className={`relative py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1E3A5F] ${
                  isActive
                    ? 'text-[#1E3A5F] font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
                {item.id === 'inspection' && hasReviewResult ? (
                  <span className="ml-1 text-xs font-normal text-slate-400">· 완료</span>
                ) : null}
                {isActive ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[15px] h-[2px] bg-[#1E3A5F]"
                  />
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary CTA */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onRunReview}
            disabled={isReviewing || !canRunAi}
            title={
              !canRunAi
                ? '수행평가명, 문항 안내문, 채점 기준을 입력하면 실행할 수 있습니다'
                : '입력한 문항과 채점 기준을 AI로 점검합니다'
            }
            className="inline-flex items-center gap-2 rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#162C49] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A5F]"
          >
            {isReviewing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>점검 실행 중...</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                <span>AI 점검 실행</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Compact mobile/tablet section switcher */}
      <div className="flex md:hidden items-center gap-2 overflow-x-auto border-t border-slate-100 px-4 py-2 text-xs font-medium">
        {NAV_ITEMS.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              className={`rounded-md px-2.5 py-1.5 whitespace-nowrap shrink-0 transition-colors ${
                isActive
                  ? 'bg-[#1E3A5F] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
}
