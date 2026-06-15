/**
 * Coarse-grained connection lifecycle status.
 */
export type ConnectionStatus =
	| "disconnected"
	| "connecting"
	| "validating"
	| "connected";
