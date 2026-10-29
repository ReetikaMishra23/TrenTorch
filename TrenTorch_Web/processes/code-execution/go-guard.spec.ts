import { describe, expect, it } from 'vitest';
import { GO_INSTANCE_USES, diedOf, guardGo, type RunGo } from './go-guard';

function setup(make: (n: number) => RunGo) {
	let started = 0;
	let stderr = '';
	const guard = guardGo({
		start: async () => make(++started),
		stderr: () => stderr,
		clearStderr: () => (stderr = '')
	});
	return { guard, started: () => started, say: (t: string) => (stderr += t) };
}

describe('guardGo', () => {
	it('reuses one instance, and replaces it before it has served too many evaluations', async () => {
		const s = setup((n) => () => ({ output: `instance ${n}`, error: null }));
		for (let i = 0; i < GO_INSTANCE_USES; i++) await s.guard.run('x');
		expect(s.started()).toBe(1);
		const next = await s.guard.run('x');
		expect(s.started()).toBe(2);
		expect(next).toEqual({ output: 'instance 2', error: null });
	});

	it('a runtime failure is retried on a fresh instance', async () => {
		let sayDeath: () => void = () => {};
		const s = setup((n) => () => {
			if (n === 1) {
				sayDeath();
				throw new Error('Go program has already exited');
			}
			return { output: 'ok', error: null };
		});
		sayDeath = () => s.say('fatal error: found bad pointer in Go heap');
		expect(await s.guard.run('x')).toEqual({ output: 'ok', error: null });
		expect(s.started()).toBe(2);
	});

	it('an interpreter panic on the code is reported with its reason and not retried', async () => {
		let sayDeath: () => void = () => {};
		const s = setup(() => () => {
			sayDeath();
			return undefined as never;
		});
		sayDeath = () =>
			s.say('panic: 2:36: incomplete type undefinedThing [recovered]\n\tpanic: other');
		const outcome = await s.guard.run('x');
		expect(diedOf(outcome) && outcome.reason).toBe('2:36: incomplete type undefinedThing');
		expect(s.started()).toBe(1);
		// The dead instance is not used again.
		await s.guard.run('y');
		expect(s.started()).toBe(2);
	});

	it('gives up with no reason when fresh instances keep dying', async () => {
		const s = setup(() => () => undefined as never);
		const outcome = await s.guard.run('x');
		expect(diedOf(outcome) && outcome.reason).toBeNull();
		expect(s.started()).toBe(3);
	});
});
