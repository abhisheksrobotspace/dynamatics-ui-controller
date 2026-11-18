/** MQTT topics for wifi-app + device-app ↔ ioware-pro-hal. */

export const DEVICE_PUBLISH_TOPICS = {
	GET_DEVICE_SETTINGS: '/iow/getDeviceSettings',
	GET_WIFI_NETWORKS: '/iow/getWifiNetworks',
	WIFI_LOGIN: '/iow/wifiLogin',
	WIFI_FORGET: '/iow/wifiForget'
} as const;

export const DEVICE_SUBSCRIBE_TOPICS = {
	DEVICE_SETTINGS: '/iow/deviceSettings',
	WIFI_NETWORKS: '/iow/wifiNetworks',
	WIFI_LOGIN_STATUS: '/iow/wifiLoginStatus',
	WIFI_FORGET_STATUS: '/iow/wifiForgetStatus',
	INTERNET_CONNECTION_STATUS: '/iow/internetConnectionStatus'
} as const;
