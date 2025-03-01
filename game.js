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
        this.troops = 10;
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

        // Create troop counter text
        this.troopText = scene.add.text(0, 0, this.troops.toString(), {
            fontSize: '24px',
            color: '#ffffff',
            fontFamily: 'Arial',
            resolution: 2,           // Higher resolution for sharper text
            antialias: false        // Disable antialiasing for crisp edges
        });
        this.troopText.setOrigin(0.5);
        this.troopText.setPosition(Math.round(this.troopText.x), Math.round(this.troopText.y)); // Ensure integer position
        this.add(this.troopText);

        // Make building clickable for both left and right clicks
        this.building.setInteractive();
        this.building.on('pointerdown', (pointer) => {
            if (pointer.rightButtonDown()) {
                scene.handleRightClick(this);
            } else if (this.isPlayerOwned) {
                scene.selectBuilding(this);
            }
        });

        // Add to scene
        scene.add.existing(this);
    }

    getBuildingColor() {
        switch(this.ownership) {
            case 'player': return 0x4477FF;  // Blue
            case 'enemy': return 0xFF4444;   // Red
            case 'neutral': return 0x888888; // Grey
            default: return 0x888888;
        }
    }

    update() {
        const now = Date.now();
        if (now - this.lastUpdate >= 1000) {  // Every second
            if (this.ownership !== 'neutral') {  // Only non-neutral buildings generate troops
                this.troops++;
                this.troopText.setText(this.troops.toString());
            }
            this.lastUpdate = now;
        }
    }

    setOwnership(newOwnership) {
        this.ownership = newOwnership;
        this.isPlayerOwned = newOwnership === 'player';
        this.building.setFillStyle(this.getBuildingColor());
    }

    setSelected(selected) {
        this.isSelected = selected;
        this.selectionRing.setVisible(selected);
    }

    sendTroops(targetBuilding) {
        if (this.troops <= 0) return;

        const troopsToSend = this.troops;
        this.troops = 0;
        this.troopText.setText('0');

        return troopsToSend;
    }
}

class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
        this.gameOver = false;
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

        // Add troop count displays
        this.playerTroopText = this.add.text(20, 20, 'Player Troops: 40', {
            fontSize: '24px',
            color: '#ffffff',
            fontFamily: 'Arial',
            resolution: 2,
            antialias: false
        });
        this.playerTroopText.setPosition(
            Math.round(this.playerTroopText.x), 
            Math.round(this.playerTroopText.y)
        );

        this.enemyTroopText = this.add.text(20, 50, 'Enemy Troops: 40', {
            fontSize: '24px',
            color: '#ffffff',
            fontFamily: 'Arial',
            resolution: 2,
            antialias: false
        });
        this.enemyTroopText.setPosition(
            Math.round(this.enemyTroopText.x), 
            Math.round(this.enemyTroopText.y)
        );

        // Initialize buildings array
        this.buildings = [];

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
        this.activeSoldiers = [];
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
            'You have conquered all enemy buildings!' : 
            'Your forces have been eliminated!';
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

        let playerTroops = 0;
        let enemyTroops = 0;

        // Count all troops (in buildings and in transit)
        this.buildings.forEach(building => {
            if (building.ownership === 'player') {
                playerTroops += building.troops;
            } else if (building.ownership === 'enemy') {
                enemyTroops += building.troops;
            }
        });

        this.activeSoldiers.forEach(soldier => {
            if (soldier.isPlayerOwned) {
                playerTroops++;
            } else {
                enemyTroops++;
            }
        });

        // Check win/lose conditions
        if (playerTroops === 0) {
            this.gameOver = true;
            this.showGameOverModal(false); // Show lose modal
        } else if (enemyTroops === 0) {
            this.gameOver = true;
            this.showGameOverModal(true); // Show win modal
        }
    }

    updateTroopCounts() {
        let playerTroops = 0;
        let enemyTroops = 0;

        // Count troops in buildings
        this.buildings.forEach(building => {
            if (building.ownership === 'player') {
                playerTroops += building.troops;
            } else if (building.ownership === 'enemy') {
                enemyTroops += building.troops;
            }
        });

        // Count troops in transit
        this.activeSoldiers.forEach(soldier => {
            if (soldier.isPlayerOwned) {
                playerTroops++;
            } else {
                enemyTroops++;
            }
        });

        // Update the display
        this.playerTroopText.setText(`Player Troops: ${playerTroops}`);
        this.enemyTroopText.setText(`Enemy Troops: ${enemyTroops}`);
    }

    update(time, delta) {
        if (this.gameOver) return;

        // Update all buildings
        this.buildings.forEach(building => building.update());

        // Update troop counts
        this.updateTroopCounts();

        // Check for win/lose conditions
        this.checkGameOver();

        // Update and check soldiers
        this.activeSoldiers = this.activeSoldiers.filter(soldier => {
            const reachedTarget = soldier.update(time, delta);
            if (reachedTarget) {
                // Handle individual soldier arrival
                const targetBuilding = this.buildings.find(b => {
                    const dx = b.x - soldier.targetX;
                    const dy = b.y - soldier.targetY;
                    const distanceSquared = dx * dx + dy * dy;
                    return distanceSquared < 2500; // 50 pixel radius check
                });
                
                if (targetBuilding) {
                    if (targetBuilding.ownership === (soldier.isPlayerOwned ? 'player' : 'enemy')) {
                        // Friendly building - add one troop
                        targetBuilding.troops++;
                    } else {
                        // Enemy or neutral building - subtract one troop
                        targetBuilding.troops--;
                        // Check for capture
                        if (targetBuilding.troops < 0) {
                            targetBuilding.setOwnership(soldier.isPlayerOwned ? 'player' : 'enemy');
                            targetBuilding.troops = Math.abs(targetBuilding.troops);
                            
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
                    targetBuilding.troopText.setText(targetBuilding.troops.toString());
                }
                
                soldier.destroy();
                return false;
            }
            return true;
        });
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
        const troopsToSend = sourceBuilding.sendTroops(targetBuilding);
        if (troopsToSend <= 0) return;

        // Calculate base spawn position
        const radius = 45; // Slightly larger than building radius
        const spreadAngle = Math.PI / 2; // 90 degrees spread

        // Calculate direction to target
        const dx = targetBuilding.x - sourceBuilding.x;
        const dy = targetBuilding.y - sourceBuilding.y;
        const angleToTarget = Math.atan2(dy, dx);
        
        // Create a delayed spawn for each soldier
        for (let i = 0; i < troopsToSend; i++) {
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

                const soldier = new Soldier(
                    this,
                    spawnX,
                    spawnY,
                    targetBuilding.x + targetOffsetX,
                    targetBuilding.y + targetOffsetY,
                    sourceBuilding.isPlayerOwned
                );
                this.activeSoldiers.push(soldier);
            });
        }
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