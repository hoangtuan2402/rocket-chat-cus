export interface BackgroundRefreshConfig {
	inactiveTime: number;
	refreshInterval: number;
	enabled: boolean;
	preserveCurrentRoom: boolean;
}

export interface PreservedRoomData {
	rid: string;
	messages?: any[];
	scroll?: number;
	lastTime?: Date;
	atBottom?: boolean;
}

export type BackgroundRefreshEvents = {
	'refresh/started': void;
	'refresh/completed': void;
	'config/changed': BackgroundRefreshConfig;
	'preserve/room': PreservedRoomData;
	'restore/room': PreservedRoomData;
};