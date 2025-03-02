class Soldier extends Phaser.GameObjects.Arc {
    constructor(scene, x, y, targetX, targetY, isPlayerOwned) {
        super(scene, x, y, 5, 0, 360, false, isPlayerOwned ? 0x3498db : 0xff4444);
        scene.add.existing(this);
        
        this.isPlayerOwned = isPlayerOwned;
        
        // Calculate velocity for consistent speed regardless of distance
        const dx = targetX - x;
        const dy = targetY - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const speed = 200; // pixels per second
        
        this.vx = (dx / distance) * speed;
        this.vy = (dy / distance) * speed;
        
        this.targetX = targetX;
        this.targetY = targetY;
    }

    update(time, delta) {
        // Move towards target
        const deltaSeconds = delta / 1000;
        this.x += this.vx * deltaSeconds;
        this.y += this.vy * deltaSeconds;

        // Check if reached target
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distanceSquared = dx * dx + dy * dy;
        
        return distanceSquared < 100; // Return true if reached target
    }
}

class Building extends Phaser.GameObjects.Container {
    constructor(scene, x, y, ownership = 'neutral') {  // ownership can be 'player', 'enemy', or 'neutral'
        super(scene, x, y);
        
        // Initialize properties
        this.soldiers = 10;
        this.lastUpdate = Date.now();
        this.isSelected = false;
        this.ownership = ownership;
        this.isPlayerOwned = ownership === 'player';  // maintain backwards compatibility

        // Create building shape (circle)
        const color = this.getBuildingColor();
        this.building = scene.add.circle(0, 0, 40, color);
        this.add(this.building);

        // Create selection indicator (ring)
        this.selectionRing = scene.add.circle(0, 0, 45);
        this.selectionRing.setStrokeStyle(4, 0xffffff);
        this.selectionRing.setVisible(false);
        this.add(this.selectionRing);

        // Create soldier counter text
        this.soldierText = scene.add.text(0, 0, this.soldiers.toString(), {
            fontSize: '24px',
            color: '#ffffff',
            fontFamily: 'Arial',
            resolution: 2,           // Higher resolution for sharper text
            antialias: false        // Disable antialiasing for crisp edges
        });
        this.soldierText.setOrigin(0.5);
        this.soldierText.setPosition(Math.round(this.soldierText.x), Math.round(this.soldierText.y)); // Ensure integer position
        this.add(this.soldierText);

        // Make building clickable for both left and right clicks
        this.building.setInteractive();
        this.setupInteractions(scene);

        // Add to scene
        scene.add.existing(this);
    }

    setupInteractions(scene) {
        // Remove any existing listeners first (important for scene restart)
        this.building.removeAllListeners();
        
        // Add new listeners
        this.building.on('pointerdown', (pointer) => {
            if (pointer.rightButtonDown()) {
                scene.handleRightClick(this);
            } else if (this.isPlayerOwned) {
                scene.selectBuilding(this);
            }
        });
    }
    
    // Override destroy method to ensure proper cleanup
    destroy(fromScene) {
        // Remove all listeners
        if (this.building) {
            this.building.removeAllListeners();
        }
        
        // Call parent destroy method
        super.destroy(fromScene);
    }

    getBuildingColor() {
        switch(this.ownership) {
            case 'player': return 0x4477FF;  // Blue
            case 'enemy': return 0xFF4444;   // Red
            case 'neutral': return 0x888888; // Grey
            default: return 0x888888;
        }
    }

    update(time, delta, scene) {
        const now = Date.now();
        if (now - this.lastUpdate >= 1000) {  // Every second
            if (this.ownership !== 'neutral') {  // Only non-neutral buildings generate soldiers
                this.soldiers++;
                this.soldierText.setText(this.soldiers.toString());
                
                // Update soldier counts when soldiers are generated
                if (scene && scene.calculateSoldierCounts) {
                    scene.calculateSoldierCounts();
                }
            }
            this.lastUpdate = now;
        }
    }

    setOwnership(newOwnership) {
        this.ownership = newOwnership;
        this.isPlayerOwned = newOwnership === 'player';
        this.building.setFillStyle(this.getBuildingColor());
        
        // Update soldier counts when ownership changes
        if (this.scene && this.scene.calculateSoldierCounts) {
            this.scene.calculateSoldierCounts();
        }
    }

    setSelected(selected) {
        this.isSelected = selected;
        this.selectionRing.setVisible(selected);
    }
}

class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
    }

    init() {
        // Initialize/reset all game state variables
        this.gameOver = false;
        this.selectedBuilding = null;
        
        // Initialize player data with soldier tracking
        this.players = {
            player: {
                id: 'player',
                name: 'Player',
                color: 0x4477FF,
                soldierCount: 0
            },
            enemy: {
                id: 'enemy',
                name: 'Enemy',
                color: 0xFF4444,
                soldierCount: 0
            }
        };
        
        // Make sure to clear these arrays rather than reassigning them
        if (this.activeSoldiers) {
            // Destroy any existing soldiers
            this.activeSoldiers.forEach(soldier => {
                if (soldier && soldier.destroy) {
                    soldier.destroy();
                }
            });
        }
        this.activeSoldiers = [];
        
        // Buildings will be recreated in create()
        if (this.buildings) {
            this.buildings.forEach(building => {
                if (building && building.destroy) {
                    building.destroy();
                }
            });
        }
        this.buildings = [];
        
        // Clear any existing timers or tweens
        if (this.time) {
            this.time.removeAllEvents();
        }
        if (this.tweens) {
            this.tweens.killAll();
        }
    }

    // Add a shutdown method to handle cleanup when the scene is stopped
    shutdown() {
        // Clean up any listeners that might persist
        this.input.off('pointerdown');
        this.input.off('pointerup');
        
        // Destroy all game objects
        if (this.activeSoldiers) {
            this.activeSoldiers.forEach(soldier => {
                if (soldier && soldier.destroy) {
                    soldier.destroy();
                }
            });
            this.activeSoldiers = [];
        }
        
        if (this.buildings) {
            this.buildings.forEach(building => {
                if (building && building.destroy) {
                    building.destroy();
                }
            });
            this.buildings = [];
        }
        
        // Clear any timers or tweens
        if (this.time) {
            this.time.removeAllEvents();
        }
        if (this.tweens) {
            this.tweens.killAll();
        }
        
        // Clear any references
        this.selectedBuilding = null;
        
        // Clean up UI elements
        if (this.playerUI) {
            Object.values(this.playerUI).forEach(ui => {
                if (ui.soldierText) ui.soldierText.destroy();
            });
            this.playerUI = null;
        }
    }

    isOverlapping(x, y, buildings) {
        const minDistance = 100; // Minimum distance between building centers
        for (const building of buildings) {
            const dx = x - building.x;
            const dy = y - building.y;
            const distanceSquared = dx * dx + dy * dy;
            if (distanceSquared < minDistance * minDistance) {
                return true;
            }
        }
        return false;
    }

    getValidBuildingPosition(minX, maxX, minY, maxY, buildings) {
        let x, y;
        let attempts = 0;
        const maxAttempts = 100;

        do {
            x = minX + Math.random() * (maxX - minX);
            y = minY + Math.random() * (maxY - minY);
            attempts++;
        } while (this.isOverlapping(x, y, buildings) && attempts < maxAttempts);

        if (attempts === maxAttempts) {
            // If we couldn't find a spot after max attempts, expand the area slightly
            minX -= 50;
            maxX += 50;
            x = minX + Math.random() * (maxX - minX);
            y = minY + Math.random() * (maxY - minY);
        }

        return { x, y };
    }

    create() {
        // Disable right click menu
        this.input.mouse.disableContextMenu();

        // Initialize buildings array
        this.buildings = [];
        
        // Initialize soldiers array
        this.activeSoldiers = [];

        const screenWidth = this.cameras.main.width;
        const screenHeight = this.cameras.main.height;

        // Add player buildings (left side)
        for (let i = 0; i < 4; i++) {
            const minX = screenWidth * 0.15;
            const maxX = screenWidth * 0.35;
            const minY = screenHeight * 0.2;
            const maxY = screenHeight * 0.8;
            
            const pos = this.getValidBuildingPosition(minX, maxX, minY, maxY, this.buildings);
            this.buildings.push(new Building(this, pos.x, pos.y, 'player'));
        }

        // Add enemy buildings (right side)
        for (let i = 0; i < 4; i++) {
            const minX = screenWidth * 0.65;
            const maxX = screenWidth * 0.85;
            const minY = screenHeight * 0.2;
            const maxY = screenHeight * 0.8;
            
            const pos = this.getValidBuildingPosition(minX, maxX, minY, maxY, this.buildings);
            this.buildings.push(new Building(this, pos.x, pos.y, 'enemy'));
        }

        // Add neutral buildings (middle area)
        for (let i = 0; i < 6; i++) {
            const minX = screenWidth * 0.35;
            const maxX = screenWidth * 0.65;
            const minY = screenHeight * 0.2;
            const maxY = screenHeight * 0.8;
            
            const pos = this.getValidBuildingPosition(minX, maxX, minY, maxY, this.buildings);
            this.buildings.push(new Building(this, pos.x, pos.y, 'neutral'));
        }

        this.selectedBuilding = null;
        
        // Create UI for soldier counts
        this.createSoldierCountUI();
        
        // Calculate initial soldier counts
        this.calculateSoldierCounts();
    }
    
    createSoldierCountUI() {
        this.playerUI = {};
        
        // Create player soldier count text
        this.playerUI.player = {
            soldierText: this.add.text(20, 20, 'Player: 0', {
                fontSize: '24px',
                color: '#FFFFFF',
                fontFamily: 'Arial',
                resolution: 2,
                antialias: false
            })
        };
        
        // Create enemy soldier count text
        this.playerUI.enemy = {
            soldierText: this.add.text(20, 60, 'Enemy: 0', {
                fontSize: '24px',
                color: '#FFFFFF',
                fontFamily: 'Arial',
                resolution: 2,
                antialias: false
            })
        };
        
        // Set depth to ensure it's always visible
        this.playerUI.player.soldierText.setDepth(100);
        this.playerUI.enemy.soldierText.setDepth(100);
    }
    
    calculateSoldierCounts() {
        // Reset counts
        this.players.player.soldierCount = 0;
        this.players.enemy.soldierCount = 0;
        
        // Count soldiers in buildings
        this.buildings.forEach(building => {
            if (!building || !building.active) return;
            
            if (building.ownership === 'player') {
                this.players.player.soldierCount += building.soldiers;
            } else if (building.ownership === 'enemy') {
                this.players.enemy.soldierCount += building.soldiers;
            }
        });
        
        // Count soldiers on the field
        this.activeSoldiers.forEach(soldier => {
            if (!soldier || !soldier.active) return;
            
            if (soldier.isPlayerOwned) {
                this.players.player.soldierCount += 1;
            } else {
                this.players.enemy.soldierCount += 1;
            }
        });
        
        // Update UI
        if (this.playerUI) {
            this.playerUI.player.soldierText.setText(`Player: ${this.players.player.soldierCount}`);
            this.playerUI.enemy.soldierText.setText(`Enemy: ${this.players.enemy.soldierCount}`);
        }
    }

    showGameOverModal(isWin) {
        // Create semi-transparent background
        const modalBg = this.add.rectangle(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            this.cameras.main.width,
            this.cameras.main.height,
            0x000000,
            0.8
        );
        modalBg.setDepth(100);

        // Create modal box with gradient fill
        const modalWidth = 500;
        const modalHeight = 300;
        const modalBox = this.add.graphics();
        modalBox.setDepth(101);

        // Draw modal background with gradient
        modalBox.fillStyle(0x2d2d2d, 1);
        modalBox.fillRoundedRect(
            this.cameras.main.width / 2 - modalWidth / 2,
            this.cameras.main.height / 2 - modalHeight / 2,
            modalWidth,
            modalHeight,
            16
        );

        // Add border
        modalBox.lineStyle(2, 0x4477FF, 1);
        modalBox.strokeRoundedRect(
            this.cameras.main.width / 2 - modalWidth / 2,
            this.cameras.main.height / 2 - modalHeight / 2,
            modalWidth,
            modalHeight,
            16
        );

        // Add header text
        const headerText = isWin ? 'VICTORY!' : 'DEFEAT!';
        const header = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2 - 80,
            headerText,
            {
                fontSize: '48px',
                color: isWin ? '#4CAF50' : '#f44336',
                fontFamily: 'Arial',
                fontWeight: 'bold',
                resolution: 2,
                antialias: false
            }
        );
        header.setPosition(Math.round(header.x), Math.round(header.y));
        header.setOrigin(0.5);
        header.setDepth(102);

        // Add message text
        const message = isWin ? 
            'You have captured all enemy buildings!' : 
            'All your buildings have been captured!';
        const modalText = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            message,
            {
                fontSize: '24px',
                color: '#ffffff',
                fontFamily: 'Arial',
                align: 'center',
                resolution: 2,
                antialias: false
            }
        );
        modalText.setPosition(Math.round(modalText.x), Math.round(modalText.y));
        modalText.setOrigin(0.5);
        modalText.setDepth(102);

        // Create button background with hover effect
        const buttonWidth = 200;
        const buttonHeight = 50;
        const buttonX = this.cameras.main.width / 2;
        const buttonY = this.cameras.main.height / 2 + 80;

        const button = this.add.graphics();
        button.setDepth(102);

        // Draw button
        const drawButton = (fillColor) => {
            button.clear();
            button.fillStyle(fillColor, 1);
            button.fillRoundedRect(
                buttonX - buttonWidth / 2,
                buttonY - buttonHeight / 2,
                buttonWidth,
                buttonHeight,
                10
            );
        };

        // Initial button state
        drawButton(0x4477FF);

        // Create interactive zone for the button
        const buttonZone = this.add.zone(
            buttonX,
            buttonY,
            buttonWidth,
            buttonHeight
        );
        buttonZone.setInteractive({ useHandCursor: true });

        // Button hover effects
        buttonZone.on('pointerover', () => drawButton(0x5588FF));
        buttonZone.on('pointerout', () => drawButton(0x4477FF));
        buttonZone.on('pointerdown', () => drawButton(0x3366EE));
        buttonZone.on('pointerup', () => {
            drawButton(0x4477FF);
            this.scene.restart();
        });

        // Add button text
        const buttonText = this.add.text(
            buttonX,
            buttonY,
            'Play Again',
            {
                fontSize: '24px',
                color: '#ffffff',
                fontFamily: 'Arial',
                fontWeight: 'bold',
                resolution: 2,
                antialias: false
            }
        );
        buttonText.setPosition(Math.round(buttonText.x), Math.round(buttonText.y));
        buttonText.setOrigin(0.5);
        buttonText.setDepth(103);
    }

    checkGameOver() {
        if (this.gameOver) return;

        let playerHasBuildings = false;
        let enemyHasBuildings = false;

        // Check if either player has buildings
        if (this.buildings) {
            this.buildings.forEach(building => {
                if (!building || !building.active) return;
                
                if (building.ownership === 'player') {
                    playerHasBuildings = true;
                } else if (building.ownership === 'enemy') {
                    enemyHasBuildings = true;
                }
            });
        }

        // Check win/lose conditions
        if (playerHasBuildings && !enemyHasBuildings) {
            this.gameOver = true;
            this.showGameOverModal(true); // Show win modal
        } else if (enemyHasBuildings && !playerHasBuildings) {
            this.gameOver = true;
            this.showGameOverModal(false); // Show lose modal
        }
    }

    update(time, delta) {
        if (this.gameOver) return;

        // Update all buildings
        if (this.buildings) {
            this.buildings.forEach(building => {
                if (building && building.update) {
                    building.update(time, delta, this);
                }
            });
        }

        // Update and check soldiers
        if (this.activeSoldiers) {
            // Create a new array for soldiers that are still active
            const stillActiveSoldiers = [];
            let soldierCountChanged = false;
            
            for (let i = 0; i < this.activeSoldiers.length; i++) {
                const soldier = this.activeSoldiers[i];
                
                // Skip if soldier is undefined or has been destroyed
                if (!soldier || !soldier.active) continue;
                
                try {
                    const reachedTarget = soldier.update(time, delta);
                    
                    if (reachedTarget) {
                        // Handle individual soldier arrival
                        const targetBuilding = this.buildings.find(b => {
                            if (!b || !b.active) return false;
                            
                            const dx = b.x - soldier.targetX;
                            const dy = b.y - soldier.targetY;
                            const distanceSquared = dx * dx + dy * dy;
                            return distanceSquared < 2500; // 50 pixel radius check
                        });
                        
                        if (targetBuilding) {
                            if (targetBuilding.ownership === (soldier.isPlayerOwned ? 'player' : 'enemy')) {
                                // Friendly building - add one soldier
                                targetBuilding.soldiers++;
                            } else {
                                // Enemy or neutral building - subtract one soldier
                                targetBuilding.soldiers--;
                                // Check for capture
                                if (targetBuilding.soldiers < 0) {
                                    targetBuilding.setOwnership(soldier.isPlayerOwned ? 'player' : 'enemy');
                                    targetBuilding.soldiers = Math.abs(targetBuilding.soldiers);
                                    
                                    // Visual feedback for capture
                                    this.tweens.add({
                                        targets: targetBuilding.building,
                                        scaleX: 1.2,
                                        scaleY: 1.2,
                                        duration: 200,
                                        yoyo: true,
                                        ease: 'Quad.easeInOut'
                                    });
                                }
                            }
                            targetBuilding.soldierText.setText(targetBuilding.soldiers.toString());
                            soldierCountChanged = true;
                        }
                        
                        // Destroy the soldier
                        soldier.destroy();
                        soldierCountChanged = true;
                    } else {
                        // Soldier is still active, keep it
                        stillActiveSoldiers.push(soldier);
                    }
                } catch (error) {
                    console.error("Error processing soldier:", error);
                    // If there's an error, destroy the soldier to prevent future errors
                    if (soldier && soldier.destroy) {
                        soldier.destroy();
                    }
                    soldierCountChanged = true;
                }
            }
            
            // Replace the active soldiers array with only the still active ones
            this.activeSoldiers = stillActiveSoldiers;
            
            // Update soldier counts if any soldiers reached their target or were destroyed
            if (soldierCountChanged) {
                this.calculateSoldierCounts();
            }
        }

        // Check for win/lose conditions
        this.checkGameOver();
    }

    selectBuilding(building) {
        // Only allow selecting player-owned buildings
        if (!building.isPlayerOwned) return;

        // Deselect previously selected building
        if (this.selectedBuilding) {
            this.selectedBuilding.setSelected(false);
        }

        // If clicking the same building, deselect it
        if (this.selectedBuilding === building) {
            this.selectedBuilding = null;
        } else {
            // Select the new building
            this.selectedBuilding = building;
            building.setSelected(true);
        }
    }

    handleRightClick(targetBuilding) {
        if (!this.selectedBuilding || this.selectedBuilding === targetBuilding) return;

        const sourceBuilding = this.selectedBuilding; // Store the source building
        
        // Check if there are soldiers to send
        if (sourceBuilding.soldiers <= 0) return;
        
        // Store the number of soldiers to send
        const soldiersToSend = sourceBuilding.soldiers;
        
        // Remove soldiers from source building
        sourceBuilding.soldiers = 0;
        sourceBuilding.soldierText.setText('0');
        
        // Calculate base spawn position
        const radius = 45; // Slightly larger than building radius
        const spreadAngle = Math.PI / 2; // 90 degrees spread

        // Calculate direction to target
        const dx = targetBuilding.x - sourceBuilding.x;
        const dy = targetBuilding.y - sourceBuilding.y;
        const angleToTarget = Math.atan2(dy, dx);
        
        // Create a delayed spawn for each soldier
        for (let i = 0; i < soldiersToSend; i++) {
            const delay = (i * 100); // Spread spawns over time
            
            this.time.delayedCall(delay, () => {
                // Calculate random position in an arc behind the building
                const spreadRadius = radius + (Math.random() * 20 - 10); // Random radius variation
                const spreadAngleOffset = (Math.random() - 0.5) * spreadAngle;
                const spawnAngle = angleToTarget + spreadAngleOffset; // Spawn in front, towards target

                const spawnX = sourceBuilding.x + Math.cos(spawnAngle) * spreadRadius;
                const spawnY = sourceBuilding.y + Math.sin(spawnAngle) * spreadRadius;

                // Add some random offset to target position for more natural movement
                const targetOffsetX = (Math.random() * 40 - 20);
                const targetOffsetY = (Math.random() * 40 - 20);

                // Create soldier
                const soldier = new Soldier(
                    this,
                    spawnX,
                    spawnY,
                    targetBuilding.x + targetOffsetX,
                    targetBuilding.y + targetOffsetY,
                    sourceBuilding.isPlayerOwned
                );
                
                // Add to active soldiers array
                this.activeSoldiers.push(soldier);
                
                // Update soldier counts immediately after adding a soldier
                this.calculateSoldierCounts();
            });
        }
        
        // Update soldier counts immediately after removing soldiers from source
        this.calculateSoldierCounts();
    }
}

// Game configuration
const config = {
    type: Phaser.AUTO,
    parent: 'game',
    scale: {
        mode: Phaser.Scale.RESIZE,
        width: '100%',
        height: '100%',
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    backgroundColor: '#1a1a2e',
    scene: MainScene,
    dom: {
        createContainer: true
    }
};

// Start the game
new Phaser.Game(config); 