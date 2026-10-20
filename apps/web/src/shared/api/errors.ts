export type ProblemDetails = {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
  errors?: unknown;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string;
  readonly errors?: unknown;

  constructor(status: number, code: string, detail: string, errors?: unknown) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.errors = errors;
  }
}

const STATUS_CODES: Record<number, string> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  413: 'payload_too_large',
  415: 'unsupported_media_type',
  422: 'validation_error',
  429: 'rate_limited',
  500: 'internal_error',
};

export function statusCodeFor(status: number): string {
  return STATUS_CODES[status] ?? 'http_error';
}

async function readProblem(response: Response): Promise<ProblemDetails> {
  try {
    return (await response.json()) as ProblemDetails;
  } catch {
    return {};
  }
}

export async function toApiError(response: Response): Promise<ApiError> {
  const problem = await readProblem(response);
  const code = problem.code ?? statusCodeFor(response.status);
  const detail = problem.detail ?? `HTTP ${response.status}`;

  return new ApiError(response.status, code, detail, problem.errors);
}

export async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
}
