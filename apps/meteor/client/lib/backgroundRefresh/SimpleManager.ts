import { Emitter } from '@rocket.chat/emitter';
import { Meteor } from 'meteor/meteor';

import { ActivityTracker } from './ActivityTracker';
import { FullResetMemoryCleanup } from './FullResetMemoryCleanup';
import { RoomPreserver } from './RoomPreserver';
import type { BackgroundRefreshConfig, BackgroundRefreshEvents } from './types';

export class SimpleBackgroundRefreshManager extends Emitter<BackgroundRefreshEvents> {
	private config: BackgroundRefreshConfig;
	private refreshTimer?: ReturnType<typeof setInterval>;
	private activityTracker: ActivityTracker;
	private memoryCleanup: FullResetMemoryCleanup;
	private roomPreserver: RoomPreserver;

	constructor() {
		super();
		
		this.config = {
			inactiveTime: 5 * 60 * 1000,
			refreshInterval: 10 * 60 * 1000,
			enabled: true,
			preserveCurrentRoom: true,
		};

		this.activityTracker = new ActivityTracker(this.config.inactiveTime);
		this.memoryCleanup = new FullResetMemoryCleanup();
		this.roomPreserver = new RoomPreserver();

		this.setupListeners();
	}

	public updateConfig(newConfig: Partial<BackgroundRefreshConfig>): void {
		this.config = { ...this.config, ...newConfig };
		this.activityTracker.updateInactiveTime(this.config.inactiveTime);
		this.emit('config/changed', this.config);
		
		if (this.config.enabled) {
			this.start();
		} else {
			this.stop();
		}
	}

	public start(): void {
		if (!this.config.enabled) return;
		this.stop();
	}

	public stop(): void {
		if (this.refreshTimer) {
			clearInterval(this.refreshTimer);
			this.refreshTimer = undefined;
		}
	}

	private setupListeners(): void {
		this.activityTracker.on('inactive', () => {
			this.startRefreshCycle();
		});

		this.activityTracker.on('active', () => {
			this.stop();
		});
	}

	private startRefreshCycle(): void {
		this.refreshTimer = setInterval(() => {
			if (!this.activityTracker.isActive()) {
				this.performRefresh();
			}
		}, this.config.refreshInterval);

		setTimeout(() => {
			if (!this.activityTracker.isActive()) {
				this.performRefresh();
			}
		}, 1000);
	}

	private async performRefresh(): Promise<void> {
		try {
			this.emit('refresh/started');

			// Perform FULL reset with message system re-initialization
			await this.memoryCleanup.performFullReset(this.config.preserveCurrentRoom);

			this.emit('refresh/completed');
		} catch (error) {
			console.warn('Background refresh error:', error);
		}
	}

	public registerComputation(computation: any): void {
		// Safe mode - không track computations để tránh xóa nhầm
		console.log('[SimpleManager] Safe mode - not tracking computations');
	}

	public unregisterComputation(computation: any): void {
		// Safe mode - không track computations để tránh xóa nhầm  
		console.log('[SimpleManager] Safe mode - not tracking computations');
	}

	public getStatus() {
		return {
			enabled: this.config.enabled,
			userActive: this.activityTracker.isActive(),
			lastActivity: this.activityTracker.getLastActivity(),
			timeSinceLastActivity: Date.now() - this.activityTracker.getLastActivity().getTime(),
			inactiveThreshold: this.config.inactiveTime,
			refreshInterval: this.config.refreshInterval,
			...this.memoryCleanup.getStats(),
		};
	}
}

export const backgroundRefreshManager = new SimpleBackgroundRefreshManager();

Meteor.startup(() => {
	const userId = Meteor.userId();
	if (userId) {
		backgroundRefreshManager.start();
	}
});