import { useState } from 'react';
import { Check, CheckSquare, Plus, RotateCcw, Square, Trash2 } from 'lucide-react';
import type {
  AiReviewResult,
  AssessmentDraft,
  ImprovementProposals,
} from '../types/assessment.ts';

interface ImprovementReviewPanelProps {
  draft: AssessmentDraft;
  aiResult: AiReviewResult | null;
  onUpdateImprovements: (next: ImprovementProposals) => void;
  onApplyPromptToDraft: (revisedPrompt: string) => void;
  onApplyCriterionToDraft: (criterionId: string, revisedText: string) => void;
  onApplyAllCriteriaToDraft: (
    updates: Array<{ criterionId: string; revisedText: string }>,
  ) => void;
  onJumpToInspection: () => void;
}

export function ImprovementReviewPanel({
  draft,
  aiResult,
  onUpdateImprovements,
  onApplyPromptToDraft,
  onApplyCriterionToDraft,
  onApplyAllCriteriaToDraft,
  onJumpToInspection,
}: ImprovementReviewPanelProps) {
  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);
  const [newGuideline, setNewGuideline] = useState('');

  if (!aiResult) {
    return (
      <section
        aria-labelledby="area-c-heading"
        className="rounded-xl border border-slate-200 bg-white"
      >
        <div className="border-b border-slate-200 px-6 py-4">
          <span className="text-xs font-medium text-slate-500">영역 C</span>
          <h2 id="area-c-heading" className="text-lg font-bold text-slate-900">
            개선안 작성 및 교사 검토
          </h2>
        </div>
        <div className="p-6">
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-5">
            <h3 className="text-sm font-bold text-slate-900">
              AI 점검을 실행하면 개선 초안과 비교 화면이 표시됩니다
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              점검 완료 후 이곳에서 원본 문항과 개선안을 나란히 비교하고, 직접 수정한 뒤 필요한 내용만 선택해 원본에 반영할 수 있습니다.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const { improvements } = aiResult;

  const showTempNotice = (message: string) => {
    setAppliedNotice(message);
    window.setTimeout(() => {
      setAppliedNotice((prev) => (prev === message ? null : prev));
    }, 3500);
  };

  const handlePromptEdit = (value: string) => {
    onUpdateImprovements({
      ...improvements,
      revisedPrompt: value,
    });
  };

  const handleCriterionProposalEdit = (criterionId: string, text: string) => {
    onUpdateImprovements({
      ...improvements,
      revisedCriteria: improvements.revisedCriteria.map((item) =>
        item.criterionId === criterionId ? { ...item, revisedCriteriaText: text } : item,
      ),
    });
  };

  const handleGuidelineEdit = (index: number, value: string) => {
    const next = [...improvements.partialScoreGuidelines];
    next[index] = value;
    onUpdateImprovements({ ...improvements, partialScoreGuidelines: next });
  };

  const handleAddGuideline = () => {
    const trimmed = newGuideline.trim();
    if (!trimmed) return;
    onUpdateImprovements({
      ...improvements,
      partialScoreGuidelines: [...improvements.partialScoreGuidelines, trimmed],
    });
    setNewGuideline('');
  };

  const handleRemoveGuideline = (index: number) => {
    onUpdateImprovements({
      ...improvements,
      partialScoreGuidelines: improvements.partialScoreGuidelines.filter((_, i) => i !== index),
    });
  };

  const handleDecisionToggle = (id: string) => {
    onUpdateImprovements({
      ...improvements,
      teacherDecisions: improvements.teacherDecisions.map((item) =>
        item.id === id ? { ...item, resolved: !item.resolved } : item,
      ),
    });
  };

  const handleDecisionMemo = (id: string, memo: string) => {
    onUpdateImprovements({
      ...improvements,
      teacherDecisions: improvements.teacherDecisions.map((item) =>
        item.id === id ? { ...item, teacherMemo: memo } : item,
      ),
    });
  };

  const isPromptSynced = draft.promptText.trim() === improvements.revisedPrompt.trim();

  return (
    <section
      aria-labelledby="area-c-heading"
      className="rounded-xl border border-slate-200 bg-white"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
        <div>
          <span className="text-xs font-medium text-slate-500">영역 C</span>
          <h2 id="area-c-heading" className="text-lg font-bold text-slate-900">
            개선안 작성 및 교사 검토
          </h2>
        </div>

        <button
          type="button"
          onClick={onJumpToInspection}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
        >
          점검 결과 다시 보기
        </button>
      </div>

      <div className="space-y-7 p-6">
        {/* Principle Banner */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-700">
          <span className="font-semibold text-slate-900">교사 최종 결정 원칙:</span> AI가 제안한 문구와 기준은 참고 초안이며 원본을 자동으로 덮어쓰지 않습니다. 아래에서 내용을 직접 다듬은 뒤 원하는 항목만 선택적으로 원본에 적용하세요. 배점과 평가 요소명은 임의로 변경되지 않습니다.
        </div>

        {appliedNotice ? (
          <div
            role="status"
            className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-900"
          >
            <Check className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />
            <span>{appliedNotice}</span>
          </div>
        ) : null}

        {/* 1. Revised Prompt Comparison */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                1. 수정된 수행평가 문항 비교 및 편집
              </h3>
              <p className="text-xs text-slate-500">
                왼쪽 원본과 비교하며 오른쪽 개선안을 수정한 뒤 필요 시 원본에 반영하세요.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePromptEdit(draft.promptText)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>원본 문구 복사</span>
              </button>
              <button
                type="button"
                disabled={isPromptSynced}
                onClick={() => {
                  onApplyPromptToDraft(improvements.revisedPrompt);
                  showTempNotice('수정한 개선안 문항을 원본 문항(영역 A)에 적용했습니다.');
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E3A5F] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#162C49] disabled:cursor-default disabled:bg-slate-200 disabled:text-slate-600 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{isPromptSynced ? '원본과 동일함' : '원본 문항에 적용'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
              <div className="mb-2 text-xs font-semibold text-slate-600">
                현재 원본 문항 (영역 A)
              </div>
              <div className="min-h-[180px] whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {draft.promptText || '(원본 문항 없음)'}
              </div>
            </div>

            <div className="rounded-lg border border-slate-300 bg-white p-3.5">
              <label
                htmlFor="revised-prompt-editor"
                className="mb-2 block text-xs font-semibold text-[#1E3A5F]"
              >
                개선안 문항 (직접 편집 가능)
              </label>
              <textarea
                id="revised-prompt-editor"
                rows={8}
                value={improvements.revisedPrompt}
                onChange={(e) => handlePromptEdit(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/15"
              />
            </div>
          </div>
        </div>

        {/* 2. Revised Criteria Comparison */}
        <div className="space-y-4 border-t border-slate-200 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                2. 보완된 채점 기준 비교 및 배점 검토 의견
              </h3>
              <p className="text-xs text-slate-500">
                각 평가 요소의 기존 배점을 유지한 채 세부 채점 기준 문구만 보완했습니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onApplyAllCriteriaToDraft(
                  improvements.revisedCriteria.map((c) => ({
                    criterionId: c.criterionId,
                    revisedText: c.revisedCriteriaText,
                  })),
                );
                showTempNotice('모든 보완된 채점 기준을 원본(영역 A)에 일괄 적용했습니다.');
              }}
              className="rounded-lg border border-[#1E3A5F] bg-white px-3 py-1.5 text-xs font-semibold text-[#1E3A5F] transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              보완 기준 전체 적용
            </button>
          </div>

          <div className="space-y-4">
            {improvements.revisedCriteria.map((proposal, index) => {
              const originalCriterion =
                draft.criteria.find((c) => c.id === proposal.criterionId) ??
                draft.criteria[index];
              const isSynced =
                originalCriterion &&
                originalCriterion.criteriaDescription.trim() ===
                  proposal.revisedCriteriaText.trim();

              return (
                <div
                  key={proposal.criterionId || index}
                  className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {originalCriterion?.elementName || proposal.originalElementName}
                      </span>
                      <span className="font-mono-tabular text-xs font-semibold text-slate-600">
                        · 현행 배점 {originalCriterion?.points ?? proposal.currentPoints}점
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={Boolean(isSynced)}
                      onClick={() => {
                        onApplyCriterionToDraft(
                          originalCriterion?.id ?? proposal.criterionId,
                          proposal.revisedCriteriaText,
                        );
                        showTempNotice(
                          `'${originalCriterion?.elementName || proposal.originalElementName}' 채점 기준을 원본에 적용했습니다.`,
                        );
                      }}
                      className="inline-flex items-center gap-1 rounded-md bg-[#1E3A5F] px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-[#162C49] disabled:cursor-default disabled:bg-slate-200 disabled:text-slate-600 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{isSynced ? '원본과 동일함' : '이 기준 원본에 적용'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <div className="rounded-md bg-slate-50 p-3">
                      <div className="mb-1 text-xs font-medium text-slate-500">원본 세부 기준</div>
                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
                        {originalCriterion?.criteriaDescription || '(입력 없음)'}
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor={`rev-crit-${proposal.criterionId}`}
                        className="mb-1 block text-xs font-medium text-[#1E3A5F]"
                      >
                        보완된 세부 기준 (편집 가능)
                      </label>
                      <textarea
                        id={`rev-crit-${proposal.criterionId}`}
                        rows={4}
                        value={proposal.revisedCriteriaText}
                        onChange={(e) =>
                          handleCriterionProposalEdit(proposal.criterionId, e.target.value)
                        }
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs leading-relaxed text-slate-900 focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/15"
                      />
                    </div>
                  </div>

                  <div className="rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-700">
                    <span className="font-semibold text-slate-800">배점·요소 검토 의견: </span>
                    <span>{proposal.pointReviewComment}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Partial Score Guidelines */}
        <div className="space-y-3 border-t border-slate-200 pt-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              3. 부분점수 판단 시 고려할 사항
            </h3>
            <p className="text-xs text-slate-500">
              채점 과정에서 판단이 흔들리지 않도록 사전에 합의할 실무 기준입니다(직접 수정·추가 가능).
            </p>
          </div>

          <div className="space-y-2">
            {improvements.partialScoreGuidelines.map((guide, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="mt-2.5 font-mono-tabular text-xs font-semibold text-slate-500 shrink-0">
                  {index + 1}.
                </span>
                <textarea
                  rows={2}
                  value={guide}
                  onChange={(e) => handleGuidelineEdit(index, e.target.value)}
                  aria-label={`부분점수 고려 사항 ${index + 1}`}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs leading-relaxed text-slate-900 focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/15"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveGuideline(index)}
                  aria-label={`부분점수 고려 사항 ${index + 1} 삭제`}
                  className="mt-1.5 rounded p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={newGuideline}
              onChange={(e) => setNewGuideline(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddGuideline();
                }
              }}
              placeholder="추가로 기록할 부분점수 판단 원칙을 입력하세요"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/15"
            />
            <button
              type="button"
              onClick={handleAddGuideline}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>항목 추가</span>
            </button>
          </div>
        </div>

        {/* 4. Teacher Decision Questions */}
        <div className="space-y-3 border-t border-slate-200 pt-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              4. 교사가 추가로 결정해야 할 질문
            </h3>
            <p className="text-xs text-slate-500">
              수업 맥락과 학급 여건에 따라 교사가 최종 확정해야 하는 사항입니다. 메모 내용은 로컬에 저장되며 인쇄 보고서에 포함됩니다.
            </p>
          </div>

          <div className="space-y-3">
            {improvements.teacherDecisions.map((decision, idx) => (
              <div
                key={decision.id || idx}
                className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50/50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">
                      Q{idx + 1}. {decision.question}
                    </p>
                    <p className="text-xs leading-relaxed text-slate-600">{decision.context}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDecisionToggle(decision.id)}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      decision.resolved
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {decision.resolved ? (
                      <CheckSquare className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                    ) : (
                      <Square className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    )}
                    <span>{decision.resolved ? '결정 완료' : '검토 중'}</span>
                  </button>
                </div>

                <div>
                  <label
                    htmlFor={`decision-memo-${decision.id}`}
                    className="block text-xs font-medium text-slate-600"
                  >
                    교사 결정 메모
                  </label>
                  <textarea
                    id={`decision-memo-${decision.id}`}
                    rows={2}
                    value={decision.teacherMemo}
                    onChange={(e) => handleDecisionMemo(decision.id, e.target.value)}
                    placeholder="예: 동점자 기준과 동일하게 필수 조건 미충족 시 최대 1점 감점 처리하기로 결정"
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/15"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
