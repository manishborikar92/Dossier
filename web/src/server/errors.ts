export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
export const notFound = (what: string) => new HttpError(404, `${what} was not found`);
export const badRequest = (message: string, fields?: Record<string, string>) => new HttpError(400, message, fields);
export const conflict = (message: string) => new HttpError(409, message);
