/**
 * HTTP status codes used across the API.
 * SRP: constants only — no logic.
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
} as const;

export type HttpStatusCode = (typeof HttpStatus)[keyof typeof HttpStatus];

export const AppRoles = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  MR: 'MR',
} as const;

export type AppRole = (typeof AppRoles)[keyof typeof AppRoles];

export const UserStatuses = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export type UserStatus = (typeof UserStatuses)[keyof typeof UserStatuses];

export const AppointmentStatuses = {
  REQUESTED: 'REQUESTED',
  CONFIRMED: 'CONFIRMED',
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  VISITED: 'VISITED',
  NO_SHOW: 'NO_SHOW',
  CANCELLED: 'CANCELLED',
  RESCHEDULED: 'RESCHEDULED',
} as const;

export type AppointmentStatus = (typeof AppointmentStatuses)[keyof typeof AppointmentStatuses];

export const RecordStatuses = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export type RecordStatus = (typeof RecordStatuses)[keyof typeof RecordStatuses];

export const StockTxnTypes = {
  OPENING: 'OPENING',
  RECEIPT: 'RECEIPT',
  TRANSFER: 'TRANSFER',
  ISSUE: 'ISSUE',
  SAMPLE_GIVEN: 'SAMPLE_GIVEN',
  GIFT_GIVEN: 'GIFT_GIVEN',
  SALE: 'SALE',
  RETURN: 'RETURN',
  EXPIRY_WRITEOFF: 'EXPIRY_WRITEOFF',
  ADJUSTMENT: 'ADJUSTMENT',
  LOST: 'LOST',
} as const;

export type StockTxnType = (typeof StockTxnTypes)[keyof typeof StockTxnTypes];

export const HolderTypes = {
  WAREHOUSE: 'WAREHOUSE',
  USER: 'USER',
  DOCTOR: 'DOCTOR',
  CHEMIST: 'CHEMIST',
} as const;

export type HolderType = (typeof HolderTypes)[keyof typeof HolderTypes];

export const AttendanceStatuses = {
  PRESENT: 'PRESENT',
  LATE: 'LATE',
  ABSENT: 'ABSENT',
  LEAVE: 'LEAVE',
  HOLIDAY: 'HOLIDAY',
  OFFICE: 'OFFICE',
  JOINT_WORK: 'JOINT_WORK',
  FLAGGED: 'FLAGGED',
} as const;

export type AttendanceStatus = (typeof AttendanceStatuses)[keyof typeof AttendanceStatuses];

export const TOKEN_TYPES = {
  ACCESS: 'access',
  REFRESH: 'refresh',
} as const;
