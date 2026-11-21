import type {
  AiReviewResult,
  AssessmentDraft,
  LocalWorkspaceState,
  ProjectExportData,
  RubricCriterion,
} from '../types/assessment.ts';

const STORAGE_KEY = 'kr_perf_eval_assistant_v1';

export function createCriterionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `crit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyDraft(): AssessmentDraft {
  return {
    subject: '',
    title: '',
    promptText: '',
    criteria: [
      {
        id: createCriterionId(),
        elementName: '',
        points: 10,
        criteriaDescription: '',
      },
    ],
    gradingConcerns: '',
  };
}

export function createSampleDraft(): AssessmentDraft {
  return {
    subject: '통합사회',
    title: '지역 사회 환경 문제 해결 방안 정책 제안서 작성',
    promptText:
      '우리 지역에서 실제로 발생하고 있는 환경 문제(예: 일회용품 증가, 도심 열섬 현상, 하천 오염 등) 중 한 가지를 선정하여 원인을 분석하고, 실현 가능한 해결 방안을 담은 정책 제안서를 작성하시오.\n\n[작성 조건]\n- 문제의 현황을 나타내는 통계나 사례 자료를 1개 이상 포함할 것\n- 지자체 또는 학교 차원의 구체적인 실행 주체와 방안을 제시할 것\n- 분량은 A4 1~2쪽 내외로 작성할 것',
    criteria: [
      {
        id: 'sample-c1',
        elementName: '문제 선정 및 현황 분석의 타당성',
        points: 10,
        criteriaDescription:
          '상(10점): 지역 환경 문제를 구체적으로 선정하고 신뢰할 수 있는 통계·사례를 근거로 원인을 논리적으로 분석함.\n중(7점): 문제와 원인을 제시했으나 자료 근거가 다소 부족함.\n하(4점): 문제 인식이 막연하고 근거 자료가 없음.',
      },
      {
        id: 'sample-c2',
        elementName: '해결 방안의 실현 가능성 및 구체성',
        points: 10,
        criteriaDescription:
          '상(10점): 실행 주체와 절차가 명확하고 현실적인 해결 방안을 제시함.\n중(7점): 해결 방안을 제시했으나 구체성이나 실현 가능성이 다소 떨어짐.\n하(4점): 구호 수준의 추상적 제안에 그침.',
      },
      {
        id: 'sample-c3',
        elementName: '형식 준수 및 창의적 표현',
        points: 10,
        criteriaDescription:
          '상(10점): 분량과 형식을 잘 지키고 시각 자료 등을 활용해 창의적으로 작성함.\n중(7점): 형식을 대체로 지켰으나 표현이 평이함.\n하(4점): 분량이 크게 부족하거나 형식이 미흡함.',
      },
    ],
    gradingConcerns:
      '1) 문항 안내문에는 시각 자료를 요구하지 않았는데 채점 기준 상 등급에 "시각 자료 활용"이 들어가 있어 학생에게 불공정할지 고민됩니다.\n2) 상·중·하 사이의 중간 점수(예: 8~9점, 5~6점)를 줄 때 교사마다 기준이 달라질까 걱정됩니다.',
  };
}

function sanitizeCriterion(raw: unknown, idx: number): RubricCriterion {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pointsNum = Number(obj.points);
  return {
    id: typeof obj.id === 'string' && obj.id.trim() ? obj.id : `crit-restored-${idx + 1}`,
    elementName: typeof obj.elementName === 'string' ? obj.elementName : '',
    points: Number.isFinite(pointsNum) && pointsNum >= 0 ? pointsNum : 0,
    criteriaDescription:
      typeof obj.criteriaDescription === 'string' ? obj.criteriaDescription : '',
  };
}

export function sanitizeDraft(raw: unknown): AssessmentDraft {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rawCriteria = Array.isArray(obj.criteria) ? obj.criteria : [];
  return {
    subject: typeof obj.subject === 'string' ? obj.subject : '',
    title: typeof obj.title === 'string' ? obj.title : '',
    promptText: typeof obj.promptText === 'string' ? obj.promptText : '',
    criteria:
      rawCriteria.length > 0
        ? rawCriteria.map((item, idx) => sanitizeCriterion(item, idx))
        : createEmptyDraft().criteria,
    gradingConcerns: typeof obj.gradingConcerns === 'string' ? obj.gradingConcerns : '',
  };
}

export function loadWorkspaceFromLocalStorage(): LocalWorkspaceState | null {
  try {
    const serialized = window.localStorage.getItem(STORAGE_KEY);
    if (!serialized) return null;
    const parsed = JSON.parse(serialized) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return null;

    return {
      version: 1,
      updatedAt:
        typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      draft: sanitizeDraft(parsed.draft),
      aiResult:
        parsed.aiResult && typeof parsed.aiResult === 'object'
          ? (parsed.aiResult as AiReviewResult)
          : null,
      lastError: null,
    };
  } catch {
    return null;
  }
}

export function saveWorkspaceToLocalStorage(
  draft: AssessmentDraft,
  aiResult: AiReviewResult | null,
): void {
  try {
    const state: LocalWorkspaceState = {
      version: 1,
      updatedAt: new Date().toISOString(),
      draft,
      aiResult,
      lastError: null,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota or restricted-storage errors silently
  }
}

export function clearWorkspaceLocalStorage(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function downloadProjectJson(
  draft: AssessmentDraft,
  aiResult: AiReviewResult | null,
): void {
  const payload: ProjectExportData = {
    app: 'ai-performance-assessment-reviewer',
    version: 1,
    exportedAt: new Date().toISOString(),
    draft,
    aiResult,
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const safeTitle = (draft.title.trim() || '수행평가_설계점검')
    .replace(/[\\/:*?"<>|]/g, '_')
    .slice(0, 40);
  const datePart = new Date().toISOString().slice(0, 10);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeTitle}_${datePart}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function parseImportedProjectJson(
  text: string,
): { ok: true; draft: AssessmentDraft; aiResult: AiReviewResult | null } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: '올바른 프로젝트 JSON 형식이 아닙니다.' };
    }

    if (!parsed.draft || typeof parsed.draft !== 'object') {
      return { ok: false, error: '프로젝트 파일에 평가 문항 데이터(draft)가 없습니다.' };
    }

    const draft = sanitizeDraft(parsed.draft);
    const aiResult =
      parsed.aiResult &&
      typeof parsed.aiResult === 'object' &&
      'inspections' in parsed.aiResult &&
      'improvements' in parsed.aiResult
        ? (parsed.aiResult as AiReviewResult)
        : null;

    return { ok: true, draft, aiResult };
  } catch {
    return {
      ok: false,
      error: 'JSON 파일을 읽을 수 없습니다. 손상되었거나 지원하지 않는 파일입니다.',
    };
  }
}
