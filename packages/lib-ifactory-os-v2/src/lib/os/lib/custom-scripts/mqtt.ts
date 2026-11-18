import { Runtime } from './runtime.js';

/** Singleton MQTT runtime client for ioWare OS. */
export const globalMqtt = new Runtime('ioware');
