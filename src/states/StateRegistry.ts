import { StateDefinition } from "../types/states";
import { StateWriteOnlyError, StateReadOnlyError } from "../errors";

export class StateRegistry {
	private readonly states = new Map<string, StateDefinition>();

	public constructor(definitions: StateDefinition[] = []) {
		for (const definition of definitions) {
			this.states.set(definition.path, definition);
		}
	}

	public get(path: string): StateDefinition | undefined {
		return this.states.get(path);
	}

	public assertReadable(path: string): void {
		const definition = this.states.get(path);

		if (definition?.access === "write-only") {
			throw new StateWriteOnlyError(path);
		}
	}

	public assertWritable(path: string): void {
		const definition = this.states.get(path);

		if (definition?.access === "read-only") {
			throw new StateReadOnlyError(path);
		}
	}
}
