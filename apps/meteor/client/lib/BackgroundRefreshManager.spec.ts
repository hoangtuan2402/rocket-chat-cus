/**
 * Test file for BackgroundRefreshManager
 * This file demonstrates how to test and use the background refresh functionality
 */

import { BackgroundRefreshManager } from './BackgroundRefreshManager';

describe('BackgroundRefreshManager', () => {
	let manager: BackgroundRefreshManager;

	beforeEach(() => {
		manager = new BackgroundRefreshManager();
	});

	afterEach(() => {
		manager.stop();
	});

	describe('Configuration', () => {
		it('should have default configuration', () => {
			const status = manager.getStatus();
			expect(status.enabled).toBe(true);
			expect(status.inactiveThreshold).toBe(5 * 60 * 1000); // 5 minutes
			expect(status.refreshInterval).toBe(10 * 60 * 1000); // 10 minutes
		});

		it('should update configuration', () => {
			manager.updateConfig({
				inactiveTime: 2 * 60 * 1000, // 2 minutes
				refreshInterval: 5 * 60 * 1000, // 5 minutes
			});

			const status = manager.getStatus();
			expect(status.inactiveThreshold).toBe(2 * 60 * 1000);
			expect(status.refreshInterval).toBe(5 * 60 * 1000);
		});

		it('should emit config changed event', (done) => {
			manager.on('config/changed', (config) => {
				expect(config.inactiveTime).toBe(3 * 60 * 1000);
				done();
			});

			manager.updateConfig({ inactiveTime: 3 * 60 * 1000 });
		});
	});

	describe('Activity Tracking', () => {
		it('should start as active', () => {
			const status = manager.getStatus();
			expect(status.userActive).toBe(true);
		});

		it('should track last activity time', () => {
			const statusBefore = manager.getStatus();
			const timeBefore = statusBefore.lastActivity.getTime();

			// Simulate activity after a delay
			setTimeout(() => {
				// Trigger activity
				document.dispatchEvent(new Event('mousedown'));
				
				const statusAfter = manager.getStatus();
				const timeAfter = statusAfter.lastActivity.getTime();
				
				expect(timeAfter).toBeGreaterThan(timeBefore);
			}, 10);
		});
	});

	describe('Memory Cleanup Events', () => {
		it('should emit refresh events', (done) => {
			let startedEmitted = false;
			
			manager.on('refresh/started', () => {
				startedEmitted = true;
			});

			manager.on('refresh/completed', () => {
				expect(startedEmitted).toBe(true);
				done();
			});

			// Manually trigger cleanup for testing
			(manager as any).performBackgroundRefresh();
		});

		it('should preserve room data during cleanup', (done) => {
			manager.on('preserve/room', (data) => {
				expect(data.rid).toBeDefined();
				done();
			});

			// Mock current room
			const mockRoomManager = {
				opened: 'test-room-id',
				getStore: () => ({
					scroll: 100,
					lastTime: new Date(),
					atBottom: false,
				}),
			};

			// Replace RoomManager temporarily for testing
			const originalRoomManager = (global as any).RoomManager;
			(global as any).RoomManager = mockRoomManager;

			(manager as any).preserveCurrentRoomData();

			// Restore
			(global as any).RoomManager = originalRoomManager;
		});
	});

	describe('Tracker Computations Management', () => {
		it('should register and track computations', () => {
			const mockComputation = { stop: jest.fn(), stopped: false };
			manager.registerTrackerComputation(mockComputation as any);

			const status = manager.getStatus();
			expect(status.trackedComputations).toBe(1);
		});

		it('should unregister computations', () => {
			const mockComputation = { stop: jest.fn(), stopped: false };
			manager.registerTrackerComputation(mockComputation as any);
			manager.unregisterTrackerComputation(mockComputation as any);

			const status = manager.getStatus();
			expect(status.trackedComputations).toBe(0);
		});

		it('should stop tracked computations during cleanup', () => {
			const mockComputation = { stop: jest.fn(), stopped: false };
			manager.registerTrackerComputation(mockComputation as any);

			// Trigger cleanup
			(manager as any).cleanupTrackerComputations();

			expect(mockComputation.stop).toHaveBeenCalled();
		});
	});
});

/**
 * Manual testing instructions:
 * 
 * 1. Open Rocket.Chat in browser
 * 2. Open browser console
 * 3. Test background refresh manager:
 *    
 *    // Check current status
 *    backgroundRefreshManager.getStatus()
 *    
 *    // Update configuration  
 *    backgroundRefreshManager.updateConfig({
 *      inactiveTime: 30000,  // 30 seconds for testing
 *      refreshInterval: 60000 // 1 minute for testing
 *    })
 *    
 *    // Watch for events
 *    backgroundRefreshManager.on('refresh/started', () => console.log('Refresh started'));
 *    backgroundRefreshManager.on('refresh/completed', () => console.log('Refresh completed'));
 *    
 *    // Simulate inactivity by switching tabs or minimizing window for 30+ seconds
 *    // Then check console for cleanup events
 *    
 *    // Check memory stats
 *    backgroundRefreshDebug.bgStatus()
 *    backgroundRefreshDebug.voipStats()  
 *    backgroundRefreshDebug.chatStats()
 *    
 *    // Force cleanup manually
 *    backgroundRefreshDebug.forceCleanup()
 * 
 * 2. Test room preservation:
 *    - Open a room with messages
 *    - Switch tabs for 30+ seconds to trigger cleanup
 *    - Switch back and verify messages are still there
 *    - Check scroll position is preserved
 * 
 * 3. Monitor memory usage:
 *    - Use browser developer tools Memory tab
 *    - Take heap snapshots before and after cleanup
 *    - Look for reduction in retained memory
 * 
 * 4. Test VoIP cleanup:
 *    - Make some VoIP calls to generate queue history
 *    - Trigger cleanup and verify old history is removed
 * 
 * 5. Test with different configurations:
 *    - Very short inactive time (10 seconds)
 *    - Frequent refresh intervals (30 seconds)  
 *    - Disabled room preservation
 */