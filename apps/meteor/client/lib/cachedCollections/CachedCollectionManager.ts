import type { CachedCollection } from './CachedCollection';

class CachedCollectionManager {
	private items = new Set<CachedCollection<any>>();

	register(cachedCollection: CachedCollection<any>) {
		this.items.add(cachedCollection);
	}

	clearAllCachesOnLogout() {
		for (const item of this.items) {
			item.clearCacheOnLogout();
		}
	}

	getInstances(): Set<CachedCollection<any>> {
		return new Set(this.items);
	}

	getInstancesArray(): CachedCollection<any>[] {
		return Array.from(this.items);
	}

	getStats() {
		return {
			totalCollections: this.items.size,
			collections: Array.from(this.items).map(item => ({
				name: item.name,
				ready: item.ready.get(),
				// @ts-ignore - accessing private property for stats
				recordCount: item.collection.find().count(),
			})),
		};
	}
}

const instance = new CachedCollectionManager();

export {
	/** @deprecated */
	instance as CachedCollectionManager,
};
