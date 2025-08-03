import type { IMessage, ISubscription } from '@rocket.chat/core-typings';
import { useToastMessageDispatch } from '@rocket.chat/ui-contexts';
import { debounce } from 'lodash';
import type { ReactElement, ReactNode } from 'react';
import React, { memo, useCallback, useMemo, useRef } from 'react';

import ComposerSkeleton from './ComposerSkeleton';
import { LegacyRoomManager } from '../../../../app/ui-utils/client';
import { useReactiveValue } from '../../../hooks/useReactiveValue';
import { useChat } from '../contexts/ChatContext';
import { useRoom } from '../contexts/RoomContext';
import MessageBox from './messageBox/MessageBox';

export type ComposerMessageProps = {
	tmid?: IMessage['_id'];
	children?: ReactNode;
	subscription?: ISubscription;
	tshow?: boolean;
	previewUrls?: string[];
	onResize?: () => void;
	onEscape?: () => void;
	onSend?: () => void;
	onNavigateToNextMessage?: () => void;
	onNavigateToPreviousMessage?: () => void;
	onUploadFiles?: (files: readonly File[]) => void;
};

const ComposerMessage = ({ tmid, onSend, ...props }: ComposerMessageProps): ReactElement => {
	const chat = useChat();
	const room = useRoom();
	const dispatchToastMessage = useToastMessageDispatch();

	const debouncedTypingRef = useRef(
		debounce(async (chatInstance) => {
			if (chatInstance?.composer?.text?.trim() === '') {
				await chatInstance?.action.stop('typing');
				return;
			}
			await chatInstance?.action.start('typing');
		}, 300) // Debounce 300ms thay vì gọi mỗi keystroke
	);

	const composerProps = useMemo(
		() => ({
			onJoin: async (): Promise<void> => {
				try {
					await chat?.data?.joinRoom();
				} catch (error) {
					dispatchToastMessage({ type: 'error', message: error });
					throw error;
				}
			},

			onSend: async ({
				value: text,
				tshow,
				previewUrls,
				isSlashCommandAllowed,
			}: {
				value: string;
				tshow?: boolean;
				previewUrls?: string[];
				isSlashCommandAllowed?: boolean;
			}): Promise<void> => {
				try {
					await chat?.action.stop('typing');
					const newMessageSent = await chat?.flows.sendMessage({
						text,
						tshow,
						previewUrls,
						isSlashCommandAllowed,
					});
					if (newMessageSent) onSend?.();
				} catch (error) {
					dispatchToastMessage({ type: 'error', message: error });
				}
			},
			onTyping: (): void => {
				debouncedTypingRef.current(chat);
			},
			onNavigateToPreviousMessage: () => chat?.messageEditing.toPreviousMessage(),
			onNavigateToNextMessage: () => chat?.messageEditing.toNextMessage(),
			onUploadFiles: (files: readonly File[]) => {
				return chat?.flows.uploadFiles(files);
			},
		}),
		[chat, dispatchToastMessage, onSend],
	);

	const publicationReady = useReactiveValue(
		useCallback(() => LegacyRoomManager.getOpenedRoomByRid(room._id)?.streamActive ?? false, [room._id]),
	);

	if (!publicationReady) {
		return <ComposerSkeleton />;
	}

	return <MessageBox key={room._id} tmid={tmid} {...composerProps} showFormattingTips={true} {...props} />;
};

export default memo(ComposerMessage);
