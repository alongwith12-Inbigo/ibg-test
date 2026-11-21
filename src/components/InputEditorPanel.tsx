import { useState, type ClipboardEvent } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, Info, Plus, Trash2 } from 'lucide-react';
import type {
  AssessmentDraft,
  ExtractedCriterionDraft,
  RubricCriterion,
} from '../types/assessment.ts';
import { createCriterionId } from '../utils/storage.ts';
import { validateAssessmentDraft } from '../utils/validation.ts';
import { CriteriaImportBox } from './CriteriaImportBox.tsx';

interface InputEditorPanelProps {
  draft: AssessmentDraft;
  onChangeDraft: (next: AssessmentDraft) => void;
  onRunReview: () => void;
  isReviewing: boolean;
}

export function InputEditorPanel({
  draft,
  onChangeDraft,
  onRunReview,
  isReviewing,
}: InputEditorPanelProps) {
  const [pastedImageFile, setPastedImageFile] = useState<File | null>(null);
  const { canRunAi, notices, totalPoints } = validateAssessmentDraft(draft);
  const blockingNotices = notices.filter((n) => n.level === 'blocking');
  const advisoryNotices = notices.filter((n) => n.level === 'advisory');

  const updateField = <K extends keyof AssessmentDraft>(
    key: K,
    value: AssessmentDraft[K],
  ) => {
    onChangeDraft({ ...draft, [key]: value });
  };

  const updateCriterion = (
    id: string,
    patch: Partial<RubricCriterion>,
  ) => {
    const nextCriteria = draft.criteria.map((item) =>
      item.id === id ? { ...item, ...patch } : item,
    );
    updateField('criteria', nextCriteria);
  };

  const addCriterion = () => {
    const nextCriteria: RubricCriterion[] = [
      ...draft.criteria,
      {
        id: createCriterionId(),
        elementName: '',
        points: 10,
        criteriaDescription: '',
      },
    ];
    updateField('criteria', nextCriteria);
  };

  const removeCriterion = (id: string) => {
    if (draft.criteria.length <= 1) return;
    updateField(
      'criteria',
      draft.criteria.filter((item) => item.id !== id),
    );
  };

  const moveCriterion = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= draft.criteria.length) return;
    const next = [...draft.criteria];
    const current = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = current;
    updateField('criteria', next);
  };

  const handleApplyExtractedCriteria = (
    items: ExtractedCriterionDraft[],
    mode: 'append' | 'replace',
  ) => {
    const mapped: RubricCriterion[] = items.map((item) => ({
      id: createCriterionId(),
      elementName: item.elementName,
      points: item.points,
      criteriaDescription: item.criteriaDescription,
    }));

    if (mode === 'replace') {
      updateField('criteria', mapped);
      return;
    }

    const isOnlySingleBlankRow =
      draft.criteria.length === 1 &&
      !draft.criteria[0].elementName.trim() &&
      !draft.criteria[0].criteriaDescription.trim();

    updateField(
      'criteria',
      isOnlySingleBlankRow ? mapped : [...draft.criteria, ...mapped],
    );
  };

  const handlePanelPaste = (event: ClipboardEvent<HTMLElement>) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          event.preventDefault();
          setPastedImageFile(file);
          return;
        }
      }
    }
  };

  return (
    <section
      aria-labelledby="area-a-heading"
      onPaste={handlePanelPaste}
      className="rounded-xl border border-slate-200 bg-white"
    >
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
        <div>
          <span className="text-xs font-medium text-slate-500">영역 A</span>
          <h2 id="area-a-heading" className="text-lg font-bold text-slate-900">
            평가 문항 및 채점 기준 입력
          </h2>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className="text-right">
            <span className="text-xs text-slate-500">총 배점 합계</span>
            <div className="font-mono-tabular text-lg font-bold text-[#1E3A5F]">
              {totalPoints}점
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-6">
        {/* Basic Metadata: Subject & Title */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
          <div className="sm:col-span-4">
            <label
              htmlFor="eval-subject"
              className="block text-sm font-medium text-slate-800"
            >
              교과명 <span className="text-xs font-normal text-slate-500">(선택)</span>
            </label>
            <input
              id="eval-subject"
              type="text"
              value={draft.subject}
              onChange={(e) => updateField('subject', e.target.value)}
              placeholder="예: 통합사회, 국어, 과학"
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/15"
            />
          </div>

          <div className="sm:col-span-8">
            <label
              htmlFor="eval-title"
              className="block text-sm font-medium text-slate-800"
            >
              수행평가명 <span className="text-xs font-normal text-rose-700">(필수)</span>
            </label>
            <input
              id="eval-title"
              type="text"
              value={draft.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="예: 지역 사회 환경 문제 해결 방안 정책 제안서 작성"
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/15"
            />
          </div>
        </div>

        {/* Prompt Text */}
        <div className="border-t border-slate-100 pt-5">
          <div className="flex items-baseline justify-between gap-2">
            <label
              htmlFor="eval-prompt"
              className="block text-sm font-medium text-slate-800"
            >
              수행평가 문항 및 과제 안내문{' '}
              <span className="text-xs font-normal text-rose-700">(필수)</span>
            </label>
            <span className="tabular-nums text-xs text-slate-500">
              {draft.promptText.length.toLocaleString('ko-KR')}자
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            학생에게 배부하는 문항 지시문, 조건, 유의사항 등을 그대로 붙여넣거나 입력해 주세요.
          </p>
          <textarea
            id="eval-prompt"
            rows={8}
            value={draft.promptText}
            onChange={(e) => updateField('promptText', e.target.value)}
            placeholder="학생이 수행해야 할 과제, 포함해야 할 필수 요소, 분량·형식 조건 등을 입력하세요."
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/15"
          />
        </div>

        {/* Rubric Criteria Table/List */}
        <div className="border-t border-slate-100 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                평가 요소 · 배점 · 세부 채점 기준
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                평가 요소별로 배점과 상·중·하 또는 점수 구간별 기준을 입력해 주세요.
              </p>
            </div>
            <button
              type="button"
              onClick={addCriterion}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>평가 요소 추가</span>
            </button>
          </div>

          <CriteriaImportBox
            externalPastedFile={pastedImageFile}
            onConsumeExternalPastedFile={() => setPastedImageFile(null)}
            onApplyExtractedCriteria={handleApplyExtractedCriteria}
            disabled={isReviewing}
          />

          <div className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-slate-50/40">
            {draft.criteria.map((criterion, index) => (
              <div key={criterion.id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="tabular-nums text-xs font-semibold text-slate-600">
                    평가 요소 {index + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveCriterion(index, -1)}
                      disabled={index === 0}
                      aria-label={`평가 요소 ${index + 1} 위로 이동`}
                      className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveCriterion(index, 1)}
                      disabled={index === draft.criteria.length - 1}
                      aria-label={`평가 요소 ${index + 1} 아래로 이동`}
                      className="rounded p-1 text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCriterion(criterion.id)}
                      disabled={draft.criteria.length <= 1}
                      aria-label={`평가 요소 ${index + 1} 삭제`}
                      className="ml-1 inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-rose-700 transition-colors hover:bg-rose-50 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>삭제</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                  <div className="sm:col-span-9">
                    <label
                      htmlFor={`crit-name-${criterion.id}`}
                      className="block text-xs font-medium text-slate-700"
                    >
                      평가 요소명
                    </label>
                    <input
                      id={`crit-name-${criterion.id}`}
                      type="text"
                      value={criterion.elementName}
                      onChange={(e) =>
                        updateCriterion(criterion.id, { elementName: e.target.value })
                      }
                      placeholder="예: 자료 활용 및 근거 제시의 타당성"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/15"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label
                      htmlFor={`crit-points-${criterion.id}`}
                      className="block text-xs font-medium text-slate-700"
                    >
                      배점 (점)
                    </label>
                    <input
                      id={`crit-points-${criterion.id}`}
                      type="number"
                      min={0}
                      max={1000}
                      step={1}
                      value={Number.isNaN(criterion.points) ? '' : criterion.points}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const num = raw === '' ? 0 : Math.max(0, Number(raw));
                        updateCriterion(criterion.id, {
                          points: Number.isFinite(num) ? num : 0,
                        });
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-right font-mono-tabular text-sm text-slate-900 focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/15"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor={`crit-desc-${criterion.id}`}
                    className="block text-xs font-medium text-slate-700"
                  >
                    세부 채점 기준
                  </label>
                  <textarea
                    id={`crit-desc-${criterion.id}`}
                    rows={4}
                    value={criterion.criteriaDescription}
                    onChange={(e) =>
                      updateCriterion(criterion.id, { criteriaDescription: e.target.value })
                    }
                    placeholder="예: 상(10점): ... / 중(7점): ... / 하(4점): ..."
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/15"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
            <span>입력된 평가 요소 {draft.criteria.length}개</span>
            <span className="font-semibold text-slate-900 tabular-nums">
              배점 합계: {totalPoints}점
            </span>
          </div>
        </div>

        {/* Optional Grading Concerns */}
        <div className="border-t border-slate-100 pt-5">
          <label
            htmlFor="eval-concerns"
            className="block text-sm font-medium text-slate-800"
          >
            추가로 고민되는 채점 문제{' '}
            <span className="text-xs font-normal text-slate-500">(선택)</span>
          </label>
          <p className="mt-1 text-xs text-slate-500">
            부분점수 경계, 예외 답안 허용 범위, 생성형 AI 활용 여부 등 특별히 점검받고 싶은 고민을 적어 주세요.
          </p>
          <textarea
            id="eval-concerns"
            rows={3}
            value={draft.gradingConcerns}
            onChange={(e) => updateField('gradingConcerns', e.target.value)}
            placeholder="예: 학생마다 접근 방식이 달라질 때 부분점수 기준을 어떻게 잡아야 할지 고민됩니다."
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-[#1E3A5F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/15"
          />
        </div>

        {/* Validation Guidance */}
        {(blockingNotices.length > 0 || advisoryNotices.length > 0) && (
          <div className="space-y-2 border-t border-slate-100 pt-5">
            {blockingNotices.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-950">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertCircle className="h-4 w-4 text-amber-700 shrink-0" aria-hidden="true" />
                  <span>AI 점검 실행 전 확인이 필요한 입력 항목</span>
                </div>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-amber-900">
                  {blockingNotices.map((item, idx) => (
                    <li key={idx}>{item.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {advisoryNotices.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700">
                <div className="flex items-center gap-1.5 font-medium text-slate-800">
                  <Info className="h-4 w-4 text-slate-500 shrink-0" aria-hidden="true" />
                  <span>입력 참고 안내</span>
                </div>
                <ul className="mt-1.5 list-disc space-y-1 pl-5">
                  {advisoryNotices.map((item, idx) => (
                    <li key={idx}>{item.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Bottom Run Action */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">
            점검을 실행해도 원본 문항과 배점은 자동으로 변경되지 않습니다.
          </p>
          <button
            type="button"
            onClick={onRunReview}
            disabled={isReviewing || !canRunAi}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1E3A5F] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#162C49] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isReviewing ? 'AI 점검 실행 중...' : 'AI 점검 실행'}
          </button>
        </div>
      </div>
    </section>
  );
}
