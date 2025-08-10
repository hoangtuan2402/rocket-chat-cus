import { Tracker } from 'meteor/tracker';
import { VideoConfManager } from '../VideoConfManager';
import { CachedCollectionManager } from '../cachedCollections/CachedCollectionManager';

export class MemoryCleanup {
	private trackerComputations = new Set<Tracker.Computation>();

	public registerComputation(computation: Tracker.Computation): void {
		this.trackerComputations.add(computation);
	}

	public unregisterComputation(computation: Tracker.Computation): void {
		this.trackerComputations.delete(computation);
	}

	public async performCleanup(preserveRoom?: string): Promise<void> {
		this.cleanupVoIP();
		this.cleanupVideoConf();
		this.cleanupComputations();
		await this.cleanupCache();
		this.cleanupChat(preserveRoom);
		this.forceGC();
	}

	private cleanupVoIP(): void {
		window.dispatchEvent(new CustomEvent('voip:cleanup-queues'));
	}

	private cleanupVideoConf(): void {
		try {
			VideoConfManager.dismissedIncomingCalls();
		} catch (error) {
			console.warn('VideoConf cleanup failed:', error);
		}
	}

	private cleanupComputations(): void {
		// ❌ KHÔNG cleanup tất cả computations - chỉ cleanup những cái đã register
		// Giữ lại essential messaging computations
		console.warn('[MemoryCleanup] Skipping computation cleanup to preserve messaging system');
		// this.trackerComputations.forEach(c => {
		// 	if (!c.stopped) c.stop();
		// });
		// this.trackerComputations.clear();
	}

	private async cleanupCache(): Promise<void> {
		try {
			// ❌ KHÔNG clear cache - có thể ảnh hưởng messaging
			console.warn('[MemoryCleanup] Skipping cache cleanup to preserve messaging system');
			// const collections = CachedCollectionManager.getInstancesArray();
			// for (const collection of collections) {
			// 	if (!['rooms', 'subscriptions', 'permissions'].includes((collection as any).name)) {
			// 		await collection.clearCache();
			// 	}
			// }
		} catch (error) {
			console.warn('Cache cleanup failed:', error);
		}
	}

	private cleanupChat(preserveRoom?: string): void {
		// ❌ KHÔNG cleanup chat instances - gây lỗi messaging
		console.warn('[MemoryCleanup] Skipping chat cleanup to preserve messaging system');
		// window.dispatchEvent(new CustomEvent('chat:cleanup-instances', {
		// 	detail: { preserveRoom }
		// }));
	}

	private forceGC(): void {
		if ((window as any).gc) {
			(window as any).gc();
		}
	}

	public getStats() {
		return {
			trackedComputations: this.trackerComputations.size,
		};
	}
}