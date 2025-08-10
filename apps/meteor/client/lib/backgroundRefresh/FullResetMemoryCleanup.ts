import { MessageSystemResetManager } from './MessageSystemResetManager';
import { VideoConfManager } from '../VideoConfManager';
import { CachedCollectionManager } from '../cachedCollections/CachedCollectionManager';
import { MicrotaskQueueCleanup } from './MicrotaskCleanup';
import { getConfig } from '../utils/getConfig';

const debug = !!(getConfig('debug') || getConfig('debug-FullResetCleanup'));

export class FullResetMemoryCleanup {
	private messageSystemReset: MessageSystemResetManager;
	private microtaskCleanup: MicrotaskQueueCleanup;
	private cleanupHistory: string[] = [];

	constructor() {
		this.messageSystemReset = new MessageSystemResetManager();
		this.microtaskCleanup = new MicrotaskQueueCleanup();
	}

	public async performFullReset(preserveCurrentRoom = true): Promise<void> {
		// 🚨 EMERGENCY DISABLE - FULL RESET GÂY LỖI ROOM ACCESS
		console.warn('[FullResetCleanup] FULL RESET DISABLED - causes room access issues');
		console.warn('[FullResetCleanup] Falling back to safe cleanup only');
		
		// Chỉ thực hiện safe cleanup
		await this.performSafeCleanup();
		
		this.cleanupHistory = ['EMERGENCY MODE: Performed safe cleanup only'];
		this.logCleanupResults();
	}

	// Safe cleanup method that doesn't break room access
	private async performSafeCleanup(): Promise<void> {
		try {
			// Only cleanup non-essential components
			await this.safeCleanupVideoConf();
			await this.safeCleanupVoIP();
			await this.safeCleanupDOMAndEvents();
			await this.safeCleanupMicrotasks();
			// DO NOT touch message collections, rooms, subscriptions
			
			this.cleanupHistory.push('Safe VideoConf cleanup');
			this.cleanupHistory.push('Safe VoIP cleanup'); 
			this.cleanupHistory.push('Safe DOM cleanup');
			this.cleanupHistory.push('Safe microtask cleanup');
		} catch (error) {
			console.error('[FullResetCleanup] Safe cleanup error:', error);
		}
	}

	private async safeCleanupVideoConf(): Promise<void> {
		try {
			// Only dismiss incoming calls, don't reset entire system
			VideoConfManager.dismissedIncomingCalls();
		} catch (error) {
			console.warn('[FullResetCleanup] Safe VideoConf cleanup failed:', error);
		}
	}

	private async safeCleanupVoIP(): Promise<void> {
		try {
			// Only cleanup history, don't reset system
			window.dispatchEvent(new CustomEvent('voip:cleanup-history-only'));
		} catch (error) {
			console.warn('[FullResetCleanup] Safe VoIP cleanup failed:', error);
		}
	}

	private async safeCleanupDOMAndEvents(): Promise<void> {
		try {
			// Only cleanup specific marked elements
			const elementsWithCleanupMarkers = document.querySelectorAll('[data-cleanup-safe]');
			elementsWithCleanupMarkers.forEach(el => el.remove());
		} catch (error) {
			console.warn('[FullResetCleanup] Safe DOM cleanup failed:', error);
		}
	}

	private async safeCleanupMicrotasks(): Promise<void> {
		try {
			// Clean up pending microtasks to prevent memory leaks
			await this.microtaskCleanup.performMicrotaskCleanup();
		} catch (error) {
			console.warn('[FullResetCleanup] Safe microtask cleanup failed:', error);
		}
	}

	private async cleanupVideoConf(): Promise<void> {
		try {
			// Disconnect and reset video conference manager
			if (VideoConfManager.disconnect) {
				VideoConfManager.disconnect();
			}
			VideoConfManager.dismissedIncomingCalls();
			
			this.cleanupHistory.push('VideoConf system reset');
		} catch (error) {
			console.warn('[FullResetCleanup] VideoConf cleanup failed:', error);
		}
	}

	private async cleanupVoIP(): Promise<void> {
		try {
			// Full VoIP system reset
			window.dispatchEvent(new CustomEvent('voip:full-reset'));
			this.cleanupHistory.push('VoIP system reset');
		} catch (error) {
			console.warn('[FullResetCleanup] VoIP cleanup failed:', error);
		}
	}

	private async cleanupCachedCollections(): Promise<void> {
		try {
			const collections = CachedCollectionManager.getInstancesArray();
			let clearedCount = 0;
			
			// Clear ALL cached collections (they will be re-initialized)
			for (const collection of collections) {
				await collection.clearCache();
				clearedCount++;
			}
			
			this.cleanupHistory.push(`Cleared ${clearedCount} cached collections`);
		} catch (error) {
			console.warn('[FullResetCleanup] Cache cleanup failed:', error);
		}
	}

	private async cleanupDOMAndEvents(): Promise<void> {
		try {
			// Remove event listeners
			const elementsWithListeners = document.querySelectorAll('[data-cleanup-listener]');
			elementsWithListeners.forEach(el => el.remove());

			// Clear jQuery data if available
			if ((window as any).jQuery) {
				(window as any).jQuery.cleanData((window as any).jQuery('*'));
			}

			// Clear any remaining timers
			const highestTimeoutId = setTimeout(() => {}, 0);
			for (let i = 0; i < highestTimeoutId; i++) {
				clearTimeout(i);
			}

			this.cleanupHistory.push('DOM and events cleaned');
		} catch (error) {
			console.warn('[FullResetCleanup] DOM cleanup failed:', error);
		}
	}

	private async waitForStabilization(): Promise<void> {
		// Wait for system to stabilize after reset
		debug && console.log('[FullResetCleanup] Waiting for system stabilization');
		await new Promise(resolve => setTimeout(resolve, 2000));
	}

	private logCleanupResults(): void {
		console.group('[FullResetCleanup] Cleanup Results');
		this.cleanupHistory.forEach(entry => console.log('✓', entry));
		console.groupEnd();
	}

	public getStats() {
		return {
			lastCleanup: this.cleanupHistory,
			backupStats: this.messageSystemReset.getBackupStats(),
			fullResetMode: true,
		};
	}

	// Manual controls for testing
	public async backupCurrentRoom() {
		return this.messageSystemReset.backupCurrentRoom();
	}

	public async restoreRoom() {
		return this.messageSystemReset.restoreCurrentRoom();
	}

	public async resetSystemOnly() {
		return this.messageSystemReset.performFullSystemReset();
	}
}