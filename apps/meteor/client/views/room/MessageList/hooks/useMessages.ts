import type { IRoom, IMessage, MessageTypesValues } from '@rocket.chat/core-typings';
import { useStableArray } from '@rocket.chat/fuselage-hooks';
import { useSetting, useUserPreference } from '@rocket.chat/ui-contexts';
import type { Mongo } from 'meteor/mongo';
import { useCallback, useMemo, useRef } from 'react';

import { Messages } from '../../../../../app/models/client';
import { useReactiveValue } from '../../../../hooks/useReactiveValue';
import { useRoom } from '../../contexts/RoomContext';
import { messageCache } from '../../../../lib/chats/MessageCache';

const mergeHideSysMessages = (
	sysMesArray1: Array<MessageTypesValues>,
	sysMesArray2: Array<MessageTypesValues>,
): Array<MessageTypesValues> => {
	return Array.from(new Set([...sysMesArray1, ...sysMesArray2]));
};

// Cache for computed queries to avoid unnecessary re-computations
const queryCache = new Map<string, Mongo.Selector<IMessage>>();

export const useMessages = ({ rid }: { rid: IRoom['_id'] }): IMessage[] => {
	const showThreadsInMainChannel = useUserPreference<boolean>('showThreadsInMainChannel', false);
	const hideSysMesSetting = useSetting<MessageTypesValues[]>('Hide_System_Messages', []);
	const room = useRoom();
	const hideRoomSysMes: Array<MessageTypesValues> = Array.isArray(room.sysMes) ? room.sysMes : [];

	const hideSysMessages = useStableArray(mergeHideSysMessages(hideSysMesSetting, hideRoomSysMes));

	// Create cache key for query memoization
	const cacheKey = useMemo(() => {
		return `${rid}-${JSON.stringify(hideSysMessages)}-${showThreadsInMainChannel}`;
	}, [rid, hideSysMessages, showThreadsInMainChannel]);

	const query: Mongo.Selector<IMessage> = useMemo(() => {
		// Check cache first
		const cachedQuery = queryCache.get(cacheKey);
		if (cachedQuery) {
			return cachedQuery;
		}

		const newQuery = {
			rid,
			_hidden: { $ne: true },
			t: { $nin: hideSysMessages },
			...(!showThreadsInMainChannel && {
				$or: [{ tmid: { $exists: false } }, { tshow: { $eq: true } }],
			}),
		};

		// Cache the query
		queryCache.set(cacheKey, newQuery);
		
		// Cleanup cache if it gets too large
		if (queryCache.size > 100) {
			const firstKey = queryCache.keys().next().value;
			queryCache.delete(firstKey);
		}

		return newQuery;
	}, [rid, hideSysMessages, showThreadsInMainChannel, cacheKey]);

	// Pre-compiled sort options to avoid recreating objects
	const sortOptionsRef = useRef({ ts: 1 });

	return useReactiveValue(
		useCallback(() => {
			// Check optimized cache first
			const cachedMessages = messageCache.get(cacheKey);
			if (cachedMessages) {
				return cachedMessages;
			}

			// Fetch from database
			const messages = Messages.find(query, {
				sort: sortOptionsRef.current,
			}).fetch();

			// Cache the result with query signature
			messageCache.set(cacheKey, messages, JSON.stringify(query));

			return messages;
		}, [query, cacheKey]),
	);
};
