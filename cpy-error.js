export default class CpyError extends Error {
	constructor(message, {cause} = {}) {
		super(message, {cause});
		Object.assign(this, cause);
		this.name = 'CpyError';
	}
}
