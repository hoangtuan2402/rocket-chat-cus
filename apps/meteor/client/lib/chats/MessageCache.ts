import type { IMessage, IRoom } from '@rocket.chat/core-typings';

interface CacheEntry {
	messages: IMessage[];
	timestamp: number;
	lastFetch: number;
	query: string;
}

interface CacheStats {
	hits: number;
	misses: number;
	evictions: number;
}

/**
 * Optimized message cache with LRU eviction and TTL support
 */
export class MessageCache {
	private cache = new Map<string, CacheEntry>();
	private readonly maxSize: number;
	private readonly ttl: number;
	private readonly stats: CacheStats = { hits: 0, misses: 0, evictions: 0 };

	constructor(maxSize = 50, ttl = 30000) { // 30 seconds TTL
		this.maxSize = maxSize;
		this.ttl = ttl;
	}

	/**
	 * Get cached messages for a room
	 */
	get(cacheKey: string): IMessage[] | null {
		const entry = this.cache.get(cacheKey);
		
		if (!entry) {
			this.stats.misses++;
			return null;
		}

		const now = Date.now();
		
		// Check TTL
		if (now - entry.timestamp > this.ttl) {
			this.cache.delete(cacheKey);
			this.stats.misses++;
			return null;
		}

		// Update access time (LRU)
		entry.lastFetch = now;
		this.cache.delete(cacheKey);
		this.cache.set(cacheKey, entry);
		
		this.stats.hits++;
		return entry.messages;
	}

	/**
	 * Set cached messages for a room
	 */
	set(cacheKey: string, messages: IMessage[], query: string): void {
		const now = Date.now();
		
		// Remove oldest entries if cache is full
		if (this.cache.size >= this.maxSize) {
			this.evictLRU();
		}

		this.cache.set(cacheKey, {
			messages: [...messages], // Shallow clone to prevent mutations
			timestamp: now,
			lastFetch: now,
			query,
		});
	}

	/**
	 * Invalidate cache entries for a specific room
	 */
	invalidateRoom(rid: IRoom['_id']): void {
		for (const [key] of this.cache.entries()) {
			if (key.includes(rid)) {
				this.cache.delete(key);
			}
		}
	}

	/**
	 * Clear entire cache
	 */
	clear(): void {
		this.cache.clear();
		this.stats.hits = 0;
		this.stats.misses = 0;
		this.stats.evictions = 0;
	}

	/**
	 * Get cache statistics
	 */
	getStats(): CacheStats & { size: number; hitRate: number } {
		const total = this.stats.hits + this.stats.misses;
		return {
			...this.stats,
			size: this.cache.size,
			hitRate: total > 0 ? this.stats.hits / total : 0,
		};
	}

	/**
	 * Cleanup expired entries
	 */
	cleanup(): void {
		const now = Date.now();
		for (const [key, entry] of this.cache.entries()) {
			if (now - entry.timestamp > this.ttl) {
				this.cache.delete(key);
			}
		}
	}

	/**
	 * Evict least recently used entry
	 */
	private evictLRU(): void {
		let oldestKey = '';
		let oldestTime = Date.now();

		for (const [key, entry] of this.cache.entries()) {
			if (entry.lastFetch < oldestTime) {
				oldestTime = entry.lastFetch;
				oldestKey = key;
			}
		}

		if (oldestKey) {
			this.cache.delete(oldestKey);
			this.stats.evictions++;
		}
	}
}

// Global message cache instance
export const messageCache = new MessageCache();

// Cleanup expired entries every 5 minutes
setInterval(() => messageCache.cleanup(), 5 * 60 * 1000);