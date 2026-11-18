import {
	CACHE_TYPE,
	DB_KEYPATH,
	DB_NAME,
	DB_STORE,
	DB_TRANSACTION,
	STORAGE_TYPES
} from './constants.js';

export async function getCachedData(
	url: string,
	storageType: string = STORAGE_TYPES.CACHE_STORAGE,
	key?: string
): Promise<unknown> {
	try {
		switch (storageType) {
			case STORAGE_TYPES.INDEXED_DB:
				return handleIndexedDB(CACHE_TYPE.GET_CACHE, key as string, storageType);
			case STORAGE_TYPES.CACHE_STORAGE:
				return await handleCacheStorage(CACHE_TYPE.GET_CACHE, url);
			case STORAGE_TYPES.LOCAL_STORAGE:
				return handleStorage(CACHE_TYPE.GET_CACHE, key as string, storageType);
			case STORAGE_TYPES.SESSION_STORAGE:
				return handleStorage(CACHE_TYPE.GET_CACHE, key as string, storageType);
			default:
				return null;
		}
	} catch (error) {
		console.error('Error in getCachedData: ', error);
		return null;
	}
}

export async function setCachedData(
	key: string,
	data: unknown,
	storageType: string = STORAGE_TYPES.CACHE_STORAGE,
	validForInMillis?: number
): Promise<unknown> {
	try {
		const expiresAt =
			validForInMillis !== undefined &&
			!isNaN(Number(validForInMillis)) &&
			Number.isFinite(Number(validForInMillis))
				? Date.now() + Number(validForInMillis)
				: null;
		const cachedData = { key, data, expiresAt };
		switch (storageType) {
			case STORAGE_TYPES.INDEXED_DB:
				return handleIndexedDB(CACHE_TYPE.SET_CACHE, key, storageType, cachedData);
			case STORAGE_TYPES.CACHE_STORAGE:
				return handleCacheStorage(CACHE_TYPE.SET_CACHE, key, data, storageType, validForInMillis);
			case STORAGE_TYPES.LOCAL_STORAGE:
				return handleStorage(CACHE_TYPE.SET_CACHE, key, storageType, cachedData);
			case STORAGE_TYPES.SESSION_STORAGE:
				return handleStorage(CACHE_TYPE.SET_CACHE, key, storageType, cachedData);
			default:
				return null;
		}
	} catch (error) {
		console.error('Error while setting cache: ', error);
	}
}

export async function deleteCachedData(
	key: string,
	storageType: string = STORAGE_TYPES.CACHE_STORAGE
): Promise<unknown> {
	try {
		if (storageType === STORAGE_TYPES.INDEXED_DB) {
			const db = await openDB();
			const transaction = db.transaction(DB_STORE, DB_TRANSACTION.READ_WRITE as IDBTransactionMode);
			const objectStore = transaction.objectStore(DB_STORE);
			objectStore.delete(key);
			return null;
		}

		if (storageType === STORAGE_TYPES.CACHE_STORAGE) {
			if ('caches' in window) {
				const cache = await caches.open(DB_NAME);
				await cache.delete(key);
			}
			return null;
		}
		const winStorage = (window as unknown as Record<string, Storage>)[storageType];
		if (winStorage) {
			winStorage.removeItem(key);
		}
		return null;
	} catch (error) {
		console.error('Error in deleteCachedData: ', error);
	}
}

function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(DB_STORE)) {
				db.createObjectStore(DB_STORE, { keyPath: DB_KEYPATH });
			}
		};
		req.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
		req.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
	});
}

async function handleIndexedDB(
	cacheType: string,
	key: string,
	storageType: string,
	cachedData?: unknown
): Promise<unknown> {
	try {
		const db = await openDB();
		let transaction;
		if (cacheType === CACHE_TYPE.GET_CACHE) {
			transaction = db.transaction(DB_STORE, DB_TRANSACTION.READ_ONLY as IDBTransactionMode);
		} else {
			transaction = db.transaction(DB_STORE, DB_TRANSACTION.READ_WRITE as IDBTransactionMode);
		}
		const objectStore = transaction.objectStore(DB_STORE);
		switch (cacheType) {
			case CACHE_TYPE.GET_CACHE:
				return new Promise((resolve, reject) => {
					const request = objectStore.get(key);
					request.onsuccess = (event) => {
						const entry = (event.target as IDBRequest).result;
						if (!entry) return resolve(null);

						// check expiry
						if (!entry.expiresAt || entry.expiresAt > Date.now()) {
							resolve(entry.data);
						} else {
							deleteCachedData(key, storageType);
							resolve(null);
						}
					};
					request.onerror = (event) => {
						console.error('Error in getCachedData:', event);
						reject((event.target as IDBRequest).error);
					};
				});

			case CACHE_TYPE.SET_CACHE:
				return new Promise((resolve, reject) => {
					const request = objectStore.put(cachedData);
					request.onsuccess = () => resolve(true);
					request.onerror = (event) => {
						console.error('Error while inserting value:', event);
						reject((event.target as IDBRequest).error);
					};
				});
			default:
				return null;
		}
	} catch (error) {
		console.error('Error in handleIndexedDB: ', error);
		return null;
	}
}

function handleStorage(
	cacheType: string,
	key: string,
	storageType: string,
	cachedData?: unknown
): unknown {
	try {
		const winStorage = (window as unknown as Record<string, Storage>)[storageType];
		if (!winStorage) return null;
		switch (cacheType) {
			case CACHE_TYPE.GET_CACHE: {
				const data = winStorage.getItem(key);
				if (data) {
					const parsedData = JSON.parse(data);
					if (!parsedData.expiresAt) {
						return parsedData.data;
					}
					if (parsedData.expiresAt > Date.now()) {
						return parsedData.data;
					}
					deleteCachedData(key, storageType);
				}
				return null;
			}
			case CACHE_TYPE.SET_CACHE:
				winStorage.setItem(key, JSON.stringify(cachedData));
				return;
		}
	} catch (error) {
		console.error('Error in handleStorage: ', error);
		return null;
	}
}

async function handleCacheStorage(
	cacheType: string,
	url: string,
	response?: unknown,
	storageType?: string,
	validForInMillis?: number
): Promise<unknown> {
	try {
		switch (cacheType) {
			case CACHE_TYPE.GET_CACHE:
				if ('caches' in window) {
					return window.caches.match(url).then(async (res) => {
						if (res) {
							const jsonRes = await res.json();
							if (jsonRes.expiresAt > Date.now()) {
								return jsonRes.data;
							}
							if (storageType) {
								deleteCachedData(url, storageType);
							}
						}
						return null;
					});
				}
				return null;
			case CACHE_TYPE.SET_CACHE:
				if ('caches' in window) {
					const cache = await window.caches.open(DB_NAME);
					const expiresAt =
						validForInMillis !== undefined &&
						!isNaN(Number(validForInMillis)) &&
						Number.isFinite(Number(validForInMillis))
							? Date.now() + Number(validForInMillis)
							: null;
					await cache.put(url, new Response(JSON.stringify({ expiresAt, data: response })));
				}
				return;
			default:
				return null;
		}
	} catch (error) {
		console.error('Error in handleCacheStorage: ', error);
		return null;
	}
}

export async function clearCachedData(): Promise<void> {
	localStorage.clear();
	sessionStorage.clear();

	document.cookie.split(';').forEach((cookie) => {
		document.cookie = cookie
			.replace(/^ +/, '')
			.replace(/=.*/, '=;expires=' + new Date(0).toUTCString() + ';path=/');
	});

	if ('caches' in window) {
		const cacheNames = await caches.keys();
		await Promise.all(cacheNames.map((cache) => caches.delete(cache)));
	}

	await new Promise<void>((resolve) => {
		const databases = indexedDB.databases ? indexedDB.databases() : Promise.resolve([]);
		databases.then((dbs) => {
			dbs.forEach((db) => {
				if (db.name) {
					indexedDB.deleteDatabase(db.name);
				}
			});
			resolve();
		});
	});
}
