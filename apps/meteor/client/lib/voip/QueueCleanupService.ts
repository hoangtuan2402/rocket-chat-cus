import { QueueAggregator } from './QueueAggregator';
import { getConfig } from '../utils/getConfig';

const debug = !!(getConfig('debug') || getConfig('debug-VoIPCleanup'));

class VoIPQueueCleanupService {
	private queueAggregator?: QueueAggregator;

	constructor() {
		this.setupEventListeners();
	}

	public registerQueueAggregator(aggregator: QueueAggregator): void {
		this.queueAggregator = aggregator;
		debug && console.log('[VoIPCleanup] Queue aggregator registered');
	}

	private setupEventListeners(): void {
		// Listen for cleanup events from BackgroundRefreshManager
		window.addEventListener('voip:cleanup-queues', () => {
			this.performCleanup();
		});
	}

	private performCleanup(): void {
		if (!this.queueAggregator) {
			debug && console.warn('[VoIPCleanup] No queue aggregator registered for cleanup');
			return;
		}

		try {
			const statsBefore = this.queueAggregator.getMemoryStats();
			debug && console.log('[VoIPCleanup] Stats before cleanup:', statsBefore);

			this.queueAggregator.performMemoryCleanup();

			const statsAfter = this.queueAggregator.getMemoryStats();
			debug && console.log('[VoIPCleanup] Stats after cleanup:', statsAfter);

			const freed = statsBefore.historyCount - statsAfter.historyCount;
			if (freed > 0) {
				debug && console.log(`[VoIPCleanup] Freed ${freed} history records`);
			}
		} catch (error) {
			debug && console.error('[VoIPCleanup] Error during cleanup:', error);
		}
	}

	public getStats() {
		return this.queueAggregator?.getMemoryStats() || null;
	}
}

export const voipQueueCleanupService = new VoIPQueueCleanupService();