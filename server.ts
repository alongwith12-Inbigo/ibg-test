import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { createGeminiReviewService } from './server/aiReviewService.ts';
import type {
  AssessmentDraft,
  CriteriaExtractionRequest,
} from './src/types/assessment.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function validateDraftInput(body: unknown): { ok: true; draft: AssessmentDraft } | { ok: false; message: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: '요청 형식이 올바르지 않습니다.' };
  }

  const raw = body as Record<string, unknown>;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const promptText = typeof raw.promptText === 'string' ? raw.promptText.trim() : '';
  const subject = typeof raw.subject === 'string' ? raw.subject.trim() : '';
  const gradingConcerns = typeof raw.gradingConcerns === 'string' ? raw.gradingConcerns.trim() : '';
  const rawCriteria = Array.isArray(raw.criteria) ? raw.criteria : [];

  if (!title) {
    return { ok: false, message: '수행평가명을 입력한 뒤 점검을 실행해 주세요.' };
  }
  if (promptText.length < 10) {
    return { ok: false, message: '수행평가 문항 및 과제 안내문을 10자 이상 입력해 주세요.' };
  }
  if (rawCriteria.length === 0) {
    return { ok: false, message: '최소 1개 이상의 평가 요소와 채점 기준을 입력해 주세요.' };
  }

  const criteria = rawCriteria.map((item, idx) => {
    const obj = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const pointsNum = Number(obj.points);
    return {
      id: typeof obj.id === 'string' && obj.id.trim() ? obj.id.trim() : `criterion-${idx + 1}`,
      elementName: typeof obj.elementName === 'string' ? obj.elementName.trim() : '',
      points: Number.isFinite(pointsNum) && pointsNum >= 0 ? pointsNum : 0,
      criteriaDescription:
        typeof obj.criteriaDescription === 'string' ? obj.criteriaDescription.trim() : '',
    };
  });

  const hasEmptyCriterion = criteria.some((c) => !c.elementName || !c.criteriaDescription);
  if (hasEmptyCriterion) {
    return {
      ok: false,
      message: '모든 평가 요소의 이름과 세부 채점 기준을 입력한 뒤 점검을 실행해 주세요.',
    };
  }

  return {
    ok: true,
    draft: {
      subject,
      title,
      promptText,
      criteria,
      gradingConcerns,
    },
  };
}

function mapGeminiErrorMessage(err: unknown): { status: number; message: string } {
  const errObj = (err && typeof err === 'object' ? err : {}) as Record<string, unknown>;
  const httpStatus = typeof errObj.status === 'number' ? errObj.status : 0;
  const rawMsg = err instanceof Error ? err.message : String(err);
  const lower = rawMsg.toLowerCase();

  if (
    httpStatus === 403 ||
    httpStatus === 401 ||
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied') ||
    lower.includes('403')
  ) {
    return {
      status: 502,
      message:
        '서버의 Gemini API 키가 유효하지 않거나 권한이 없습니다. AI Studio의 Secrets 패널에서 GEMINI_API_KEY를 확인해 주세요.',
    };
  }
  if (httpStatus === 429 || lower.includes('resource_exhausted') || lower.includes('429')) {
    return {
      status: 429,
      message: 'API 호출 한도를 초과했습니다. 잠시 기다린 후 다시 시도해 주세요.',
    };
  }
  if (httpStatus === 404 || lower.includes('not_found') || lower.includes('404')) {
    return {
      status: 502,
      message: '요청한 Gemini 모델을 찾을 수 없습니다. 서버 모델 설정을 확인해 주세요.',
    };
  }
  if (httpStatus === 400 || lower.includes('invalid_argument')) {
    return {
      status: 502,
      message: 'AI 요청 형식이 올바르지 않습니다. 입력 내용을 확인한 후 다시 시도해 주세요.',
    };
  }
  if (httpStatus === 503 || lower.includes('unavailable') || lower.includes('high demand')) {
    return {
      status: 503,
      message:
        '현재 AI 서버 요청이 일시적으로 많아 점검을 완료하지 못했습니다. 입력하신 내용은 그대로 보존되었으니 잠시 후 다시 실행해 주세요.',
    };
  }
  if (lower.includes('fetch failed') || lower.includes('enotfound') || lower.includes('econnrefused')) {
    return {
      status: 502,
      message: '외부 AI 서버에 연결하지 못했습니다. 네트워크 연결 또는 실행 환경을 확인해 주세요.',
    };
  }
  if (rawMsg.includes('AI 응답')) {
    return { status: 502, message: rawMsg };
  }

  return {
    status: 500,
    message:
      'AI 설계 점검 중 일시적인 오류가 발생했습니다. 입력하신 내용은 그대로 보존되었으니 잠시 후 다시 시도해 주세요.',
  };
}

const ALLOWED_BINARY_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

const ALLOWED_TEXT_MIMES = new Set([
  'text/plain',
  'text/csv',
  'text/markdown',
  'text/tab-separated-values',
]);

const MAX_BASE64_CHARS = 14 * 1024 * 1024; // ~10.5MB raw binary
const MAX_TEXT_CHARS = 120_000;

function validateExtractionInput(
  body: unknown,
): { ok: true; source: CriteriaExtractionRequest } | { ok: false; message: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: '요청 형식이 올바르지 않습니다.' };
  }

  const raw = body as Record<string, unknown>;
  const kind = raw.kind === 'file' || raw.kind === 'text' ? raw.kind : null;
  const mimeType = typeof raw.mimeType === 'string' ? raw.mimeType.trim().toLowerCase() : '';
  const fileName = typeof raw.fileName === 'string' ? raw.fileName.trim().slice(0, 120) : undefined;

  if (!kind) {
    return { ok: false, message: '추출 대상 형식을 확인할 수 없습니다.' };
  }

  if (kind === 'file') {
    if (!ALLOWED_BINARY_MIMES.has(mimeType)) {
      return {
        ok: false,
        message: '지원하지 않는 파일 형식입니다. 이미지(PNG, JPG, WEBP, GIF) 또는 PDF 파일을 첨부해 주세요.',
      };
    }
    const base64Data = typeof raw.base64Data === 'string' ? raw.base64Data.trim() : '';
    if (!base64Data) {
      return { ok: false, message: '첨부된 파일 데이터가 비어 있습니다.' };
    }
    if (base64Data.length > MAX_BASE64_CHARS) {
      return {
        ok: false,
        message: '파일 크기가 너무 큽니다. 10MB 이하의 이미지 또는 PDF 파일을 첨부해 주세요.',
      };
    }
    return {
      ok: true,
      source: {
        kind: 'file',
        mimeType,
        fileName,
        base64Data,
      },
    };
  }

  const textMime = ALLOWED_TEXT_MIMES.has(mimeType) ? mimeType : 'text/plain';
  const textContent = typeof raw.textContent === 'string' ? raw.textContent.trim() : '';
  if (!textContent) {
    return { ok: false, message: '추출할 텍스트 내용이 비어 있습니다.' };
  }
  if (textContent.length > MAX_TEXT_CHARS) {
    return {
      ok: false,
      message: '텍스트 분량이 너무 큽니다. 채점 기준표 부분만 잘라서 첨부해 주세요.',
    };
  }

  return {
    ok: true,
    source: {
      kind: 'text',
      mimeType: textMime,
      fileName,
      textContent,
    },
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      mode: process.env.GEMINI_API_KEY ? 'configured' : 'missing_key',
    });
  });

  // Explicit user-triggered AI review endpoint (single call, no automatic retry)
  app.post('/api/review', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error:
          '서버에 GEMINI_API_KEY가 설정되어 있지 않습니다. Google AI Studio Secrets 설정을 확인해 주세요.',
      });
      return;
    }

    const validation = validateDraftInput(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.message });
      return;
    }

    try {
      const reviewer = createGeminiReviewService({ apiKey });
      const result = await reviewer.reviewAssessment(validation.draft);
      res.json({ result });
    } catch (error) {
      const safeDetail = (error instanceof Error ? error.message : String(error)).slice(0, 300);
      console.error('[AI Review Error]', safeDetail);
      const mapped = mapGeminiErrorMessage(error);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // Explicit user-triggered rubric criteria extraction endpoint (single call, no automatic retry)
  app.post('/api/extract-criteria', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error:
          '서버에 GEMINI_API_KEY가 설정되어 있지 않습니다. Google AI Studio Secrets 설정을 확인해 주세요.',
      });
      return;
    }

    const validation = validateExtractionInput(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.message });
      return;
    }

    try {
      const reviewer = createGeminiReviewService({ apiKey });
      const extracted = await reviewer.extractCriteriaFromSource(validation.source);
      res.json({ extracted });
    } catch (error) {
      const safeDetail = (error instanceof Error ? error.message : String(error)).slice(0, 300);
      console.error('[Criteria Extraction Error]', safeDetail);
      const mapped = mapGeminiErrorMessage(error);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  if (!IS_PRODUCTION) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
