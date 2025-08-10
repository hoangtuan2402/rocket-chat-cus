import { RoomManager } from '../RoomManager';
import type { PreservedRoomData } from './types';

export class RoomPreserver {
	private preservedData?: PreservedRoomData;

	public async preserve(): Promise<PreservedRoomData | undefined> {
		const roomId = RoomManager.opened;
		if (!roomId) return;

		const store = RoomManager.getStore(roomId);
		if (!store) return;

		this.preservedData = {
			rid: roomId,
			scroll: store.scroll,
			lastTime: store.lastTime,
			atBottom: store.atBottom,
		};

		return this.preservedData;
	}

	public async restore(): Promise<void> {
		if (!this.preservedData) return;

		const { rid } = this.preservedData;
		if (RoomManager.opened === rid) {
			const store = RoomManager.getStore(rid);
			store?.update({
				scroll: this.preservedData.scroll,
				lastTime: this.preservedData.lastTime,
				atBottom: this.preservedData.atBottom,
			});
		}

		this.preservedData = undefined;
	}

	public getPreservedData(): PreservedRoomData | undefined {
		return this.preservedData;
	}
}