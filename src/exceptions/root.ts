export class HttpException extends Error {
  message: string;
  errorCode: any;
  statusCode: number;
  errors: ErrorCode;

  constructor(
    message: string,
    errorCode: ErrorCode,
    statusCode: number,
    error: any
  ) {
    super(message);
    this.message = message;
    this.errorCode = errorCode;
    this.statusCode = statusCode;
    this.errors = error;
  }
}

export enum ErrorCode {
  OUTLET_NOT_FOUND = 1001,
  NOT_FOUND = 2001,
  INCORRECT_PASSWORD = 2002,
  UNPROCESSABLE_ENTITY = 3001,
  INTERNAL_EXCEPTION = 4001,
  UNAUTHORIZED = 5001,
  TOKENS_NOT_VALID = 6001,
}
