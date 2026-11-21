import { Printer } from 'lucide-react';
import type {
  AiReviewResult,
  AssessmentDraft,
  InspectionCategoryKey,
} from '../types/assessment.ts';
import { calculateTotalPoints } from '../utils/validation.ts';

interface PrintableReportViewProps {
  draft: AssessmentDraft;
  aiResult: AiReviewResult | null;
  onPrint: () => void;
  isScreenPreview?: boolean;
}

const CATEGORY_LABELS: Record<InspectionCategoryKey, string> = {
  clarity: '① 문항 명확성',
  alignment: '② 평가 문항과 채점 기준의 정합성',
  partialScoreAndExceptions: '③ 부분점수 및 예외 사례',
  fairness: '④ 평가 공정성',
};

export function PrintableReportView({
  draft,
  aiResult,
  onPrint,
  isScreenPreview = false,
}: PrintableReportViewProps) {
  const totalPoints = calculateTotalPoints(draft);

  return (
    <div
      className={
        isScreenPreview
          ? 'no-print rounded-xl border border-slate-200 bg-white'
          : 'print-only bg-white text-slate-900'
      }
    >
      {isScreenPreview ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div>
            <span className="text-xs font-medium text-slate-500">인쇄 및 PDF 저장</span>
            <h2 className="text-lg font-bold text-slate-900">
              수행평가 설계 점검 보고서 미리보기
            </h2>
          </div>
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1E3A5F] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#162C49] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            <span>인쇄 / PDF로 저장</span>
          </button>
        </div>
      ) : null}

      <div className={isScreenPreview ? 'space-y-8 p-6 sm:p-8' : 'space-y-6'}>
        {/* Report Title Header */}
        <header className="border-b-2 border-slate-900 pb-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-xl font-bold text-slate-900">
              수행평가 설계 점검 및 개선 보고서
            </h1>
            <span className="text-xs text-slate-500">
              AI 수행평가 설계 점검 도우미
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-700 sm:grid-cols-4">
            <div>
              <span className="font-semibold text-slate-900">교과명: </span>
              <span>{draft.subject.trim() || '미입력'}</span>
            </div>
            <div className="sm:col-span-2">
              <span className="font-semibold text-slate-900">수행평가명: </span>
              <span>{draft.title.trim() || '미입력'}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-900">총 배점: </span>
              <span className="tabular-nums">{totalPoints}점</span>
            </div>
          </div>

          {aiResult ? (
            <p className="mt-2 text-xs text-slate-500">
              점검 일시: {new Date(aiResult.reviewedAt).toLocaleString('ko-KR')}
            </p>
          ) : null}
        </header>

        {/* Section 1: Original Draft */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900">
            1. 입력된 수행평가 문항 및 채점 기준
          </h2>
          <div className="rounded border border-slate-300 p-3.5">
            <div className="text-xs font-semibold text-slate-600">문항 및 과제 안내문</div>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-900">
              {draft.promptText.trim() || '(입력된 문항이 없습니다)'}
            </p>
          </div>

          <table className="w-full border-collapse border border-slate-300 text-xs">
            <thead>
              <tr className="bg-slate-100 text-left text-slate-800">
                <th className="w-1/4 border border-slate-300 px-3 py-2 font-semibold">
                  평가 요소
                </th>
                <th className="w-16 border border-slate-300 px-3 py-2 text-right font-semibold">
                  배점
                </th>
                <th className="border border-slate-300 px-3 py-2 font-semibold">
                  세부 채점 기준
                </th>
              </tr>
            </thead>
            <tbody>
              {draft.criteria.map((c, idx) => (
                <tr key={c.id || idx} className="align-top">
                  <td className="border border-slate-300 px-3 py-2 font-medium text-slate-900">
                    {c.elementName.trim() || `평가 요소 ${idx + 1}`}
                  </td>
                  <td className="border border-slate-300 px-3 py-2 text-right tabular-nums text-slate-900">
                    {c.points}점
                  </td>
                  <td className="whitespace-pre-wrap border border-slate-300 px-3 py-2 leading-relaxed text-slate-800">
                    {c.criteriaDescription.trim() || '(미입력)'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {draft.gradingConcerns.trim() ? (
            <div className="rounded border border-slate-300 p-3">
              <div className="text-xs font-semibold text-slate-600">교사의 사전 고민 사항</div>
              <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-800">
                {draft.gradingConcerns}
              </p>
            </div>
          ) : null}
        </section>

        {/* Section 2: AI Inspection */}
        {aiResult ? (
          <>
            <section className="space-y-4">
              <h2 className="text-sm font-bold text-slate-900">
                2. 4대 영역 AI 설계 점검 결과
              </h2>
              <div className="rounded border border-slate-300 bg-slate-50 p-3 text-xs leading-relaxed text-slate-800">
                <p className="font-medium text-slate-900">{aiResult.summary}</p>
                <p className="mt-1.5 text-slate-600">{aiResult.officialPlanNotice}</p>
              </div>

              {(Object.keys(CATEGORY_LABELS) as InspectionCategoryKey[]).map((key) => (
                <div key={key} className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-900">{CATEGORY_LABELS[key]}</h3>
                  <table className="w-full border-collapse border border-slate-300 text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-left text-slate-800">
                        <th className="w-1/5 border border-slate-300 px-2.5 py-1.5 font-semibold">
                          점검 항목 · 중요도
                        </th>
                        <th className="w-1/4 border border-slate-300 px-2.5 py-1.5 font-semibold">
                          발견 사항 및 관련 원문
                        </th>
                        <th className="border border-slate-300 px-2.5 py-1.5 font-semibold">
                          판단 이유 및 개선 제안
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiResult.inspections[key].map((item) => (
                        <tr key={item.id} className="print-break-inside-avoid align-top">
                          <td className="border border-slate-300 px-2.5 py-2">
                            <div className="font-semibold text-slate-900">{item.checkItem}</div>
                            <div className="mt-1 text-slate-600">중요도: {item.severity}</div>
                          </td>
                          <td className="border border-slate-300 px-2.5 py-2">
                            <div className="font-semibold text-slate-900">{item.finding}</div>
                            <div className="mt-1 text-slate-600">
                              대상: {item.targetReference}
                            </div>
                          </td>
                          <td className="border border-slate-300 px-2.5 py-2 leading-relaxed">
                            <div>
                              <span className="font-semibold text-slate-800">이유: </span>
                              <span>{item.reason}</span>
                            </div>
                            <div className="mt-1">
                              <span className="font-semibold text-slate-800">제안: </span>
                              <span>{item.suggestion}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </section>

            {/* Section 3: Teacher-Reviewed Improvements */}
            <section className="space-y-4">
              <h2 className="text-sm font-bold text-slate-900">
                3. 검토된 개선안 및 교사 결정 사항
              </h2>

              <div className="print-break-inside-avoid rounded border border-slate-300 p-3.5">
                <div className="text-xs font-semibold text-slate-700">수정된 수행평가 문항</div>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-900">
                  {aiResult.improvements.revisedPrompt}
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-800">보완된 채점 기준</div>
                <table className="w-full border-collapse border border-slate-300 text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-left text-slate-800">
                      <th className="w-1/4 border border-slate-300 px-2.5 py-1.5 font-semibold">
                        평가 요소 (현행 배점)
                      </th>
                      <th className="border border-slate-300 px-2.5 py-1.5 font-semibold">
                        보완된 채점 기준 및 배점 검토 의견
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiResult.improvements.revisedCriteria.map((c, idx) => (
                      <tr key={c.criterionId || idx} className="print-break-inside-avoid align-top">
                        <td className="border border-slate-300 px-2.5 py-2 font-medium">
                          <div>{c.originalElementName}</div>
                          <div className="mt-0.5 tabular-nums text-slate-600">
                            {c.currentPoints}점
                          </div>
                        </td>
                        <td className="border border-slate-300 px-2.5 py-2 leading-relaxed">
                          <div className="whitespace-pre-wrap text-slate-900">
                            {c.revisedCriteriaText}
                          </div>
                          <div className="mt-1.5 text-slate-600">
                            배점 검토 의견: {c.pointReviewComment}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="print-break-inside-avoid rounded border border-slate-300 p-3.5">
                <div className="text-xs font-semibold text-slate-800">
                  부분점수 판단 시 고려 사항
                </div>
                <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-slate-800">
                  {aiResult.improvements.partialScoreGuidelines.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ol>
              </div>

              <div className="print-break-inside-avoid rounded border border-slate-300 p-3.5">
                <div className="text-xs font-semibold text-slate-800">
                  교사 추가 결정 사항 및 메모
                </div>
                <ul className="mt-2 space-y-2 text-xs">
                  {aiResult.improvements.teacherDecisions.map((d, idx) => (
                    <li key={d.id || idx} className="border-t border-slate-200 pt-2 first:border-t-0 first:pt-0">
                      <div className="font-semibold text-slate-900">
                        Q{idx + 1}. {d.question} ({d.resolved ? '결정 완료' : '검토 중'})
                      </div>
                      <div className="mt-0.5 text-slate-700">
                        결정 메모: {d.teacherMemo.trim() || '(미작성)'}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </>
        ) : (
          <section className="rounded border border-slate-300 p-4 text-xs text-slate-600">
            아직 AI 설계 점검이 실행되지 않아 입력된 문항 및 채점 기준만 포함되었습니다.
          </section>
        )}
      </div>
    </div>
  );
}
