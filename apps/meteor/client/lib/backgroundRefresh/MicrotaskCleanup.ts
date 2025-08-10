import { getConfig } from '../utils/getConfig';

const debug = !!(getConfig('debug') || getConfig('debug-MicrotaskCleanup'));

export class MicrotaskQueueCleanup {
	private pendingMicrotasks = new Set<() => void>();
	private originalQueueMicrotask?: typeof queueMicrotask;

	constructor() {
		this.interceptMicrotaskQueue();
	}

	private interceptMicrotaskQueue(): void {
		// Monkey patch queueMicrotask để track pending tasks
		if (typeof window !== 'undefined' && window.queueMicrotask) {
			this.originalQueueMicrotask = window.queueMicrotask.bind(window);
			
			window.queueMicrotask = (callback: () => void) => {
				// Track pending microtask
				this.pendingMicrotasks.add(callback);
				
				// Wrap callback để auto-remove khi executed
				const wrappedCallback = () => {
					try {
						callback();
					} finally {
						this.pendingMicrotasks.delete(callback);
					}
				};
				
				// Queue the wrapped callback
				this.originalQueueMicrotask!(wrappedCallback);
			};
			
			debug && console.log('[MicrotaskCleanup] Intercepted queueMicrotask');
		}
	}

	public async drainMicrotaskQueue(): Promise<void> {
		debug && console.log('[MicrotaskCleanup] Draining microtask queue');
		
		// Wait for all pending microtasks to complete
		let attempts = 0;
		const maxAttempts = 10;
		
		while (this.pendingMicrotasks.size > 0 && attempts < maxAttempts) {
			await new Promise(resolve => setTimeout(resolve, 10));
			attempts++;
		}
		
		if (this.pendingMicrotasks.size > 0) {
			debug && console.warn(`[MicrotaskCleanup] ${this.pendingMicrotasks.size} microtasks still pending after drain`);
		}
	}

	public clearPendingMicrotasks(): void {
		const count = this.pendingMicrotasks.size;
		this.pendingMicrotasks.clear();
		
		debug && console.log(`[MicrotaskCleanup] Cleared ${count} pending microtasks`);
	}

	public async performMicrotaskCleanup(): Promise<void> {
		debug && console.log('[MicrotaskCleanup] Starting microtask cleanup');
		
		try {
			// Method 1: Drain existing microtasks
			await this.drainMicrotaskQueue();
			
			// Method 2: Force flush microtask queue using Promise
			await this.flushMicrotaskQueue();
			
			// Method 3: Clear any remaining tracked microtasks
			this.clearPendingMicrotasks();
			
			debug && console.log('[MicrotaskCleanup] Microtask cleanup completed');
			
		} catch (error) {
			console.warn('[MicrotaskCleanup] Cleanup failed:', error);
		}
	}

	private async flushMicrotaskQueue(): Promise<void> {
		// Force flush the microtask queue by creating a resolved promise
		// This ensures all queued microtasks execute before proceeding
		await Promise.resolve();
		await Promise.resolve(); // Double await to ensure thorough flush
	}

	public getMicrotaskStats() {
		return {
			pendingMicrotasks: this.pendingMicrotasks.size,
			isIntercepted: !!this.originalQueueMicrotask,
			queueType: typeof window !== 'undefined' && window.queueMicrotask ? 'native' : 'polyfill',
		};
	}

	// Reset method for emergency situations
	public resetMicrotaskQueue(): void {
		debug && console.warn('[MicrotaskCleanup] Resetting microtask queue to original state');
		
		if (this.originalQueueMicrotask && typeof window !== 'undefined') {
			window.queueMicrotask = this.originalQueueMicrotask;
			this.originalQueueMicrotask = undefined;
		}
		
		this.pendingMicrotasks.clear();
	}
}