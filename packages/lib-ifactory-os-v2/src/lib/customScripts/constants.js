const CACHE_TYPE = {
	SET_CACHE: 'setCache',
	GET_CACHE: 'getCache',
	DELETE_CACHE: 'deleteCache'
};
const DB_KEYPATH = 'key';
const DB_NAME = 'cacheData';
const DB_STORE = 'cacheStore';
const DB_TRANSACTION = {
	READ_ONLY: 'readonly',
	READ_WRITE: 'readwrite'
};
const STORAGE_TYPES = {
	LOCAL_STORAGE: 'localStorage',
	SESSION_STORAGE: 'sessionStorage',
	INDEXED_DB: 'indexedDB',
	CACHE_STORAGE: 'cacheStorage'
};

export { CACHE_TYPE, DB_KEYPATH, DB_NAME, DB_STORE, DB_TRANSACTION, STORAGE_TYPES };
