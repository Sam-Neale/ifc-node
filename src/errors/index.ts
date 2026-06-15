/**
 * Base error for package-specific failures.
 */
export class IFCNodeError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = new.target.name;
	}
}

/**
 * Base error for connection lifecycle failures.
 */
export class ConnectionError extends IFCNodeError {}

/**
 * Raised when a connection attempt exceeds the configured timeout.
 */
export class ConnectionTimeoutError extends ConnectionError {
	public constructor(timeout: number) {
		super(`The connection attempt timed out after ${timeout}ms.`);
	}
}

/**
 * Raised when a socket connects but validation reads do not prove that the
 * remote endpoint is a usable Infinite Flight session.
 */
export class ConnectionValidationError extends ConnectionError {
	public constructor(
		message = "Could not verify the Infinite Flight connection.",
	) {
		super(message);
	}
}

/**
 * Raised when a read, write, command, or manifest access happens before the
 * client is connected.
 */
export class NotConnectedError extends ConnectionError {
	public constructor() {
		super("The client is not connected to Infinite Flight.");
	}
}

/**
 * Raised when local metadata knows nothing about a requested state path.
 */
export class UnknownStateError extends IFCNodeError {
	public constructor(public readonly path: string) {
		super(`Unknown Connect API state: ${path}`);
	}
}

/**
 * Raised when attempting to write a state known to be read-only.
 */
export class StateReadOnlyError extends IFCNodeError {
	public constructor(public readonly path: string) {
		super(`Cannot write to read-only state: ${path}`);
	}
}

/**
 * Raised when attempting to read a state known to be write-only.
 */
export class StateWriteOnlyError extends IFCNodeError {
	public constructor(public readonly path: string) {
		super(`Cannot read from write-only state: ${path}`);
	}
}

/**
 * Raised when a state is unavailable.
 */
export class StateNotFoundError extends IFCNodeError {
	public constructor(public readonly path: string) {
		super(`State does not exist or is unavailable: ${path}`);
	}
}

/**
 * Raised when a state read fails.
 */
export class StateReadFailedError extends IFCNodeError {
	public constructor(public readonly path: string) {
		super(`Could not read state: ${path}`);
	}
}

/**
 * Raised when a state write fails.
 */
export class StateWriteFailedError extends IFCNodeError {
	public constructor(public readonly path: string) {
		super(`Could not write state: ${path}`);
	}
}

/**
 * Raised when a state write receives a value that does not match the expected
 * Connect API data type.
 */
export class InvalidStateValueError extends IFCNodeError {
	public constructor(
		public readonly path: string,
		public readonly expectedType: string,
		public readonly receivedValue: unknown,
	) {
		super(`Invalid value for "${path}". Expected ${expectedType}.`);
	}
}

/**
 * Raised when automatic UDP discovery does not find a valid Infinite Flight
 * device in time.
 */
export class DiscoveryTimeoutError extends IFCNodeError {
	public constructor(timeout: number) {
		super(`No Infinite Flight device was discovered within ${timeout}ms.`);
	}
}

/**
 * Raised when an Infinite Flight discovery packet is malformed.
 */
export class InvalidDiscoveryPacketError extends IFCNodeError {
	public constructor() {
		super("Received an invalid Infinite Flight discovery packet.");
	}
}
