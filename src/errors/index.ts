export class IFCNodeError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = new.target.name;
	}
}

export class ConnectionError extends IFCNodeError {}

export class ConnectionTimeoutError extends ConnectionError {
	public constructor(timeout: number) {
		super(`The connection attempt timed out after ${timeout}ms.`);
	}
}

export class ConnectionValidationError extends ConnectionError {
	public constructor(
		message = "Could not verify the Infinite Flight connection.",
	) {
		super(message);
	}
}

export class NotConnectedError extends ConnectionError {
	public constructor() {
		super("The client is not connected to Infinite Flight.");
	}
}

export class UnknownStateError extends IFCNodeError {
	public constructor(public readonly path: string) {
		super(`Unknown Connect API state: ${path}`);
	}
}

export class StateReadOnlyError extends IFCNodeError {
	public constructor(public readonly path: string) {
		super(`Cannot write to read-only state: ${path}`);
	}
}

export class StateWriteOnlyError extends IFCNodeError {
	public constructor(public readonly path: string) {
		super(`Cannot read from write-only state: ${path}`);
	}
}

export class StateNotFoundError extends IFCNodeError {
	public constructor(public readonly path: string) {
		super(`State does not exist or is unavailable: ${path}`);
	}
}

export class StateReadFailedError extends IFCNodeError {
	public constructor(public readonly path: string) {
		super(`Could not read state: ${path}`);
	}
}

export class StateWriteFailedError extends IFCNodeError {
	public constructor(public readonly path: string) {
		super(`Could not write state: ${path}`);
	}
}

export class InvalidStateValueError extends IFCNodeError {
	public constructor(
		public readonly path: string,
		public readonly expectedType: string,
		public readonly receivedValue: unknown,
	) {
		super(`Invalid value for "${path}". Expected ${expectedType}.`);
	}
}

export class DiscoveryTimeoutError extends IFCNodeError {
	public constructor(timeout: number) {
		super(`No Infinite Flight device was discovered within ${timeout}ms.`);
	}
}

export class InvalidDiscoveryPacketError extends IFCNodeError {
	public constructor() {
		super("Received an invalid Infinite Flight discovery packet.");
	}
}
