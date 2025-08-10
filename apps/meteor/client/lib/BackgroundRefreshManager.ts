import { Emitter } from '@rocket.chat/emitter';
import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';

import { ActivityTracker } from './backgroundRefresh/ActivityTracker';
import { MemoryCleanup } from './backgroundRefresh/MemoryCleanup';
import { RoomPreserver } from './backgroundRefresh/RoomPreserver';
import type { BackgroundRefreshConfig, BackgroundRefreshEvents } from './backgroundRefresh/types';
import { getConfig } from './utils/getConfig';

const debug = !!(getConfig('debug') || getConfig('debug-BackgroundRefresh'));

export class BackgroundRefreshManager extends Emitter<BackgroundRefreshEvents> {
	private config: BackgroundRefreshConfig;
	private inactiveTimer?: ReturnType<typeof setTimeout>;
	private refreshTimer?: ReturnType<typeof setInterval>;
	private isUserActive = true;
	private lastActivity = Date.now();
	private preservedRoomData?: PreservedRoomData;
	private trackerComputations: Set<Tracker.Computation> = new Set();

	constructor() {
		super();
		
		// Default configuration - can be overridden via settings
		this.config = {
			inactiveTime: 5 * 60 * 1000, // 5 minutes
			refreshInterval: 10 * 60 * 1000, // 10 minutes  
			enabled: true,
			preserveCurrentRoom: true,
		};

		this.setupEventListeners();
		debug && console.log('[BackgroundRefresh] Manager initialized');
	}

	public updateConfig(newConfig: Partial<BackgroundRefreshConfig>): void {
		this.config = { ...this.config, ...newConfig };
		this.emit('config/changed', this.config);
		
		if (this.config.enabled) {
			this.start();
		} else {
			this.stop();
		}
		
		debug && console.log('[BackgroundRefresh] Config updated:', this.config);
	}

	public start(): void {
		if (!this.config.enabled) return;

		this.stop(); // Clean up existing timers
		this.resetActivityTracking();

		debug && console.log('[BackgroundRefresh] Started monitoring');
	}

	public stop(): void {
		if (this.inactiveTimer) {
			clearTimeout(this.inactiveTimer);
			this.inactiveTimer = undefined;
		}
		
		if (this.refreshTimer) {
			clearInterval(this.refreshTimer);
			this.refreshTimer = undefined;
		}

		debug && console.log('[BackgroundRefresh] Stopped monitoring');
	}

	private setupEventListeners(): void {
		// Track user activity
		const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
		
		const onActivity = () => {
			this.lastActivity = Date.now();
			if (!this.isUserActive) {
				this.isUserActive = true;
				this.resetActivityTracking();
				debug && console.log('[BackgroundRefresh] User became active');
			}
		};

		activityEvents.forEach(event => {
			document.addEventListener(event, onActivity, { passive: true });
		});

		// Page visibility API
		document.addEventListener('visibilitychange', () => {
			if (document.hidden) {
				this.onUserInactive();
			} else {
				onActivity();
			}
		});

		// Track page focus/blur
		window.addEventListener('focus', onActivity);
		window.addEventListener('blur', () => {
			setTimeout(() => {
				if (Date.now() - this.lastActivity > 1000) {
					this.onUserInactive();
				}
			}, 1000);
		});
	}

	private resetActivityTracking(): void {
		if (this.inactiveTimer) {
			clearTimeout(this.inactiveTimer);
		}

		this.inactiveTimer = setTimeout(() => {
			this.onUserInactive();
		}, this.config.inactiveTime);
	}

	private onUserInactive(): void {
		if (!this.isUserActive) return;
		
		this.isUserActive = false;
		debug && console.log('[BackgroundRefresh] User became inactive, starting background refresh cycle');

		// Start periodic refresh
		this.refreshTimer = setInterval(() => {
			if (!this.isUserActive) {
				this.performBackgroundRefresh();
			}
		}, this.config.refreshInterval);

		// Perform initial refresh
		setTimeout(() => {
			if (!this.isUserActive) {
				this.performBackgroundRefresh();
			}
		}, 1000);
	}

	private async performBackgroundRefresh(): Promise<void> {
		try {
			this.emit('refresh/started');
			debug && console.log('[BackgroundRefresh] Starting background refresh');

			// Preserve current room data
			if (this.config.preserveCurrentRoom) {
				await this.preserveCurrentRoomData();
			}

			// Cleanup operations
			await this.cleanupMemoryLeaks();
			
			// Restore current room data
			if (this.config.preserveCurrentRoom && this.preservedRoomData) {
				await this.restoreCurrentRoomData();
			}

			this.emit('refresh/completed');
			debug && console.log('[BackgroundRefresh] Background refresh completed');
			
		} catch (error) {
			debug && console.error('[BackgroundRefresh] Error during refresh:', error);
		}
	}

	private async preserveCurrentRoomData(): Promise<void> {
		const currentRoomId = RoomManager.opened;
		if (!currentRoomId) return;

		const roomStore = RoomManager.getStore(currentRoomId);
		if (!roomStore) return;

		// Preserve essential room state
		this.preservedRoomData = {
			rid: currentRoomId,
			scroll: roomStore.scroll,
			lastTime: roomStore.lastTime,
			atBottom: roomStore.atBottom,
		};

		// Try to preserve current messages in view
		try {
			const messagesElement = document.querySelector('.messages-list');
			if (messagesElement) {
				// Store current scroll position and visible message IDs for restoration
				const visibleMessages = Array.from(messagesElement.querySelectorAll('[data-id]'))
					.map(el => el.getAttribute('data-id'))
					.filter(Boolean);
				
				// We'll rely on the message cache/history system to restore these
				debug && console.log(`[BackgroundRefresh] Preserved data for room ${currentRoomId}, visible messages: ${visibleMessages.length}`);
			}
		} catch (error) {
			debug && console.warn('[BackgroundRefresh] Could not preserve message data:', error);
		}

		this.emit('preserve/room', this.preservedRoomData);
	}

	private async cleanupMemoryLeaks(): Promise<void> {
		debug && console.log('[BackgroundRefresh] Starting memory cleanup');

		// 1. Cleanup VoIP Queue Aggregator
		this.cleanupVoIPQueues();

		// 2. Cleanup VideoConf Manager
		this.cleanupVideoConferences();

		// 3. Cleanup Tracker computations
		this.cleanupTrackerComputations();

		// 4. Cleanup Cached Collections
		await this.cleanupCachedCollections();

		// 5. Cleanup Chat Messages instances (except current room)
		this.cleanupChatMessages();

		// 6. Force garbage collection if available
		if (window.gc) {
			window.gc();
			debug && console.log('[BackgroundRefresh] Forced garbage collection');
		}
	}

	private cleanupVoIPQueues(): void {
		try {
			// Note: We can't directly access the QueueAggregator instance from here
			// so we'll emit an event that the VoIP system can listen to
			window.dispatchEvent(new CustomEvent('voip:cleanup-queues'));
			debug && console.log('[BackgroundRefresh] Triggered VoIP queue cleanup');
		} catch (error) {
			debug && console.warn('[BackgroundRefresh] VoIP cleanup failed:', error);
		}
	}

	private cleanupVideoConferences(): void {
		try {
			// VideoConf cleanup - dismiss old calls, clear timeouts
			VideoConfManager.dismissedIncomingCalls();
			debug && console.log('[BackgroundRefresh] Cleaned up video conferences');
		} catch (error) {
			debug && console.warn('[BackgroundRefresh] VideoConf cleanup failed:', error);
		}
	}

	private cleanupTrackerComputations(): void {
		try {
			// Stop and recreate long-running computations to prevent memory leaks
			let stoppedCount = 0;
			this.trackerComputations.forEach(computation => {
				if (!computation.stopped) {
					computation.stop();
					stoppedCount++;
				}
			});
			this.trackerComputations.clear();
			
			debug && console.log(`[BackgroundRefresh] Stopped ${stoppedCount} tracker computations`);
		} catch (error) {
			debug && console.warn('[BackgroundRefresh] Tracker cleanup failed:', error);
		}
	}

	private async cleanupCachedCollections(): Promise<void> {
		try {
			// Clear caches for non-essential collections
			const collections = CachedCollectionManager.getInstances();
			let clearedCount = 0;
			
			for (const collection of collections) {
				// Don't clear essential collections like rooms, subscriptions
				if (!['rooms', 'subscriptions'].includes(collection.name)) {
					await collection.clearCache();
					clearedCount++;
				}
			}
			
			debug && console.log(`[BackgroundRefresh] Cleared ${clearedCount} cached collections`);
		} catch (error) {
			debug && console.warn('[BackgroundRefresh] Cache cleanup failed:', error);
		}
	}

	private cleanupChatMessages(): void {
		try {
			// This would require access to ChatMessages registry
			// For now, we'll emit an event that ChatMessages can listen to
			window.dispatchEvent(new CustomEvent('chat:cleanup-instances', {
				detail: { 
					preserveRoom: this.preservedRoomData?.rid 
				}
			}));
			debug && console.log('[BackgroundRefresh] Triggered chat messages cleanup');
		} catch (error) {
			debug && console.warn('[BackgroundRefresh] Chat messages cleanup failed:', error);
		}
	}

	private async restoreCurrentRoomData(): Promise<void> {
		if (!this.preservedRoomData) return;

		try {
			const { rid } = this.preservedRoomData;
			
			// Ensure the room is still open
			if (RoomManager.opened === rid) {
				const roomStore = RoomManager.getStore(rid);
				if (roomStore) {
					roomStore.update({
						scroll: this.preservedRoomData.scroll,
						lastTime: this.preservedRoomData.lastTime,
						atBottom: this.preservedRoomData.atBottom,
					});
				}
			}

			this.emit('restore/room', this.preservedRoomData);
			debug && console.log(`[BackgroundRefresh] Restored data for room ${rid}`);
			
		} catch (error) {
			debug && console.warn('[BackgroundRefresh] Room restoration failed:', error);
		}

		this.preservedRoomData = undefined;
	}

	public registerTrackerComputation(computation: Tracker.Computation): void {
		this.trackerComputations.add(computation);
	}

	public unregisterTrackerComputation(computation: Tracker.Computation): void {
		this.trackerComputations.delete(computation);
	}

	public getStatus() {
		return {
			enabled: this.config.enabled,
			userActive: this.isUserActive,
			lastActivity: new Date(this.lastActivity),
			timeSinceLastActivity: Date.now() - this.lastActivity,
			inactiveThreshold: this.config.inactiveTime,
			refreshInterval: this.config.refreshInterval,
			trackedComputations: this.trackerComputations.size,
		};
	}
}

// Singleton instance
export const backgroundRefreshManager = new BackgroundRefreshManager();

// Auto-start when user logs in
Meteor.startup(() => {
	Tracker.autorun(() => {
		const userId = Meteor.userId();
		if (userId) {
			backgroundRefreshManager.start();
		} else {
			backgroundRefreshManager.stop();
		}
	});
});