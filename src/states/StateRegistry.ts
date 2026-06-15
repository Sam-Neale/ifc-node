import { StateDefinition } from "../types/states";
import { StateWriteOnlyError, StateReadOnlyError } from "../errors";

/**
 * Lookup table for local state metadata.
 *
 * The registry does not try to replace the live Infinite Flight manifest.
 * Instead, it adds optional local guardrails for known read-only and write-only
 * paths before a request reaches the protocol layer.
 */
export class StateRegistry {
	private readonly states = new Map<string, StateDefinition>();

	/**
	 * Build a registry from local state definitions.
	 */
	public constructor(definitions: StateDefinition[] = []) {
		for (const definition of definitions) {
			this.states.set(definition.path, definition);
		}
	}

	/**
	 * Return local metadata for a state path, if known.
	 */
	public get(path: string): StateDefinition | undefined {
		return this.states.get(path);
	}

	/**
	 * Throw when local metadata says the state cannot be read.
	 */
	public assertReadable(path: string): void {
		const definition = this.states.get(path);

		if (definition?.access === "write-only") {
			throw new StateWriteOnlyError(path);
		}
	}

	/**
	 * Throw when local metadata says the state cannot be written.
	 */
	public assertWritable(path: string): void {
		const definition = this.states.get(path);

		if (definition?.access === "read-only") {
			throw new StateReadOnlyError(path);
		}
	}
}
