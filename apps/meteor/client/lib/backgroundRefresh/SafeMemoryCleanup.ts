import { VideoConfManager } from '../VideoConfManager';

export class SafeMemoryCleanup {
	private cleanupHistory: string[] = [];

	public async performSafeCleanup(): Promise<void> {
		console.log('[SafeMemoryCleanup] Starting safe cleanup...');
		
		// Chỉ cleanup những thứ an toàn, KHÔNG động vào messaging system
		this.cleanupVideoConf();
		this.cleanupVoIPHistory();
		this.cleanupDOMEvents();
		this.logCleanup();
	}

	private cleanupVideoConf(): void {
		try {
			// Chỉ dismiss incoming calls - không động vào active connections
			VideoConfManager.dismissedIncomingCalls();
			this.cleanupHistory.push('VideoConf dismissed calls cleaned');
		} catch (error) {
			console.warn('[SafeMemoryCleanup] VideoConf cleanup failed:', error);
		}
	}

	private cleanupVoIPHistory(): void {
		try {
			// Chỉ cleanup VoIP history, không động vào active queue
			window.dispatchEvent(new CustomEvent('voip:cleanup-history-only'));
			this.cleanupHistory.push('VoIP history cleaned');
		} catch (error) {
			console.warn('[SafeMemoryCleanup] VoIP cleanup failed:', error);
		}
	}

	private cleanupDOMEvents(): void {
		try {
			// Cleanup các DOM event listeners không cần thiết
			const oldListeners = document.querySelectorAll('[data-cleanup-listener]');
			oldListeners.forEach(el => el.remove());
			this.cleanupHistory.push(`${oldListeners.length} DOM listeners cleaned`);
		} catch (error) {
			console.warn('[SafeMemoryCleanup] DOM cleanup failed:', error);
		}
	}

	private logCleanup(): void {
		console.log('[SafeMemoryCleanup] Completed safely:', this.cleanupHistory);
		this.cleanupHistory = [];
	}

	public getStats() {
		return {
			lastCleanup: this.cleanupHistory,
			safeMode: true,
		};
	}
}