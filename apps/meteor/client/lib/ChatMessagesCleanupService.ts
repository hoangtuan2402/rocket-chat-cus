import { getConfig } from './utils/getConfig';

const debug = !!(getConfig('debug') || getConfig('debug-ChatCleanup'));

interface ChatInstanceInfo {
	rid: string;
	tmid?: string;
	lastUsed: Date;
	instance: any; // ChatMessages instance
}

class ChatMessagesCleanupService {
	private instances = new Map<string, ChatInstanceInfo>();

	constructor() {
		this.setupEventListeners();
	}

	private setupEventListeners(): void {
		// Listen for cleanup events from BackgroundRefreshManager
		window.addEventListener('chat:cleanup-instances', (event: any) => {
			const preserveRoom = event.detail?.preserveRoom;
			this.performCleanup(preserveRoom);
		});
	}

	public registerInstance(rid: string, tmid: string | undefined, instance: any): void {
		const key = this.getKey(rid, tmid);
		this.instances.set(key, {
			rid,
			tmid,
			lastUsed: new Date(),
			instance,
		});
		
		debug && console.log(`[ChatCleanup] Registered instance for ${key}`);
	}

	public unregisterInstance(rid: string, tmid?: string): void {
		const key = this.getKey(rid, tmid);
		this.instances.delete(key);
		
		debug && console.log(`[ChatCleanup] Unregistered instance for ${key}`);
	}

	public updateLastUsed(rid: string, tmid?: string): void {
		const key = this.getKey(rid, tmid);
		const info = this.instances.get(key);
		if (info) {
			info.lastUsed = new Date();
		}
	}

	private getKey(rid: string, tmid?: string): string {
		return tmid ? `${rid}:${tmid}` : rid;
	}

	private performCleanup(preserveRoom?: string): void {
		try {
			const cutoffTime = new Date();
			cutoffTime.setMinutes(cutoffTime.getMinutes() - 15); // Keep instances used in last 15 minutes
			
			let cleanedCount = 0;
			const instancesToClean: string[] = [];

			for (const [key, info] of this.instances.entries()) {
				// Skip if this is the room we want to preserve
				if (preserveRoom && info.rid === preserveRoom) {
					continue;
				}

				// Skip if recently used
				if (info.lastUsed > cutoffTime) {
					continue;
				}

				instancesToClean.push(key);
			}

			// Cleanup old instances
			for (const key of instancesToClean) {
				const info = this.instances.get(key);
				if (info?.instance?.release) {
					try {
						info.instance.release();
						cleanedCount++;
					} catch (error) {
						debug && console.warn(`[ChatCleanup] Error releasing instance ${key}:`, error);
					}
				}
				this.instances.delete(key);
			}

			debug && console.log(`[ChatCleanup] Cleaned up ${cleanedCount} chat instances, preserved: ${preserveRoom || 'none'}`);
			
		} catch (error) {
			debug && console.error('[ChatCleanup] Error during cleanup:', error);
		}
	}

	public getStats() {
		const now = new Date();
		return {
			totalInstances: this.instances.size,
			instances: Array.from(this.instances.entries()).map(([key, info]) => ({
				key,
				rid: info.rid,
				tmid: info.tmid,
				lastUsed: info.lastUsed,
				ageMinutes: Math.round((now.getTime() - info.lastUsed.getTime()) / (1000 * 60)),
			})),
		};
	}
}

export const chatMessagesCleanupService = new ChatMessagesCleanupService();