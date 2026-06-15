export type StateAccess = "read-only" | "write-only" | "read-write" | "unknown";

export type StateValue = boolean | number | string | bigint;
export interface StateDefinition {
	path: string;
	access: StateAccess;
	dataType?: string;
}
