/// <reference types="vite/client" />

/** Injected by vite.config.ts: package version plus short git commit, e.g. "0.1.0-e019862". */
declare const __APP_VERSION__: string;
/** Injected by vite.config.ts: a release build (RELEASE_TAG, or the commit carrying the version's tag). */
declare const __RELEASE_BUILD__: boolean;
/** Injected by vite.config.ts: the dev-mode passphrase's salted SHA-256 (DEV_MODE_HASH), or ''. */
declare const __DEV_LOCK_HASH__: string;
