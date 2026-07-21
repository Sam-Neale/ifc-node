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

/**
 * Helpers for converting between Infinite Flight's simulator-facing values and
 * more conventional application-facing units.
 *
 * Some Connect API states use non-standard ranges or units. For example, raw
 * throttle values are not represented as a 0-100 percentage. Keeping these
 * conversions named and centralized makes application code easier to read and
 * avoids scattering protocol-specific constants through consumers.
 */
export const ValueConverters = {
	/**
	 * Convert Infinite Flight's raw throttle value into a user-facing percentage.
	 *
	 * @param raw Raw throttle value from the Connect API.
	 * @returns Throttle percentage, where 0 is idle and 100 is full thrust.
	 */
	throttleToPercent(raw: number): number {
		return ((1000 - raw) / 2000) * 100;
	},

	/**
	 * Convert a user-facing throttle percentage into Infinite Flight's raw
	 * throttle value.
	 *
	 * Input is clamped to the 0-100 range before conversion.
	 *
	 * @param percent Throttle percentage.
	 * @returns Raw throttle value suitable for supported Connect API throttle states.
	 */
	percentToThrottle(percent: number): number {
		const clamped = Math.max(0, Math.min(100, percent));
		return Math.round(1000 - clamped * 20);
	},

	/**
	 * Convert feet per minute to metres per minute.
	 *
	 * @param fpm Vertical speed in feet per minute.
	 * @returns Vertical speed in metres per minute.
	 */
	fpmToMpm(fpm: number): number {
		return fpm * 0.3048;
	},

	/**
	 * Convert feet per minute to metres per second.
	 *
	 * @param fpm Vertical speed in feet per minute.
	 * @returns Vertical speed in metres per second.
	 */
	fpmToMps(fpm: number): number {
		return fpm * 0.00508;
	},

	/**
	 * Convert metres per second to feet per minute.
	 *
	 * @param mps Vertical speed in metres per second.
	 * @returns Vertical speed in feet per minute.
	 */
	mpsToFpm(mps: number): number {
		return mps / 0.00508;
	},

	/**
	 * Convert knots to metres per second.
	 *
	 * @param kts Speed in knots.
	 * @returns Speed in metres per second.
	 */
	ktsToMps(kts: number): number {
		return kts * 0.514444;
	},

	/**
	 * Convert metres per second to knots.
	 *
	 * @param mps Speed in metres per second.
	 * @returns Speed in knots.
	 */
	mpsToKts(mps: number): number {
		return mps / 0.514444;
	},

	/**
	 * Convert radians to degrees.
	 *
	 * @param rad Radians to convert.
	 * @returns Degrees.
	 */
	radToDeg(rad: number): number {
		return rad * (180 / Math.PI);
	},

	/**
	 * Convert degrees to radians.
	 *
	 * @param deg Degrees to convert.
	 * @returns Radians.
	 */
	degToRad(deg: number): number {
		return deg * (Math.PI / 180);
	},

	/**
	 * Convert metres per minute to feet per minute.
	 *
	 * @param mpm Vertical speed in metres per minute.
	 * @returns Vertical speed in feet per minute.
	 */
	mpmToFpm(mpm: number): number {
		return mpm / 0.3048;
	},
};
