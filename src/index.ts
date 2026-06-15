export { IFCClient } from "./client/IFCClient";

export type { ConnectionManifest } from "./connection/ConnectionManifest";
export type { ConnectionStatus } from "./connection/ConnectionStatus";
export type { IFCClientOptions } from "./types/client";

export type { StateAccess, StateDefinition, StateValue } from "./types/states";

export {
	IFCNodeError,
	ConnectionError,
	ConnectionTimeoutError,
	ConnectionValidationError,
	NotConnectedError,
	UnknownStateError,
	StateReadOnlyError,
	StateWriteOnlyError,
	InvalidStateValueError,
} from "./errors";

export const ValueConverters = {
	throttleToPercent(raw: number): number {
		return ((1000 - raw) / 2000) * 100;
	},

	percentToThrottle(percent: number): number {
		const clamped = Math.max(0, Math.min(100, percent));
		return Math.round(1000 - clamped * 20);
	},

	fpmToMpm(fpm: number): number {
		return fpm * 0.3048;
	},

	mpmToFpm(mpm: number): number {
		return mpm / 0.3048;
	},
};
