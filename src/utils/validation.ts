import type { AssessmentDraft } from '../types/assessment.ts';

export interface ValidationNotice {
  field: 'title' | 'promptText' | 'criteria' | 'points';
  level: 'blocking' | 'advisory';
  message: string;
}

export function calculateTotalPoints(draft: AssessmentDraft): number {
  return draft.criteria.reduce((sum, item) => {
    const val = Number(item.points);
    return sum + (Number.isFinite(val) && val >= 0 ? val : 0);
  }, 0);
}

export function validateAssessmentDraft(draft: AssessmentDraft): {
  canRunAi: boolean;
  notices: ValidationNotice[];
  totalPoints: number;
} {
  const notices: ValidationNotice[] = [];
  const totalPoints = calculateTotalPoints(draft);

  if (!draft.title.trim()) {
    notices.push({
      field: 'title',
      level: 'blocking',
      message: '수행평가명을 입력해 주세요.',
    });
  }

  const promptLen = draft.promptText.trim().length;
  if (promptLen === 0) {
    notices.push({
      field: 'promptText',
      level: 'blocking',
      message: '수행평가 문항 및 과제 안내문을 입력해 주세요.',
    });
  } else if (promptLen < 20) {
    notices.push({
      field: 'promptText',
      level: 'blocking',
      message: '문항 안내문이 너무 짧습니다. 학생에게 주어지는 과제 지시 내용을 구체적으로 입력해 주세요(최소 20자 권장).',
    });
  }

  if (draft.criteria.length === 0) {
    notices.push({
      field: 'criteria',
      level: 'blocking',
      message: '최소 1개 이상의 평가 요소와 세부 채점 기준을 추가해 주세요.',
    });
  } else {
    const incompleteRows = draft.criteria.filter(
      (c) => !c.elementName.trim() || !c.criteriaDescription.trim(),
    );
    if (incompleteRows.length > 0) {
      notices.push({
        field: 'criteria',
        level: 'blocking',
        message: `평가 요소명 또는 세부 채점 기준이 비어 있는 항목이 ${incompleteRows.length}개 있습니다.`,
      });
    }
  }

  if (draft.criteria.length > 0 && totalPoints === 0) {
    notices.push({
      field: 'points',
      level: 'advisory',
      message: '총 배점 합계가 0점입니다. 실제 평가 배점을 입력하면 정합성 점검 정확도가 높아집니다.',
    });
  }

  if (!draft.subject.trim()) {
    notices.push({
      field: 'title',
      level: 'advisory',
      message: '교과명이 비어 있습니다(선택 사항이지만 입력 시 교과 맥락에 맞춘 점검이 가능합니다).',
    });
  }

  const canRunAi = !notices.some((n) => n.level === 'blocking');
  return { canRunAi, notices, totalPoints };
}
