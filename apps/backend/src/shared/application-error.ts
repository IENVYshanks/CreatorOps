export class ApplicationError extends Error {
  public readonly details: unknown;

  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'ApplicationError';
    this.details = details;
  }
}
