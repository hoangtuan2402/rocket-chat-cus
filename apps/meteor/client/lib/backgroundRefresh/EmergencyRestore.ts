import { Meteor } from 'meteor/meteor';
import { getConfig } from '../utils/getConfig';

const debug = !!(getConfig('debug') || getConfig('debug-EmergencyRestore'));

export class EmergencyRestore {
	
	public async fixRoomAccess(): Promise<void> {
		debug && console.log('[EmergencyRestore] Starting room access fix');
		
		try {
			// 1. Force reconnect to server to restore subscriptions
			await this.forceReconnect();
			
			// 2. Re-establish essential subscriptions
			await this.reestablishSubscriptions();
			
			// 3. Refresh current page to restore full state
			await this.schedulePageRefresh();
			
			console.log('[EmergencyRestore] Room access fix initiated');
			
		} catch (error) {
			console.error('[EmergencyRestore] Fix failed:', error);
		}
	}

	private async forceReconnect(): Promise<void> {
		return new Promise((resolve) => {
			try {
				if (Meteor.connection) {
					debug && console.log('[EmergencyRestore] Forcing server reconnect');
					
					Meteor.connection.disconnect();
					
					setTimeout(() => {
						Meteor.connection.reconnect();
						setTimeout(resolve, 2000); // Wait for reconnection
					}, 1000);
				} else {
					resolve();
				}
			} catch (error) {
				console.warn('[EmergencyRestore] Reconnect failed:', error);
				resolve();
			}
		});
	}

	private async reestablishSubscriptions(): Promise<void> {
		try {
			debug && console.log('[EmergencyRestore] Re-establishing subscriptions');
			
			// Re-subscribe to essential data
			if (Meteor.userId()) {
				Meteor.subscribe('userData');
				Meteor.subscribe('activeUsers');
				setTimeout(() => {
					Meteor.subscribe('subscription');
					Meteor.subscribe('rooms');
				}, 1000);
			}
		} catch (error) {
			console.warn('[EmergencyRestore] Subscription restore failed:', error);
		}
	}

	private async schedulePageRefresh(): Promise<void> {
		// As last resort, refresh page after short delay to fully restore state
		console.warn('[EmergencyRestore] Scheduling page refresh to fully restore room access');
		
		setTimeout(() => {
			if (confirm('Room access needs to be restored. Refresh page now?')) {
				window.location.reload();
			}
		}, 3000);
	}

	public async emergencyFullRestore(): Promise<void> {
		console.warn('[EmergencyRestore] Performing emergency full restore - refreshing page');
		
		// Store current URL to return to same page
		const currentPath = window.location.pathname + window.location.search;
		localStorage.setItem('emergency-restore-path', currentPath);
		
		// Refresh page immediately
		window.location.reload();
	}

	// Auto restore path after page refresh
	public static autoRestorePath(): void {
		const savedPath = localStorage.getItem('emergency-restore-path');
		if (savedPath && savedPath !== window.location.pathname + window.location.search) {
			localStorage.removeItem('emergency-restore-path');
			window.history.replaceState(null, '', savedPath);
		}
	}
}

export const emergencyRestore = new EmergencyRestore();

// Auto-run path restoration on page load
Meteor.startup(() => {
	EmergencyRestore.autoRestorePath();
});