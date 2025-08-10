import { Meteor } from 'meteor/meteor';

import { backgroundRefreshManager } from '../lib/backgroundRefresh/SimpleManager';
import { voipQueueCleanupService } from '../lib/voip/QueueCleanupService';
import { chatMessagesCleanupService } from '../lib/ChatMessagesCleanupService';
import { emergencyRestore } from '../lib/backgroundRefresh/EmergencyRestore';

// Simple integration without heavy patching
Meteor.startup(() => {
	// Auto-start/stop based on user login
	const computation = Tracker.autorun(() => {
		const userId = Meteor.userId();
		if (userId) {
			backgroundRefreshManager.start();
		} else {
			backgroundRefreshManager.stop();
		}
	});

	// Register the computation for cleanup
	backgroundRefreshManager.registerComputation(computation);

	// Global debug access
	(window as any).bgRefresh = {
		manager: backgroundRefreshManager,
		status: () => backgroundRefreshManager.getStatus(),
		voipStats: () => voipQueueCleanupService.getStats(),
		chatStats: () => chatMessagesCleanupService.getStats(),
		forceCleanup: () => backgroundRefreshManager.performRefresh(),
		// Full reset controls
		backupRoom: () => (backgroundRefreshManager as any).memoryCleanup.backupCurrentRoom(),
		resetSystem: () => (backgroundRefreshManager as any).memoryCleanup.resetSystemOnly(),
		restoreRoom: () => (backgroundRefreshManager as any).memoryCleanup.restoreRoom(),
		fullReset: (preserve = true) => (backgroundRefreshManager as any).memoryCleanup.performFullReset(preserve),
		// Emergency restore functions
		fixRoomAccess: () => emergencyRestore.fixRoomAccess(),
		emergencyRestore: () => emergencyRestore.emergencyFullRestore(),
		// Microtask queue controls
		microtaskStats: () => (backgroundRefreshManager as any).memoryCleanup.microtaskCleanup.getMicrotaskStats(),
		cleanMicrotasks: () => (backgroundRefreshManager as any).memoryCleanup.microtaskCleanup.performMicrotaskCleanup(),
	};
});