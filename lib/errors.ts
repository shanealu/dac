export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("VALIDATION", message, 422, details);
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id?: string) {
    super("NOT_FOUND", `${resource} not found${id ? `: ${id}` : ""}`, 404);
  }
}

export class InsufficientBalanceError extends DomainError {
  constructor(metal: string, requested: string, available: string) {
    super(
      "INSUFFICIENT_BALANCE",
      `Insufficient ${metal} balance: requested ${requested}kg, available ${available}kg`,
      422,
      { metal, requested, available },
    );
  }
}

export class BarOwnershipError extends DomainError {
  constructor() {
    // Generic message — don't leak whether the bar exists for another account.
    super("BAR_NOT_FOUND_FOR_ACCOUNT", "Bar not available for withdrawal from this account", 404);
  }
}

export class BarAlreadyWithdrawnError extends DomainError {
  constructor(serial: string) {
    super("BAR_ALREADY_WITHDRAWN", `Bar ${serial} has already been withdrawn`, 409, { serial });
  }
}

export class DuplicateSerialError extends DomainError {
  constructor(serial: string) {
    super("DUPLICATE_BAR_SERIAL", `A bar with serial number "${serial}" already exists`, 409, {
      serial,
    });
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("CONFLICT", message, 409, details);
  }
}
