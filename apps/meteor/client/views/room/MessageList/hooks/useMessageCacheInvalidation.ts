import type { IRoom } from '@rocket.chat/core-typings';
import { useEffect } from 'react';

import { messageCache } from '../../../../lib/chats/MessageCache';
import { useRoom } from '../../contexts/RoomContext';

/**
 * Hook để invalidate message cache khi cần thiết
 */
export const useMessageCacheInvalidation = (rid: IRoom['_id']) => {
	const room = useRoom();

	useEffect(() => {
		// Invalidate cache khi switch rooms
		return () => {
			// Cache sẽ tự động expire, không cần invalidate ngay lập tức
			// Chỉ invalidate khi thực sự cần thiết
		};
	}, [rid]);

	// Invalidate cache khi room settings thay đổi
	useEffect(() => {
		if (room.sysMes) {
			messageCache.invalidateRoom(rid);
		}
	}, [room.sysMes, rid]);

	// Return utility functions cho manual invalidation
	return {
		invalidateRoom: () => messageCache.invalidateRoom(rid),
		getCacheStats: () => messageCache.getStats(),
		clearCache: () => messageCache.clear(),
	};
};