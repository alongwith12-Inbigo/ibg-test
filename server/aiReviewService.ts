import { GoogleGenAI, Type } from '@google/genai';
import type {
  AiReviewResult,
  AssessmentDraft,
  CriteriaExtractionRequest,
  ExtractedCriteriaResult,
  ExtractedCriterionDraft,
  ImprovementProposals,
  InspectionItem,
  InspectionSections,
  RevisedCriterionProposal,
  SeverityLevel,
  TeacherDecisionItem,
} from '../src/types/assessment.ts';

export interface AiReviewerConfig {
  apiKey: string;
  model?: string;
}

export interface AiReviewProvider {
  readonly model: string;
  reviewAssessment(draft: AssessmentDraft): Promise<AiReviewResult>;
  extractCriteriaFromSource(source: CriteriaExtractionRequest): Promise<ExtractedCriteriaResult>;
}

const DEFAULT_FLASH_MODEL = 'gemini-4-hydrogen';

const SEVERITY_VALUES: readonly SeverityLevel[] = ['높음', '보통', '참고'];

function normalizeSeverity(value: unknown): SeverityLevel {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (SEVERITY_VALUES.includes(trimmed as SeverityLevel)) {
      return trimmed as SeverityLevel;
    }
    if (trimmed.includes('높') || trimmed.toLowerCase() === 'high') return '높음';
    if (trimmed.includes('참') || trimmed.toLowerCase() === 'info' || trimmed.toLowerCase() === 'low') return '참고';
  }
  return '보통';
}

function asNonEmptyString(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return fallback;
}

function normalizeInspectionList(rawList: unknown, prefix: string): InspectionItem[] {
  if (!Array.isArray(rawList) || rawList.length === 0) {
    return [
      {
        id: `${prefix}-default-1`,
        checkItem: '전반적 검토',
        finding: '특별한 문제 발견되지 않음',
        targetReference: '해당 없음',
        reason: '제공된 문항과 채점 기준 범위 내에서 뚜렷한 결함이 확인되지 않았습니다.',
        suggestion: '현재 설계를 유지하되 실제 수업 적용 전 학생 눈높이에서 한 번 더 읽어보시기 바랍니다.',
        severity: '참고',
      },
    ];
  }

  return rawList.map((entry, idx) => {
    const item = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
    return {
      id: `${prefix}-${idx + 1}`,
      checkItem: asNonEmptyString(item.checkItem, `점검 항목 ${idx + 1}`),
      finding: asNonEmptyString(item.finding, '확인 필요'),
      targetReference: asNonEmptyString(item.targetReference, '해당 없음'),
      reason: asNonEmptyString(item.reason, '제시된 평가 자료를 바탕으로 검토가 필요한 사항입니다.'),
      suggestion: asNonEmptyString(item.suggestion, '세부 표현이나 기준을 교사 판단에 따라 보완해 주세요.'),
      severity: normalizeSeverity(item.severity),
    };
  });
}

function normalizeRevisedCriteria(
  rawCriteria: unknown,
  draft: AssessmentDraft,
): RevisedCriterionProposal[] {
  const rawArray = Array.isArray(rawCriteria) ? rawCriteria : [];

  return draft.criteria.map((criterion, index) => {
    const matched =
      rawArray.find((entry) => {
        if (!entry || typeof entry !== 'object') return false;
        const obj = entry as Record<string, unknown>;
        return (
          obj.criterionId === criterion.id ||
          (typeof obj.originalElementName === 'string' &&
            obj.originalElementName.trim() === criterion.elementName.trim())
        );
      }) ?? rawArray[index];

    const obj = (matched && typeof matched === 'object' ? matched : {}) as Record<string, unknown>;

    return {
      criterionId: criterion.id,
      originalElementName: criterion.elementName || `평가 요소 ${index + 1}`,
      currentPoints: Number.isFinite(criterion.points) ? criterion.points : 0,
      revisedCriteriaText: asNonEmptyString(
        obj.revisedCriteriaText,
        criterion.criteriaDescription || '세부 채점 기준이 입력되지 않아 보완안을 생성할 수 없습니다.',
      ),
      pointReviewComment: asNonEmptyString(
        obj.pointReviewComment,
        '현재 배점 유지 가능 (필요 시 교사 검토)',
      ),
    };
  });
}

function normalizeDecisions(rawDecisions: unknown): TeacherDecisionItem[] {
  if (!Array.isArray(rawDecisions) || rawDecisions.length === 0) {
    return [
      {
        id: 'decision-1',
        question: '제시된 채점 기준 외에 학생의 창의적·예외적 접근을 어느 수준까지 허용할지 기준이 정해졌나요?',
        context: '실제 채점 시 판단이 엇갈릴 수 있는 경계 사례를 사전에 정리하면 채점 일관성이 높아집니다.',
        teacherMemo: '',
        resolved: false,
      },
    ];
  }

  return rawDecisions.map((entry, idx) => {
    const obj = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
    return {
      id: `decision-${idx + 1}`,
      question: asNonEmptyString(obj.question, `추가 결정 사항 ${idx + 1}`),
      context: asNonEmptyString(obj.context, '현장 적용 전 교사의 최종 판단이 필요합니다.'),
      teacherMemo: '',
      resolved: false,
    };
  });
}

function normalizeReviewPayload(
  raw: unknown,
  draft: AssessmentDraft,
  modelUsed: string,
): AiReviewResult {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rawInspections =
    data.inspections && typeof data.inspections === 'object'
      ? (data.inspections as Record<string, unknown>)
      : {};
  const rawImprovements =
    data.improvements && typeof data.improvements === 'object'
      ? (data.improvements as Record<string, unknown>)
      : {};

  const inspections: InspectionSections = {
    clarity: normalizeInspectionList(rawInspections.clarity, 'clarity'),
    alignment: normalizeInspectionList(rawInspections.alignment, 'alignment'),
    partialScoreAndExceptions: normalizeInspectionList(
      rawInspections.partialScoreAndExceptions,
      'partial',
    ),
    fairness: normalizeInspectionList(rawInspections.fairness, 'fairness'),
  };

  const partialScoreGuidelines = Array.isArray(rawImprovements.partialScoreGuidelines)
    ? rawImprovements.partialScoreGuidelines
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim())
    : [];

  const improvements: ImprovementProposals = {
    revisedPrompt: asNonEmptyString(rawImprovements.revisedPrompt, draft.promptText),
    revisedCriteria: normalizeRevisedCriteria(rawImprovements.revisedCriteria, draft),
    partialScoreGuidelines:
      partialScoreGuidelines.length > 0
        ? partialScoreGuidelines
        : ['부분점수 부여 경계에 해당하는 구체적 예시 답안을 1~2개 미리 설정해 두는 것이 좋습니다.'],
    teacherDecisions: normalizeDecisions(rawImprovements.teacherDecisions),
  };

  return {
    reviewedAt: new Date().toISOString(),
    modelUsed,
    summary: asNonEmptyString(
      data.summary,
      '입력하신 수행평가 문항과 채점 기준을 4개 영역으로 나누어 점검했습니다.',
    ),
    officialPlanNotice: asNonEmptyString(
      data.officialPlanNotice,
      '본 점검은 교사가 입력한 문항과 채점 기준만을 바탕으로 수행되었으며, 학교 공식 평가계획서와의 일치 여부는 확인하지 않았습니다.',
    ),
    inspections,
    improvements,
  };
}

const inspectionItemSchema = {
  type: Type.OBJECT,
  properties: {
    checkItem: {
      type: Type.STRING,
      description: '점검 항목명 (예: 수행 과제의 명시성, 요구 조건과 기준의 대응 등)',
    },
    finding: {
      type: Type.STRING,
      description:
        "발견된 문제 또는 확인 사항. 문제가 없으면 '특별한 문제 발견되지 않음', 정보가 부족해 판단 불가면 '확인 필요'라고 기재.",
    },
    targetReference: {
      type: Type.STRING,
      description: "관련된 원문 문구 또는 평가 요소명. 해당 사항이 없으면 '해당 없음' 기재.",
    },
    reason: {
      type: Type.STRING,
      description: '해당 항목을 문제 또는 확인 사항으로 판단한 구체적인 이유',
    },
    suggestion: {
      type: Type.STRING,
      description: '교사가 바로 적용할 수 있는 구체적인 개선 제안',
    },
    severity: {
      type: Type.STRING,
      description: "중요도: 반드시 '높음', '보통', '참고' 중 하나",
    },
  },
  required: ['checkItem', 'finding', 'targetReference', 'reason', 'suggestion', 'severity'],
};

const reviewResponseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: '전체 설계 점검 결과에 대한 2~3문장 핵심 요약',
    },
    officialPlanNotice: {
      type: Type.STRING,
      description:
        '공식 평가계획서가 제공되지 않았으므로 입력된 내용 범위에서만 점검했음을 명시하는 안내 문구',
    },
    inspections: {
      type: Type.OBJECT,
      properties: {
        clarity: {
          type: Type.ARRAY,
          items: inspectionItemSchema,
          description: '① 문항 명확성 점검 결과 목록 (2~4개 항목)',
        },
        alignment: {
          type: Type.ARRAY,
          items: inspectionItemSchema,
          description: '② 평가 문항과 채점 기준의 정합성 점검 결과 목록 (2~4개 항목)',
        },
        partialScoreAndExceptions: {
          type: Type.ARRAY,
          items: inspectionItemSchema,
          description: '③ 부분점수 및 예외 사례 점검 결과 목록 (2~4개 항목)',
        },
        fairness: {
          type: Type.ARRAY,
          items: inspectionItemSchema,
          description: '④ 평가 공정성 점검 결과 목록 (2~4개 항목)',
        },
      },
      required: ['clarity', 'alignment', 'partialScoreAndExceptions', 'fairness'],
    },
    improvements: {
      type: Type.OBJECT,
      properties: {
        revisedPrompt: {
          type: Type.STRING,
          description: '점검 결과를 반영해 명확성과 안내를 보완한 수행평가 문항 개선안 전문',
        },
        revisedCriteria: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              criterionId: {
                type: Type.STRING,
                description: '입력된 평가 요소의 id 값을 그대로 유지',
              },
              originalElementName: {
                type: Type.STRING,
                description: '입력된 평가 요소명을 그대로 유지',
              },
              revisedCriteriaText: {
                type: Type.STRING,
                description: '관찰 가능하고 구체적인 수준별 구분이 드러나도록 보완한 세부 채점 기준 초안',
              },
              pointReviewComment: {
                type: Type.STRING,
                description:
                  '배점을 임의로 바꾸지 말고, 배점 조정 검토가 필요한 경우에만 검토 의견으로 제시. 조정이 불필요하면 유지 권장 의견 기재.',
              },
            },
            required: ['criterionId', 'originalElementName', 'revisedCriteriaText', 'pointReviewComment'],
          },
        },
        partialScoreGuidelines: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: '채점 시 부분점수 판단을 일관되게 하기 위해 고려할 실무 지침 3~5가지',
        },
        teacherDecisions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: {
                type: Type.STRING,
                description: 'AI가 대신 확정할 수 없어 교사가 최종 결정해야 할 구체적 질문',
              },
              context: {
                type: Type.STRING,
                description: '해당 결정이 채점 공정성이나 수업 맥락에서 왜 필요한지 간단한 설명',
              },
            },
            required: ['question', 'context'],
          },
        },
      },
      required: [
        'revisedPrompt',
        'revisedCriteria',
        'partialScoreGuidelines',
        'teacherDecisions',
      ],
    },
  },
  required: ['summary', 'officialPlanNotice', 'inspections', 'improvements'],
};

const SYSTEM_INSTRUCTION = `당신은 대한민국 초·중·고등학교 교사의 수행평가 설계를 돕는 교육평가 전문가입니다.
이 도구는 학생 답안을 채점하는 도구가 아니라, 교사가 만든 수행평가 문항과 채점 기준(루브릭)의 설계 품질을 점검하고 보완 초안을 제안하는 전문 보조 시스템입니다.

반드시 다음 원칙을 엄격히 준수하여 한국어로만 응답하십시오:
1. 억지 비판을 금지합니다. 문제가 없는 항목은 반드시 finding에 '특별한 문제 발견되지 않음'이라고 적고, 불필요한 트집을 잡지 마십시오.
2. 입력된 자료만으로 확인할 수 없는 사항(예: 학교 공식 평가계획서 일치 여부, 성취기준 코드 적합성, 차시 운영 시수 등)은 절대 추측으로 검증했다고 주장하지 말고 '확인 필요'로 표시하십시오.
3. officialPlanNotice에는 공식 평가계획서가 제공되지 않았으므로 입력 자료 범위 내에서만 점검했음을 분명히 밝히십시오.
4. 배점, 평가 요소명, 성취기준을 임의로 변경·확정하지 마십시오. 배점 비율이나 요소 통합/분리가 필요하다고 판단되면 개선안에 배점 숫자를 바꾸지 말고 pointReviewComment에 검토 의견으로만 제시하십시오.
5. 모든 제안은 교사가 실제 학교 현장에서 바로 복사·수정하여 적용할 수 있도록 구체적이고 실용적인 한국어 문장으로 작성하십시오.
6. 중요도(severity)는 반드시 '높음', '보통', '참고' 중 하나로 분류하십시오.
   - '높음': 학생 오해 유발, 문항-기준 불일치, 채점 공정성 훼손 위험이 큰 사항
   - '보통': 채점 일관성을 높이기 위해 기준 세분화나 안내 보완이 권장되는 사항
   - '참고': 교사 재량으로 검토하면 좋은 추가 제안 또는 특이사항 없음`;

function buildUserPrompt(draft: AssessmentDraft): string {
  const totalPoints = draft.criteria.reduce((sum, item) => sum + (Number(item.points) || 0), 0);
  const criteriaLines = draft.criteria
    .map(
      (c, idx) =>
        `[${idx + 1}] id: "${c.id}" | 평가 요소: ${c.elementName.trim() || '(미입력)'} | 배점: ${c.points}점\n세부 채점 기준:\n${c.criteriaDescription.trim() || '(미입력)'}`,
    )
    .join('\n\n');

  return `다음은 교사가 작성한 수행평가 설계 초안입니다. 4가지 영역(문항 명확성, 문항-채점 기준 정합성, 부분점수 및 예외 사례, 평가 공정성)을 점검하고, 개선 초안과 교사 결정 질문을 JSON으로 작성해 주세요.

- 교과명: ${draft.subject.trim() || '(미입력)'}
- 수행평가명: ${draft.title.trim()}
- 총 배점 합계: ${totalPoints}점

[수행평가 문항 및 과제 안내문]
${draft.promptText.trim()}

[평가 요소 및 세부 채점 기준]
${criteriaLines}

[교사가 추가로 고민 중인 채점 문제]
${draft.gradingConcerns.trim() || '(별도 입력 없음)'}`;
}

const extractionResponseSchema = {
  type: Type.OBJECT,
  properties: {
    criteria: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          elementName: {
            type: Type.STRING,
            description: '평가 요소명(평가 영역/평가 항목 이름)',
          },
          points: {
            type: Type.NUMBER,
            description: '해당 평가 요소의 배점(숫자). 문서에 배점이 명시되지 않은 경우 0.',
          },
          criteriaDescription: {
            type: Type.STRING,
            description:
              '상/중/하 또는 A/B/C 등 점수 구간별 세부 채점 기준 설명. 수준별로 줄바꿈하여 가독성 있게 정리.',
          },
        },
        required: ['elementName', 'points', 'criteriaDescription'],
      },
    },
    notes: {
      type: Type.STRING,
      description:
        '추출 결과에 대한 참고 안내(예: 배점이 명시되지 않은 항목이 있는 경우, 표 일부가 흐려 확인이 필요한 경우 등). 특이사항이 없으면 빈 문자열 또는 간단한 요약.',
    },
  },
  required: ['criteria', 'notes'],
};

const EXTRACTION_SYSTEM_INSTRUCTION = `당신은 학교 수행평가 채점 기준표(루브릭)를 정확하게 구조화하는 보조 도구입니다.
첨부된 이미지, PDF 또는 텍스트에서 '평가 요소명', '배점(숫자)', '세부 채점 기준'을 빠짐없이 추출하여 JSON으로 반환하십시오.

원칙:
1. 원문에 없는 평가 요소나 채점 기준을 임의로 창작하지 마십시오.
2. 한 표 안에 상/중/하, A/B/C, 또는 점수(예: 10점, 8점, 6점)별 기준이 행이나 열로 나뉘어 있으면, 각 수준을 줄바꿈으로 구분해 하나의 criteriaDescription 문자열에 정리하십시오.
3. 배점이 명시되어 있지 않거나 판독이 어려우면 points를 0으로 두고 notes에 그 사실을 알리십시오.
4. 채점 기준표가 전혀 보이지 않거나 판독할 수 없으면 criteria를 빈 배열([])로 반환하고 notes에 사유를 적으십시오.`;

function normalizeExtractedCriteria(raw: unknown): ExtractedCriteriaResult {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rawList = Array.isArray(data.criteria) ? data.criteria : [];

  const criteria: ExtractedCriterionDraft[] = rawList
    .map((entry, idx) => {
      const obj = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
      const elementName = asNonEmptyString(obj.elementName, '');
      const criteriaDescription = asNonEmptyString(obj.criteriaDescription, '');
      const numPoints = Number(obj.points);
      const points = Number.isFinite(numPoints) && numPoints >= 0 ? numPoints : 0;

      if (!elementName && !criteriaDescription) return null;
      return {
        elementName: elementName || `평가 요소 ${idx + 1}`,
        points,
        criteriaDescription: criteriaDescription || '(세부 채점 기준 확인 필요)',
      };
    })
    .filter((item): item is ExtractedCriterionDraft => item !== null);

  return {
    criteria,
    notes: typeof data.notes === 'string' ? data.notes.trim() : '',
  };
}

export function createGeminiReviewService(config: AiReviewerConfig): AiReviewProvider {
  const model = config.model ?? DEFAULT_FLASH_MODEL;
  const ai = new GoogleGenAI({
    apiKey: config.apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  return {
    model,
    async reviewAssessment(draft: AssessmentDraft): Promise<AiReviewResult> {
      const response = await ai.models.generateContent({
        model,
        contents: buildUserPrompt(draft),
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: reviewResponseSchema,
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        throw new Error('AI 응답이 비어 있습니다. 입력 내용을 확인한 후 다시 시도해 주세요.');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        throw new Error(
          'AI 응답을 구조화된 결과로 해석하는 데 실패했습니다. 잠시 후 다시 시도해 주세요.',
        );
      }

      return normalizeReviewPayload(parsed, draft, model);
    },

    async extractCriteriaFromSource(
      source: CriteriaExtractionRequest,
    ): Promise<ExtractedCriteriaResult> {
      const instructionText =
        '첨부된 자료에서 수행평가의 평가 요소명, 배점, 세부 채점 기준을 구조화된 JSON으로 추출해 주세요.';

      const contents =
        source.kind === 'file' && source.base64Data
          ? {
              parts: [
                {
                  inlineData: {
                    mimeType: source.mimeType,
                    data: source.base64Data,
                  },
                },
                { text: instructionText },
              ],
            }
          : `${instructionText}\n\n[첨부 텍스트 자료${source.fileName ? ` (${source.fileName})` : ''}]\n${(source.textContent ?? '').trim()}`;

      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: EXTRACTION_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: extractionResponseSchema,
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        throw new Error('AI 응답이 비어 있습니다. 다른 이미지나 파일로 다시 시도해 주세요.');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        throw new Error('추출 결과를 해석하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }

      return normalizeExtractedCriteria(parsed);
    },
  };
}
