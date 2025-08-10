import { Emitter } from '@rocket.chat/emitter';

export class ActivityTracker extends Emitter<{ inactive: void; active: void }> {
	private inactiveTimer?: ReturnType<typeof setTimeout>;
	private isUserActive = true;
	private lastActivity = Date.now();
	private inactiveTime: number;

	constructor(inactiveTime: number) {
		super();
		this.inactiveTime = inactiveTime;
		this.setupEventListeners();
		this.resetActivityTracking();
	}

	public updateInactiveTime(time: number): void {
		this.inactiveTime = time;
		this.resetActivityTracking();
	}

	public getLastActivity(): Date {
		return new Date(this.lastActivity);
	}

	public isActive(): boolean {
		return this.isUserActive;
	}

	private setupEventListeners(): void {
		const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
		
		const onActivity = () => {
			this.lastActivity = Date.now();
			if (!this.isUserActive) {
				this.isUserActive = true;
				this.resetActivityTracking();
				this.emit('active');
			}
		};

		events.forEach(event => {
			document.addEventListener(event, onActivity, { passive: true });
		});

		document.addEventListener('visibilitychange', () => {
			if (document.hidden) {
				this.onUserInactive();
			} else {
				onActivity();
			}
		});

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
		}, this.inactiveTime);
	}

	private onUserInactive(): void {
		if (!this.isUserActive) return;
		
		this.isUserActive = false;
		this.emit('inactive');
	}
}