import { Field, FieldLabel, FieldRow, FieldHint, ToggleSwitch, NumberInput, Button, Box } from '@rocket.chat/fuselage';
import { useToastMessageDispatch, useTranslation } from '@rocket.chat/ui-contexts';
import React, { useState, useEffect } from 'react';

import { backgroundRefreshManager } from '../lib/backgroundRefresh/SimpleManager';

const BackgroundRefreshSettings = (): JSX.Element => {
	const t = useTranslation();
	const dispatchToastMessage = useToastMessageDispatch();
	
	const [enabled, setEnabled] = useState(true);
	const [inactiveTime, setInactiveTime] = useState(5);
	const [refreshInterval, setRefreshInterval] = useState(10);
	const [preserveCurrentRoom, setPreserveCurrentRoom] = useState(true);
	const [status, setStatus] = useState<any>(null);

	useEffect(() => {
		const updateStatus = () => {
			setStatus(backgroundRefreshManager.getStatus());
		};

		updateStatus();
		const interval = setInterval(updateStatus, 5000);

		return () => clearInterval(interval);
	}, []);

	const handleSaveSettings = () => {
		try {
			backgroundRefreshManager.updateConfig({
				enabled,
				inactiveTime: inactiveTime * 60 * 1000, // Convert minutes to milliseconds
				refreshInterval: refreshInterval * 60 * 1000,
				preserveCurrentRoom,
			});

			dispatchToastMessage({
				type: 'success',
				message: t('Background refresh settings saved'),
			});
		} catch (error) {
			dispatchToastMessage({
				type: 'error',
				message: t('Error saving settings'),
			});
		}
	};

	const formatTime = (ms: number) => {
		return Math.round(ms / (1000 * 60)) + ' minutes';
	};

	return (
		<Box>
			<Field>
				<FieldLabel>{t('Enable Background Memory Cleanup')}</FieldLabel>
				<FieldRow>
					<ToggleSwitch checked={enabled} onChange={setEnabled} />
				</FieldRow>
				<FieldHint>
					{t('Automatically cleanup memory when the user is inactive to prevent RAM buildup')}
				</FieldHint>
			</Field>

			<Field>
				<FieldLabel>{t('Inactivity Threshold (minutes)')}</FieldLabel>
				<FieldRow>
					<NumberInput
						value={inactiveTime}
						onChange={(event) => setInactiveTime(parseInt(event.currentTarget.value) || 5)}
						min={1}
						max={60}
					/>
				</FieldRow>
				<FieldHint>
					{t('Time of user inactivity before starting background cleanup')}
				</FieldHint>
			</Field>

			<Field>
				<FieldLabel>{t('Refresh Interval (minutes)')}</FieldLabel>
				<FieldRow>
					<NumberInput
						value={refreshInterval}
						onChange={(event) => setRefreshInterval(parseInt(event.currentTarget.value) || 10)}
						min={1}
						max={120}
					/>
				</FieldRow>
				<FieldHint>
					{t('How often to perform cleanup while user is inactive')}
				</FieldHint>
			</Field>

			<Field>
				<FieldLabel>{t('Preserve Current Room Messages')}</FieldLabel>
				<FieldRow>
					<ToggleSwitch checked={preserveCurrentRoom} onChange={setPreserveCurrentRoom} />
				</FieldRow>
				<FieldHint>
					{t('Keep messages and state for the currently open room during cleanup')}
				</FieldHint>
			</Field>

			<Field>
				<FieldRow>
					<Button primary onClick={handleSaveSettings}>
						{t('Save Settings')}
					</Button>
				</FieldRow>
			</Field>

			{status && (
				<Box marginBlockStart={24}>
					<FieldLabel>{t('Status')}</FieldLabel>
					<Box
						padding={16}
						backgroundColor="neutral-100"
						borderRadius={4}
						fontFamily="mono"
						fontSize="c1"
					>
						<div><strong>{t('Enabled')}:</strong> {status.enabled ? 'Yes' : 'No'}</div>
						<div><strong>{t('User Active')}:</strong> {status.userActive ? 'Yes' : 'No'}</div>
						<div><strong>{t('Last Activity')}:</strong> {status.lastActivity.toLocaleString()}</div>
						<div><strong>{t('Time Since Last Activity')}:</strong> {formatTime(status.timeSinceLastActivity)}</div>
						<div><strong>{t('Inactive Threshold')}:</strong> {formatTime(status.inactiveThreshold)}</div>
						<div><strong>{t('Refresh Interval')}:</strong> {formatTime(status.refreshInterval)}</div>
						<div><strong>{t('Tracked Computations')}:</strong> {status.trackedComputations}</div>
					</Box>
				</Box>
			)}
		</Box>
	);
};

export default BackgroundRefreshSettings;