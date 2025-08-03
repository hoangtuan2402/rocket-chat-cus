import { OptionColumn, OptionContent, OptionDescription, OptionInput } from '@rocket.chat/fuselage';
import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';

export type ComposerBoxPopupSlashCommandProps = {
	_id: string;
	description?: string;
	params?: string;
	disabled?: boolean;
};

function ComposerBoxPopupSlashCommand({ _id, description, params, disabled }: ComposerBoxPopupSlashCommandProps) {
	const { t } = useTranslation();

	return (
		<>
			<OptionContent>
				{_id} <OptionDescription>{params}</OptionDescription>
			</OptionContent>
			<OptionColumn>
				<OptionInput>{disabled ? t('Unavailable_in_encrypted_channels') : description}</OptionInput>
			</OptionColumn>
		</>
	);
}

export default memo(ComposerBoxPopupSlashCommand);
