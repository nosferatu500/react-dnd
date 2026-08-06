export interface Ref<T> {
	current: T
}

export function isRef(obj: unknown): boolean {
	return (
		obj !== null && typeof obj === 'object' && Object.hasOwn(obj, 'current')
	)
}
