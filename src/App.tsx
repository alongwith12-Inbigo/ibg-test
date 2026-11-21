import { useEffect, useRef, useState } from 'react';
import { Check, AlertCircle } from 'lucide-react';
import { ConfirmResetModal } from './components/ConfirmResetModal.tsx';
import { ImprovementReviewPanel } from './components/ImprovementReviewPanel.tsx';
import { InputEditorPanel } from './components/InputEditorPanel.tsx';
import { InspectionResultsPanel } from './components/InspectionResultsPanel.tsx';
import { PrintableReportView } from './components/PrintableReportView.tsx';
import { TopBar, type WorkspaceSection } from './components/TopBar.tsx';
import { WorkspaceToolbar } from './components/WorkspaceToolbar.tsx';
import type {
  AiReviewResult,
  AssessmentDraft,
  ImprovementProposals,
} from './types/assessment.ts';
import {
  clearWorkspaceLocalStorage,
  createEmptyDraft,
  createSampleDraft,
  downloadProjectJson,
  loadWorkspaceFromLocalStorage,
  parseImportedProjectJson,
  saveWorkspaceToLocalStorage,
} from './utils/storage.ts';
import { validateAssessmentDraft } from './utils/validation.ts';

type RightPaneTab = 'inspection' | 'improvements' | 'report';

export default function App() {
  const [initialState] = useState(() => loadWorkspaceFromLocalStorage());
  const [draft, setDraft] = useState<AssessmentDraft>(
    () => initialState?.draft ?? createEmptyDraft(),
  );
  const [aiResult, setAiResult] = useState<AiReviewResult | null>(
    () => initialState?.aiResult ?? null,
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    () => initialState?.updatedAt ?? null,
  );

  const [activeSection, setActiveSection] = useState<WorkspaceSection>('input');
  const [rightTab, setRightTab] = useState<RightPaneTab>('inspection');

  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [systemMessage, setSystemMessage] = useState<{
    type: 'info' | 'error';
    text: string;
  } | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const inFlightRef = useRef(false);
  const inputSectionRef = useRef<HTMLDivElement | null>(null);
  const rightSectionRef = useRef<HTMLDivElement | null>(null);

  // Auto-save draft and last AI review result to localStorage (never stores API keys)
  useEffect(() => {
    saveWorkspaceToLocalStorage(draft, aiResult);
    setLastSavedAt(new Date().toISOString());
  }, [draft, aiResult]);

  const { canRunAi } = validateAssessmentDraft(draft);

  const showSystemMessage = (type: 'info' | 'error', text: string) => {
    setSystemMessage({ type, text });
    window.setTimeout(() => {
      setSystemMessage((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const handleSelectSection = (section: WorkspaceSection) => {
    setActiveSection(section);
    if (section === 'input') {
      inputSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setRightTab(section);
    rightSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleRunReview = async () => {
    if (inFlightRef.current || isReviewing) return;

    const validation = validateAssessmentDraft(draft);
    if (!validation.canRunAi) {
      const firstBlocking = validation.notices.find((n) => n.level === 'blocking');
      showSystemMessage(
        'error',
        firstBlocking?.message ?? '필수 입력 항목을 먼저 작성해 주세요.',
      );
      handleSelectSection('input');
      return;
    }

    inFlightRef.current = true;
    setIsReviewing(true);
    setReviewError(null);
    setActiveSection('inspection');
    setRightTab('inspection');

    try {
      const response = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });

      const payload = (await response.json().catch(() => null)) as {
        result?: AiReviewResult;
        error?: string;
      } | null;

      if (!response.ok || !payload?.result) {
        const message =
          payload?.error ??
          'AI 점검 결과를 받아오지 못했습니다. 입력 내용은 그대로 유지되었으니 잠시 후 다시 시도해 주세요.';
        setReviewError(message);
        return;
      }

      setAiResult(payload.result);
      showSystemMessage('info', 'AI 수행평가 설계 점검이 완료되었습니다.');
    } catch {
      setReviewError(
        '서버와 통신하는 중 네트워크 오류가 발생했습니다. 입력하신 내용과 이전 점검 결과는 안전하게 유지되었습니다.',
      );
    } finally {
      inFlightRef.current = false;
      setIsReviewing(false);
    }
  };

  const handleLoadSample = () => {
    setDraft(createSampleDraft());
    setReviewError(null);
    showSystemMessage(
      'info',
      '예시 수행평가 문항과 채점 기준을 불러왔습니다. 상단의 ‘AI 점검 실행’ 버튼을 눌러 점검해 보세요.',
    );
  };

  const handleExportJson = () => {
    downloadProjectJson(draft, aiResult);
    showSystemMessage('info', '프로젝트 JSON 파일을 다운로드했습니다.');
  };

  const handleImportJsonFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseImportedProjectJson(text);
      if (parsed.ok === false) {
        showSystemMessage('error', parsed.error);
        return;
      }
      setDraft(parsed.draft);
      setAiResult(parsed.aiResult);
      setReviewError(null);
      if (parsed.aiResult) {
        setRightTab('inspection');
        setActiveSection('inspection');
      }
      showSystemMessage('info', `‘${file.name}’ 프로젝트를 불러왔습니다.`);
    } catch {
      showSystemMessage('error', '선택한 파일을 읽는 중 오류가 발생했습니다.');
    }
  };

  const handleConfirmReset = () => {
    clearWorkspaceLocalStorage();
    setDraft(createEmptyDraft());
    setAiResult(null);
    setReviewError(null);
    setIsResetModalOpen(false);
    setActiveSection('input');
    setRightTab('inspection');
    showSystemMessage('info', '새 평가를 시작할 수 있도록 초기화했습니다.');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleUpdateImprovements = (nextImprovements: ImprovementProposals) => {
    setAiResult((prev) =>
      prev ? { ...prev, improvements: nextImprovements } : prev,
    );
  };

  const handleApplyPromptToDraft = (revisedPrompt: string) => {
    setDraft((prev) => ({ ...prev, promptText: revisedPrompt }));
  };

  const handleApplyCriterionToDraft = (criterionId: string, revisedText: string) => {
    setDraft((prev) => ({
      ...prev,
      criteria: prev.criteria.map((c) =>
        c.id === criterionId ? { ...c, criteriaDescription: revisedText } : c,
      ),
    }));
  };

  const handleApplyAllCriteriaToDraft = (
    updates: Array<{ criterionId: string; revisedText: string }>,
  ) => {
    const updateMap = new Map(updates.map((u) => [u.criterionId, u.revisedText]));
    setDraft((prev) => ({
      ...prev,
      criteria: prev.criteria.map((c) => {
        const nextDesc = updateMap.get(c.id);
        return typeof nextDesc === 'string'
          ? { ...c, criteriaDescription: nextDesc }
          : c;
      }),
    }));
  };

  return (
    <div id="top" className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <TopBar
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
        onRunReview={handleRunReview}
        isReviewing={isReviewing}
        canRunAi={canRunAi}
        hasReviewResult={Boolean(aiResult)}
      />

      <WorkspaceToolbar
        lastSavedAt={lastSavedAt}
        onLoadSample={handleLoadSample}
        onExportJson={handleExportJson}
        onImportJsonFile={handleImportJsonFile}
        onPrint={handlePrint}
        onRequestReset={() => setIsResetModalOpen(true)}
        isReviewing={isReviewing}
      />

      {/* Transient Feedback Banner */}
      {systemMessage ? (
        <div className="no-print mx-auto max-w-[1440px] px-6 pt-4">
          <div
            role={systemMessage.type === 'error' ? 'alert' : 'status'}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-medium ${
              systemMessage.type === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-900'
                : 'border-slate-200 bg-white text-slate-800'
            }`}
          >
            {systemMessage.type === 'error' ? (
              <AlertCircle className="h-4 w-4 text-rose-700 shrink-0" aria-hidden="true" />
            ) : (
              <Check className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />
            )}
            <span>{systemMessage.text}</span>
          </div>
        </div>
      ) : null}

      {/* Main Responsive Workbench */}
      <main className="no-print mx-auto max-w-[1440px] px-6 py-6">
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
          {/* Left Column: Area A (Always visible for comparison & editing) */}
          <div ref={inputSectionRef} className="xl:col-span-5">
            <InputEditorPanel
              draft={draft}
              onChangeDraft={setDraft}
              onRunReview={handleRunReview}
              isReviewing={isReviewing}
            />
          </div>

          {/* Right Column: Area B, Area C, and Print Preview Tabs */}
          <div ref={rightSectionRef} className="space-y-4 xl:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
              <div
                role="tablist"
                aria-label="점검 및 개선 작업 전환"
                className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={rightTab === 'inspection'}
                  onClick={() => {
                    setRightTab('inspection');
                    setActiveSection('inspection');
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    rightTab === 'inspection'
                      ? 'bg-white text-[#1E3A5F] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  영역 B. AI 설계 점검
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={rightTab === 'improvements'}
                  onClick={() => {
                    setRightTab('improvements');
                    setActiveSection('improvements');
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    rightTab === 'improvements'
                      ? 'bg-white text-[#1E3A5F] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  영역 C. 개선안 비교·적용
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={rightTab === 'report'}
                  onClick={() => {
                    setRightTab('report');
                    setActiveSection('report');
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    rightTab === 'report'
                      ? 'bg-white text-[#1E3A5F] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  인쇄용 보고서 미리보기
                </button>
              </div>

              <span className="text-xs text-slate-500">
                {aiResult
                  ? '마지막 점검 결과가 로컬에 저장되어 있습니다'
                  : '점검 실행 시 결과가 표시됩니다'}
              </span>
            </div>

            {rightTab === 'inspection' && (
              <InspectionResultsPanel
                aiResult={aiResult}
                isReviewing={isReviewing}
                reviewError={reviewError}
                onJumpToImprovements={() => {
                  setRightTab('improvements');
                  setActiveSection('improvements');
                }}
              />
            )}

            {rightTab === 'improvements' && (
              <ImprovementReviewPanel
                draft={draft}
                aiResult={aiResult}
                onUpdateImprovements={handleUpdateImprovements}
                onApplyPromptToDraft={handleApplyPromptToDraft}
                onApplyCriterionToDraft={handleApplyCriterionToDraft}
                onApplyAllCriteriaToDraft={handleApplyAllCriteriaToDraft}
                onJumpToInspection={() => {
                  setRightTab('inspection');
                  setActiveSection('inspection');
                }}
              />
            )}

            {rightTab === 'report' && (
              <PrintableReportView
                draft={draft}
                aiResult={aiResult}
                onPrint={handlePrint}
                isScreenPreview
              />
            )}
          </div>
        </div>
      </main>

      <footer className="no-print border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-6 py-4 text-xs text-slate-500">
          <span>AI 수행평가 설계 점검 도우미 · 교사용 로컬 작업 환경</span>
          <span>입력 자료와 점검 결과는 사용자 브라우저에만 저장되며 외부 DB에 보관되지 않습니다.</span>
        </div>
      </footer>

      {/* Dedicated A4 Print View (Rendered only when printing / saving PDF) */}
      <PrintableReportView draft={draft} aiResult={aiResult} onPrint={handlePrint} />

      <ConfirmResetModal
        open={isResetModalOpen}
        onCancel={() => setIsResetModalOpen(false)}
        onExportFirst={() => {
          handleExportJson();
          setIsResetModalOpen(false);
        }}
        onConfirmReset={handleConfirmReset}
      />
    </div>
  );
}
