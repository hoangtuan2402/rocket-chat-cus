import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';
import { Mongo } from 'meteor/mongo';

import { RoomManager } from '../RoomManager';
import { getConfig } from '../utils/getConfig';

const debug = !!(getConfig('debug') || getConfig('debug-MessageSystemReset'));

interface BackupMessageData {
	_id: string;
	rid: string;
	msg: string;
	ts: Date;
	u: any;
	[key: string]: any;
}

interface BackupRoomState {
	rid: string;
	messages: BackupMessageData[];
	subscription: any;
	roomData: any;
	scrollPosition: number;
	lastSeen: Date;
	unreadCount: number;
}

export class MessageSystemResetManager {
	private backupState?: BackupRoomState;

	public async backupCurrentRoom(): Promise<BackupRoomState | null> {
		const currentRoomId = RoomManager.opened;
		if (!currentRoomId) {
			debug && console.log('[MessageSystemReset] No current room to backup');
			return null;
		}

		debug && console.log(`[MessageSystemReset] Backing up room ${currentRoomId}`);

		try {
			// Backup messages from current room
			const messages = await this.backupRoomMessages(currentRoomId);
			
			// Backup room subscription data
			const subscription = await this.backupRoomSubscription(currentRoomId);
			
			// Backup room data
			const roomData = await this.backupRoomData(currentRoomId);
			
			// Backup UI state
			const roomStore = RoomManager.getStore(currentRoomId);
			const scrollPosition = roomStore?.scroll || 0;
			
			this.backupState = {
				rid: currentRoomId,
				messages,
				subscription,
				roomData,
				scrollPosition,
				lastSeen: new Date(),
				unreadCount: subscription?.unread || 0,
			};

			debug && console.log(`[MessageSystemReset] Backed up ${messages.length} messages for room ${currentRoomId}`);
			return this.backupState;

		} catch (error) {
			console.error('[MessageSystemReset] Backup failed:', error);
			return null;
		}
	}

	private async backupRoomMessages(roomId: string): Promise<BackupMessageData[]> {
		return new Promise((resolve) => {
			try {
				// Access Meteor's Messages collection
				const Messages = (window as any).ChatMessage || 
								 (window as any).Messages || 
								 new Mongo.Collection('rocketchat_message');

				const messages = Messages.find(
					{ rid: roomId },
					{ sort: { ts: -1 }, limit: 50 } // Backup last 50 messages
				).fetch();

				resolve(messages || []);
			} catch (error) {
				console.warn('[MessageSystemReset] Could not backup messages:', error);
				resolve([]);
			}
		});
	}

	private async backupRoomSubscription(roomId: string): Promise<any> {
		return new Promise((resolve) => {
			try {
				const Subscriptions = (window as any).ChatSubscription ||
									   (window as any).Subscriptions ||
									   new Mongo.Collection('rocketchat_subscription');

				const subscription = Subscriptions.findOne({ rid: roomId });
				resolve(subscription);
			} catch (error) {
				console.warn('[MessageSystemReset] Could not backup subscription:', error);
				resolve(null);
			}
		});
	}

	private async backupRoomData(roomId: string): Promise<any> {
		return new Promise((resolve) => {
			try {
				const Rooms = (window as any).ChatRoom ||
							  (window as any).Rooms ||
							  new Mongo.Collection('rocketchat_room');

				const room = Rooms.findOne({ _id: roomId });
				resolve(room);
			} catch (error) {
				console.warn('[MessageSystemReset] Could not backup room data:', error);
				resolve(null);
			}
		});
	}

	public async performFullSystemReset(): Promise<void> {
		debug && console.log('[MessageSystemReset] Starting full system reset');

		try {
			// 1. Stop all reactive computations
			await this.stopAllComputations();
			
			// 2. Clear all message collections
			await this.clearMessageCollections();
			
			// 3. Clear chat instances and subscriptions
			await this.clearChatInstances();
			
			// 4. Clear cached collections
			await this.clearCachedCollections();
			
			// 5. Force garbage collection
			this.forceGarbageCollection();
			
			// 6. Re-initialize core systems
			await this.reinitializeCoreSystems();

			debug && console.log('[MessageSystemReset] Full system reset completed');

		} catch (error) {
			console.error('[MessageSystemReset] System reset failed:', error);
			throw error;
		}
	}

	private async stopAllComputations(): Promise<void> {
		debug && console.log('[MessageSystemReset] Stopping all tracker computations');
		
		// Stop all active computations
		const activeComputations = Tracker._allComputationsInOrder || [];
		let stoppedCount = 0;
		
		activeComputations.forEach((comp: any) => {
			if (!comp.stopped && !this.isEssentialComputation(comp)) {
				comp.stop();
				stoppedCount++;
			}
		});
		
		debug && console.log(`[MessageSystemReset] Stopped ${stoppedCount} computations`);
	}

	private isEssentialComputation(computation: any): boolean {
		// Keep computations essential for user session and routing
		if (!computation._func) return true;
		
		const funcStr = computation._func.toString();
		return funcStr.includes('Meteor.userId') ||
			   funcStr.includes('Router') ||
			   funcStr.includes('Session') ||
			   funcStr.includes('AccountsClient');
	}

	private async clearMessageCollections(): Promise<void> {
		debug && console.log('[MessageSystemReset] Clearing message collections');
		
		try {
			// Clear Messages collection
			const Messages = (window as any).ChatMessage || (window as any).Messages;
			if (Messages?.remove) {
				Messages.remove({});
			}

			// Clear local message caches
			if ((window as any).RocketChat?.models?.Messages) {
				(window as any).RocketChat.models.Messages._collection.remove({});
			}

		} catch (error) {
			debug && console.warn('[MessageSystemReset] Message collection clear failed:', error);
		}
	}

	private async clearChatInstances(): Promise<void> {
		debug && console.log('[MessageSystemReset] Clearing chat instances');
		
		// Dispatch cleanup event for chat instances
		window.dispatchEvent(new CustomEvent('chat:full-reset'));
		
		// Clear chat message instances registry
		if ((window as any).chatInstances) {
			(window as any).chatInstances.clear();
		}
	}

	private async clearCachedCollections(): Promise<void> {
		debug && console.log('[MessageSystemReset] Clearing cached collections');
		
		// Clear localStorage caches
		const keysToRemove = Object.keys(localStorage).filter(key => 
			key.includes('message') || 
			key.includes('chat') || 
			key.includes('rocketchat_')
		);
		
		keysToRemove.forEach(key => {
			if (!key.includes('user') && !key.includes('login')) {
				localStorage.removeItem(key);
			}
		});
	}

	private forceGarbageCollection(): void {
		debug && console.log('[MessageSystemReset] Forcing garbage collection');
		
		if ((window as any).gc) {
			(window as any).gc();
		}
		
		// Manual cleanup
		if ((window as any).jQuery) {
			(window as any).jQuery.cleanData((window as any).jQuery('*'));
		}
	}

	private async reinitializeCoreSystems(): Promise<void> {
		debug && console.log('[MessageSystemReset] Re-initializing core systems');
		
		// Wait for system to stabilize
		await new Promise(resolve => setTimeout(resolve, 1000));
		
		// Re-establish essential subscriptions
		if (Meteor.userId()) {
			// Reconnect to server
			if (Meteor.connection) {
				Meteor.reconnect();
			}
		}
	}

	public async restoreCurrentRoom(): Promise<void> {
		if (!this.backupState) {
			debug && console.log('[MessageSystemReset] No backup state to restore');
			return;
		}

		debug && console.log(`[MessageSystemReset] Restoring room ${this.backupState.rid}`);

		try {
			// Re-open the room
			RoomManager.open(this.backupState.rid);
			
			// Wait for room to be ready
			await new Promise(resolve => setTimeout(resolve, 500));
			
			// Restore messages
			await this.restoreMessages();
			
			// Restore UI state
			await this.restoreUIState();
			
			debug && console.log(`[MessageSystemReset] Room restoration completed`);

		} catch (error) {
			console.error('[MessageSystemReset] Room restoration failed:', error);
		}

		// Clear backup state
		this.backupState = undefined;
	}

	private async restoreMessages(): Promise<void> {
		if (!this.backupState?.messages) return;

		try {
			const Messages = (window as any).ChatMessage || (window as any).Messages;
			
			if (Messages) {
				// Re-insert backed up messages
				this.backupState.messages.forEach(message => {
					Messages.upsert(message._id, message);
				});
				
				debug && console.log(`[MessageSystemReset] Restored ${this.backupState.messages.length} messages`);
			}
		} catch (error) {
			console.warn('[MessageSystemReset] Message restoration failed:', error);
		}
	}

	private async restoreUIState(): Promise<void> {
		if (!this.backupState) return;

		try {
			const roomStore = RoomManager.getStore(this.backupState.rid);
			if (roomStore) {
				roomStore.update({
					scroll: this.backupState.scrollPosition,
					lastTime: this.backupState.lastSeen,
					atBottom: this.backupState.scrollPosition === 0,
				});
			}
			
			debug && console.log('[MessageSystemReset] UI state restored');
		} catch (error) {
			console.warn('[MessageSystemReset] UI state restoration failed:', error);
		}
	}

	public getBackupStats() {
		return {
			hasBackup: !!this.backupState,
			roomId: this.backupState?.rid,
			messageCount: this.backupState?.messages.length || 0,
			backupTime: this.backupState?.lastSeen,
		};
	}
}