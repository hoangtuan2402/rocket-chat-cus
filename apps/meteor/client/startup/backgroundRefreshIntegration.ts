import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';

import { backgroundRefreshManager } from '../lib/BackgroundRefreshManager';
import { voipQueueCleanupService } from '../lib/voip/QueueCleanupService';
import { chatMessagesCleanupService } from '../lib/ChatMessagesCleanupService';
import { getConfig } from '../lib/utils/getConfig';

const debug = !!(getConfig('debug') || getConfig('debug-BackgroundRefreshIntegration'));

// Enhanced Tracker.autorun that registers itself for cleanup
const createTrackedComputation = (func: () => void): Tracker.Computation => {
	const computation = Tracker.autorun(func);
	backgroundRefreshManager.registerTrackerComputation(computation);
	
	// Auto-unregister when stopped
	const originalStop = computation.stop.bind(computation);
	computation.stop = () => {
		backgroundRefreshManager.unregisterTrackerComputation(computation);
		originalStop();
	};
	
	return computation;
};

// Enhanced reactive subscription factory
const createReactiveSubscriptionFactoryWithCleanup = <T>(
	computeCurrentValueWith: (...args: any[]) => T
): ((...args: any[]) => [subscribe: (onStoreChange: () => void) => () => void, getSnapshot: () => T]) => {
	return (...args: any[]) => {
		const callbacks = new Set<() => void>();
		let currentValue = computeCurrentValueWith(...args);

		const reactiveFn = (): void => {
			currentValue = computeCurrentValueWith(...args);
			queueMicrotask(() => {
				callbacks.forEach((callback) => {
					callback();
				});
			});
		};

		let computation: Tracker.Computation | undefined;

		queueMicrotask(() => {
			computation = createTrackedComputation(reactiveFn);
		});

		return [
			(callback): (() => void) => {
				callbacks.add(callback);

				return (): void => {
					callbacks.delete(callback);

					if (callbacks.size === 0) {
						queueMicrotask(() => {
							if (computation) {
								computation.stop();
								computation = undefined;
							}
						});
					}
				};
			},
			(): T => currentValue,
		];
	};
};

// Patch existing systems to integrate with cleanup
const integrateWithExistingSystems = (): void => {
	// Monitor ChatMessages instances
	const originalChatMessages = (window as any).ChatMessages;
	if (originalChatMessages) {
		const originalConstructor = originalChatMessages.prototype.constructor;
		originalChatMessages.prototype.constructor = function(options: any) {
			const result = originalConstructor.call(this, options);
			
			// Register with cleanup service
			if (options?.rid) {
				chatMessagesCleanupService.registerInstance(options.rid, options.tmid, this);
				
				// Track usage
				const originalUpdate = this.update?.bind(this);
				if (originalUpdate) {
					this.update = (...args: any[]) => {
						chatMessagesCleanupService.updateLastUsed(options.rid, options.tmid);
						return originalUpdate(...args);
					};
				}

				// Auto-unregister on release
				const originalRelease = this.release?.bind(this);
				if (originalRelease) {
					this.release = () => {
						chatMessagesCleanupService.unregisterInstance(options.rid, options.tmid);
						return originalRelease();
					};
				}
			}
			
			return result;
		};
	}

	// Monitor VoIP QueueAggregator
	const originalQueueAggregator = (window as any).QueueAggregator;
	if (originalQueueAggregator) {
		voipQueueCleanupService.registerQueueAggregator(originalQueueAggregator);
	}
};

// Settings integration
const loadSettingsFromServer = (): void => {
	// Try to load settings from server-side settings
	Tracker.autorun(() => {
		const userId = Meteor.userId();
		if (!userId) return;

		try {
			// Load from user preferences or server settings
			const settings = {
				enabled: true, // Default enabled
				inactiveTime: 5 * 60 * 1000, // 5 minutes
				refreshInterval: 10 * 60 * 1000, // 10 minutes  
				preserveCurrentRoom: true,
			};

			backgroundRefreshManager.updateConfig(settings);
			debug && console.log('[BackgroundRefreshIntegration] Settings loaded:', settings);
		} catch (error) {
			debug && console.warn('[BackgroundRefreshIntegration] Failed to load settings:', error);
		}
	});
};

// Memory monitoring and reporting
const setupMemoryMonitoring = (): void => {
	if (!debug) return;

	const logMemoryStats = () => {
		try {
			const bgStatus = backgroundRefreshManager.getStatus();
			const voipStats = voipQueueCleanupService.getStats();
			const chatStats = chatMessagesCleanupService.getStats();

			console.group('[BackgroundRefreshIntegration] Memory Stats');
			console.log('Background Refresh:', bgStatus);
			console.log('VoIP Queues:', voipStats);
			console.log('Chat Instances:', chatStats);
			
			if ((performance as any).memory) {
				console.log('Browser Memory:', {
					used: Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024) + ' MB',
					total: Math.round((performance as any).memory.totalJSHeapSize / 1024 / 1024) + ' MB',
					limit: Math.round((performance as any).memory.jsHeapSizeLimit / 1024 / 1024) + ' MB',
				});
			}
			console.groupEnd();
		} catch (error) {
			console.warn('[BackgroundRefreshIntegration] Error logging memory stats:', error);
		}
	};

	// Log stats every 5 minutes
	setInterval(logMemoryStats, 5 * 60 * 1000);

	// Log stats on cleanup events
	backgroundRefreshManager.on('refresh/started', () => {
		debug && console.log('[BackgroundRefreshIntegration] Background refresh started');
		logMemoryStats();
	});

	backgroundRefreshManager.on('refresh/completed', () => {
		debug && console.log('[BackgroundRefreshIntegration] Background refresh completed');
		setTimeout(logMemoryStats, 1000); // Log stats after cleanup
	});
};

// Initialize everything
Meteor.startup(() => {
	debug && console.log('[BackgroundRefreshIntegration] Initializing background refresh integration');
	
	integrateWithExistingSystems();
	loadSettingsFromServer();
	setupMemoryMonitoring();
	
	// Global access for debugging
	(window as any).backgroundRefreshManager = backgroundRefreshManager;
	(window as any).backgroundRefreshDebug = {
		voipStats: () => voipQueueCleanupService.getStats(),
		chatStats: () => chatMessagesCleanupService.getStats(),
		bgStatus: () => backgroundRefreshManager.getStatus(),
		forceCleanup: () => {
			window.dispatchEvent(new CustomEvent('voip:cleanup-queues'));
			window.dispatchEvent(new CustomEvent('chat:cleanup-instances'));
		},
	};

	debug && console.log('[BackgroundRefreshIntegration] Integration complete');
});

// Export enhanced utilities
export { createTrackedComputation, createReactiveSubscriptionFactoryWithCleanup };