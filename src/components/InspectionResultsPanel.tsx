import { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Info,
  ShieldAlert,
} from 'lucide-react';
import type {
  AiReviewResult,
  InspectionCategoryKey,
  InspectionItem,
  SeverityLevel,
} from '../types/assessment.ts';

interface InspectionResultsPanelProps {
  aiResult: AiReviewResult | null;
  isReviewing: boolean;
  reviewError: string | null;
  onJumpToImprovements: () => void;
}

type SeverityFilter = '전체' | SeverityLevel;

const CATEGORY_META: ReadonlyArray<{
  key: InspectionCategoryKey;
  title: string;
  description: string;
}> = [
  {
    key: 'clarity',
    title: '① 문항 명확성',
    description: '수행 과제의 명시성, 모호한 표현, 추가 안내 필요 사항을 점검합니다.',
  },
  {
    key: 'alignment',
    title: '② 평가 문항과 채점 기준의 정합성',
    description: '문항 요구사항과 채점 기준의 대응 여부 및 요소·배점 간 충돌을 점검합니다.',
  },
  {
    key: 'partialScoreAndExceptions',
    title: '③ 부분점수 및 예외 사례',
    description: '판단이 엇갈릴 상황, 부분점수 공백, 합리적 대안 답안 허용 범위를 점검합니다.',
  },
  {
    key: 'fairness',
    title: '④ 평가 공정성',
    description: '사전 미안내 기준 위험, 유사 답안 불균형, 기준 적용의 일관성을 점검합니다.',
  },
];

function SeverityIndicator({ severity }: { severity: SeverityLevel }) {
  if (severity === '높음') {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-800 whitespace-nowrap shrink-0">
        <ShieldAlert className="h-3.5 w-3.5 text-rose-700" aria-hidden="true" />
        <span>중요도: 높음</span>
      </span>
    );
  }
  if (severity === '보통') {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 whitespace-nowrap shrink-0">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
        <span>중요도: 보통</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700 whitespace-nowrap shrink-0">
      <Info className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
      <span>중요도: 참고</span>
    </span>
  );
}

function FindingStatusTag({ finding }: { finding: string }) {
  const normalized = finding.trim();
  if (normalized.includes('특별한 문제 발견되지 않음')) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
        <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />
        <span>{finding}</span>
      </span>
    );
  }
  if (normalized.includes('확인 필요')) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-900">
        <HelpCircle className="h-4 w-4 text-amber-700 shrink-0" aria-hidden="true" />
        <span>{finding}</span>
      </span>
    );
  }
  return <p className="text-sm font-semibold text-slate-900">{finding}</p>;
}

function InspectionCard({ item }: { item: InspectionItem }) {
  return (
    <article className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="text-sm font-bold text-[#1E3A5F]">{item.checkItem}</h4>
        <SeverityIndicator severity={item.severity} />
      </div>

      <div className="space-y-2.5 text-sm">
        <div>
          <div className="text-xs font-medium text-slate-500">발견된 문제 또는 확인 사항</div>
          <div className="mt-0.5">
            <FindingStatusTag finding={item.finding} />
          </div>
        </div>

        <div className="rounded-md bg-slate-50 px-3 py-2">
          <div className="text-xs font-medium text-slate-500">해당 원문 또는 관련 평가 기준</div>
          <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
            {item.targetReference}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
          <div>
            <div className="text-xs font-medium text-slate-500">문제로 판단한 이유</div>
            <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
              {item.reason}
            </p>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">구체적인 개선 제안</div>
            <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-slate-800">
              {item.suggestion}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

export function InspectionResultsPanel({
  aiResult,
  isReviewing,
  reviewError,
  onJumpToImprovements,
}: InspectionResultsPanelProps) {
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('전체');

  const allItems = aiResult
    ? [
        ...aiResult.inspections.clarity,
        ...aiResult.inspections.alignment,
        ...aiResult.inspections.partialScoreAndExceptions,
        ...aiResult.inspections.fairness,
      ]
    : [];

  const counts: Record<SeverityFilter, number> = {
    전체: allItems.length,
    높음: allItems.filter((i) => i.severity === '높음').length,
    보통: allItems.filter((i) => i.severity === '보통').length,
    참고: allItems.filter((i) => i.severity === '참고').length,
  };

  return (
    <section
      aria-labelledby="area-b-heading"
      className="rounded-xl border border-slate-200 bg-white"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
        <div>
          <span className="text-xs font-medium text-slate-500">영역 B</span>
          <h2 id="area-b-heading" className="text-lg font-bold text-slate-900">
            AI 수행평가 설계 점검
          </h2>
        </div>

        {aiResult ? (
          <button
            type="button"
            onClick={onJumpToImprovements}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#1E3A5F] transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            개선안 비교·편집으로 이동
          </button>
        ) : null}
      </div>

      <div className="space-y-5 p-6">
        {/* Error Notice (preserves inputs and prior result) */}
        {reviewError ? (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 text-rose-700 shrink-0" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-semibold">AI 점검 요청을 완료하지 못했습니다</p>
                <p className="text-xs leading-relaxed text-rose-800">{reviewError}</p>
                <p className="text-xs text-rose-700">
                  입력하신 문항·채점 기준과 기존 점검 결과는 그대로 유지되어 있습니다.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Loading State */}
        {isReviewing ? (
          <div className="space-y-4 py-4" aria-live="polite">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-[#1E3A5F]">
                입력하신 문항과 채점 기준을 4개 영역으로 점검하고 있습니다...
              </p>
              <p className="mt-1 text-xs text-slate-600">
                요청 1회로 명확성 · 정합성 · 부분점수 및 예외 사례 · 공정성을 분석 중입니다. 잠시만 기다려 주세요.
              </p>
            </div>
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="space-y-2.5 rounded-lg border border-slate-200 p-4"
              >
                <div className="h-4 w-1/3 rounded bg-slate-200/80" />
                <div className="h-3 w-5/6 rounded bg-slate-100" />
                <div className="h-3 w-2/3 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : null}

        {/* Empty State */}
        {!isReviewing && !aiResult ? (
          <div className="space-y-5 py-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-5">
              <h3 className="text-sm font-bold text-slate-900">
                아직 AI 설계 점검이 실행되지 않았습니다
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                왼쪽 <span className="font-semibold text-slate-800">영역 A</span>에 문항과 채점 기준을 입력한 뒤 상단 또는 하단의{' '}
                <span className="font-semibold text-[#1E3A5F]">‘AI 점검 실행’</span> 버튼을 클릭하면 다음 4가지 영역을 한 번에 분석합니다.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {CATEGORY_META.map((cat) => (
                <div
                  key={cat.key}
                  className="rounded-lg border border-slate-200 bg-white p-4"
                >
                  <h4 className="text-sm font-semibold text-slate-900">{cat.title}</h4>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    {cat.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Populated Results */}
        {!isReviewing && aiResult ? (
          <div className="space-y-6">
            {/* Summary & Official Plan Disclaimer */}
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  점검 일시: {new Date(aiResult.reviewedAt).toLocaleString('ko-KR')}
                </span>
                <span>점검 결과는 원본을 자동 수정하지 않습니다</span>
              </div>
              <p className="text-sm leading-relaxed text-slate-800">{aiResult.summary}</p>
              <p className="border-t border-slate-200 pt-2.5 text-xs leading-relaxed text-slate-600">
                {aiResult.officialPlanNotice}
              </p>
            </div>

            {/* Severity Filter Segmented Control */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-medium text-slate-600">중요도별 보기</span>
              <div
                role="tablist"
                aria-label="중요도 필터"
                className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1"
              >
                {(['전체', '높음', '보통', '참고'] as const).map((level) => {
                  const active = severityFilter === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setSeverityFilter(level)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium tabular-nums transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {level} ({counts[level]})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4 Inspection Categories */}
            <div className="space-y-6">
              {CATEGORY_META.map((cat) => {
                const items = aiResult.inspections[cat.key];
                const filtered =
                  severityFilter === '전체'
                    ? items
                    : items.filter((i) => i.severity === severityFilter);

                return (
                  <div key={cat.key} className="space-y-3 border-t border-slate-200 pt-5 first:border-t-0 first:pt-0">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{cat.title}</h3>
                      <p className="mt-0.5 text-xs text-slate-500">{cat.description}</p>
                    </div>

                    {filtered.length === 0 ? (
                      <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                        선택한 중요도({severityFilter})에 해당하는 항목이 없습니다.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {filtered.map((item) => (
                          <InspectionCard key={item.id} item={item} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
