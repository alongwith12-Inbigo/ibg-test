export type SeverityLevel = '높음' | '보통' | '참고';

export interface RubricCriterion {
  id: string;
  elementName: string;
  points: number;
  criteriaDescription: string;
}

export interface AssessmentDraft {
  subject: string;
  title: string;
  promptText: string;
  criteria: RubricCriterion[];
  gradingConcerns: string;
}

export type InspectionCategoryKey =
  | 'clarity'
  | 'alignment'
  | 'partialScoreAndExceptions'
  | 'fairness';

export interface InspectionItem {
  id: string;
  checkItem: string;
  finding: string;
  targetReference: string;
  reason: string;
  suggestion: string;
  severity: SeverityLevel;
}

export interface InspectionSections {
  clarity: InspectionItem[];
  alignment: InspectionItem[];
  partialScoreAndExceptions: InspectionItem[];
  fairness: InspectionItem[];
}

export interface RevisedCriterionProposal {
  criterionId: string;
  originalElementName: string;
  currentPoints: number;
  revisedCriteriaText: string;
  pointReviewComment: string;
}

export interface TeacherDecisionItem {
  id: string;
  question: string;
  context: string;
  teacherMemo: string;
  resolved: boolean;
}

export interface ImprovementProposals {
  revisedPrompt: string;
  revisedCriteria: RevisedCriterionProposal[];
  partialScoreGuidelines: string[];
  teacherDecisions: TeacherDecisionItem[];
}

export interface AiReviewResult {
  reviewedAt: string;
  modelUsed: string;
  summary: string;
  officialPlanNotice: string;
  inspections: InspectionSections;
  improvements: ImprovementProposals;
}

export interface LocalWorkspaceState {
  version: number;
  updatedAt: string;
  draft: AssessmentDraft;
  aiResult: AiReviewResult | null;
  lastError: string | null;
}

export interface ProjectExportData {
  app: 'ai-performance-assessment-reviewer';
  version: 1;
  exportedAt: string;
  draft: AssessmentDraft;
  aiResult: AiReviewResult | null;
}

export interface CriteriaExtractionRequest {
  kind: 'file' | 'text';
  mimeType: string;
  fileName?: string;
  base64Data?: string;
  textContent?: string;
}

export interface ExtractedCriterionDraft {
  elementName: string;
  points: number;
  criteriaDescription: string;
}

export interface ExtractedCriteriaResult {
  criteria: ExtractedCriterionDraft[];
  notes: string;
}

