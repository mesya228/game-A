window.onload = () => {
  const blockSize = 32;
  const playerSize = 64;
  const worldWidth = 1500;
  const worldHeight = 2500;
  const playerDamage = 1;
  const playerSpeed = 150;
  const playerMomentumDecay = 0.94;

  class Main extends Phaser.Scene {
    player;
    playerMomentum = {
      x: 0,
      y: 0,
    };
    playerMoving = {
      up: false,
      left: false,
      right: false,
      down: false,
    };
    cursors;
    house;
    crosshair;
    isFiringMode;
    shots;
    enemies;

    blocks;
    staticBlocks;
    joystickBase;
    joystickThumb;

    playerResources = {
      stone: 0,
      iron: 0,
    };
    baseResources = {
      stone: 0,
      iron: 0,
    };

    preload() {
      this.load.image('sky', 'assets/sky-bg-0.jpg');
      this.load.image('cave', 'assets/cave-bg-0.png');

      this.load.image('player', 'assets/player-miner-1.png');

      this.load.image('ground', 'assets/ground-bg-0.png');
      this.load.image('stone', 'assets/stone-bg-0.png');
      this.load.image('stone-up', 'assets/stone-bg-up.png');
      this.load.image('stone-down', 'assets/stone-bg-down.png');
      this.load.image('stone-left', 'assets/stone-bg-left.png');
      this.load.image('stone-right', 'assets/stone-bg-right.png');
      this.load.image('iron', 'assets/iron-bg-0.png');
      this.load.image('dark', 'assets/dark-bg-0.png');

      this.load.image('house', 'assets/castle.png');
      this.load.image('crosshair', 'assets/pointer.png');
      this.load.image('orc', 'assets/orc.png');
      this.load.image('shot', 'assets/laser.png');
    }

    create() {
      this.createBackground();
      this.createHouse();
      this.createPlayer();

      this.createStaticBlocks();
      this.createAllBlocks();

      this.createCameras();
      this.createCursors();
      this.createJoystick();

      this.createCrosshair();
      this.createShots();
      this.createEnemies();

      this.setPhysics();
      this.setWaveInterval();
    }

    createEnemies() {
      this.enemies = this.physics.add.group({
        classType: Phaser.Physics.Arcade.Image,
        defaultKey: 'orc',
      });
    }

    createEnemiesWave() {
      let enemie = this.enemies.get(0, 720);
      this.physics.moveTo(enemie, 800, 720, 50);
      enemie.setActive(true);
      enemie.setVisible(true);
    }

    createShots() {
      this.shots = this.physics.add.group({
        classType: Phaser.Physics.Arcade.Image,
        defaultKey: 'shot',
      });

      this.input.on(
        'pointerdown',
        (pointer) => {
          if (this.isFiringMode) {
            this.fireShot(pointer.worldX, pointer.worldY);
          }
        },
        this,
      );
    }

    fireShot(targetX, targetY) {
      let shot = this.shots.get(this.player.x, this.player.y);

      if (!shot) {
        return;
      }

      shot.setActive(true);
      shot.setVisible(true);
      shot.setRotation(Phaser.Math.Angle.Between(this.player.x, this.player.y, targetX, targetY));

      this.physics.moveTo(shot, targetX, targetY, 500);

      this.time.delayedCall(
        1000,
        () => {
          shot.setActive(false);
          shot.setVisible(false);
        },
        [],
        this,
      );
    }

    toggleCrosshair() {
      this.crosshair.setDepth(this.isFiringMode ? 1 : 0);
    }

    createCrosshair() {
      this.crosshair = this.add.sprite(0, 0, 'crosshair');
      this.crosshair.setDepth(0);

      this.input.on(
        'pointermove',
        (pointer) => {
          console.log('pointer', pointer);

          if (this.isFiringMode) {
            this.crosshair.setPosition(pointer.worldX, pointer.worldY);
          }
        },
      );
    }

    setPhysics() {
      this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
      this.physics.add.collider(this.player, this.blocks, this.handleBlockCollision.bind(this));
      this.physics.add.collider(this.player, this.staticBlocks);
      this.physics.add.collider(this.shots, this.enemies, (shot, enemy) => {
        shot.setActive(false);
        shot.setVisible(false);
      });
    }

    createPlayer() {
      this.player = this.physics.add
        .image(worldWidth / 2, 0, 'player')
        .setScale(0.8)
        .refreshBody();

      this.player.setBounce(0, 0.1);
      this.player.setCollideWorldBounds(true);
      this.player.x = 755;
      this.player.y = 700;
    }

    createCameras() {
      this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
      this.cameras.main.setLerp(0.1, 0.1);
      this.cameras.main.setZoom(2);
      this.cameras.main.centerOn(0, 0);
      this.cameras.main.startFollow(this.player);
    }

    createCursors() {
      if (this.sys.game.device.os.android || this.sys.game.device.os.iOS) {
        return;
      }

      this.cursors = this.input.keyboard.createCursorKeys();
    }

    createJoystick() {
      if (!this.sys.game.device.os.android || !this.sys.game.device.os.iOS) {
        return;
      }

      this.joystickBase = this.add
        .circle(this.player.x, this.player.y + 100, 50, 0x888888)
        .setAlpha(0.5)
        .setInteractive();
      this.joystickThumb = this.add
        .circle(this.player.x, this.player.y + 100, 25, 0xcccccc)
        .setAlpha(0.5)
        .setInteractive();

      this.input.setDraggable(this.joystickThumb);

      this.input.on(
        'drag',
        (pointer, gameObject, dragX, dragY) => {
          let distance = Phaser.Math.Distance.Between(this.joystickBase.x, this.joystickBase.y, dragX, dragY);
          let angle = Phaser.Math.Angle.Between(this.joystickBase.x, this.joystickBase.y, dragX, dragY);

          if (distance > this.joystickBase.radius) {
            distance = this.joystickBase.radius;
          }

          this.joystickThumb.x = this.joystickBase.x + distance * Math.cos(angle);
          this.joystickThumb.y = this.joystickBase.y + distance * Math.sin(angle);
          if (angle <= -1.2) {
            this.playerMoving = { up: true };
          } else if (angle <= -2.5 || angle >= 2.5) {
            this.playerMoving = { left: true };
          } else if (angle >= -0.05 && angle <= 1) {
            this.playerMoving = { right: true };
          } else if (angle >= 1.2 && angle <= 1.7) {
            this.playerMoving = { down: true };
          } else {
            this.playerMoving = {};
          }
          this.joystickBase.x = this.player.x;
          this.joystickBase.y = this.player.y + 100;
        },
        this,
      );

      this.input.on(
        'dragend',
        () => {
          console.log('dragend');
          this.joystickThumb.x = this.joystickBase.x;
          this.joystickThumb.y = this.joystickBase.y;
        },
        this,
      );
    }

    isPlayerNearHouse() {
      return Phaser.Math.Distance.Between(this.player.x, this.player.y, this.house.x, this.house.y) < playerSize;
    }

    update() {
      this.updatePlayerKeyboard();
      this.updatePlayerJoystick();
    }

    updatePlayerKeyboard() {
      if (!this.cursors) {
        return;
      }

      if (this.cursors && this.isFiringMode) {
        return this.player.setVelocity(0);
      }

      if (this.cursors.left.isDown) {
        this.player.flipX = false;
        this.player.setVelocityX(-this.calculatePlayerSpeed());
        this.playerMomentum.x = -this.calculatePlayerSpeed();
      } else if (this.cursors.right.isDown) {
        this.player.flipX = true;
        this.player.setVelocityX(this.calculatePlayerSpeed());
        this.playerMomentum.x = this.calculatePlayerSpeed();
      } else {
        this.player.setVelocityX(this.playerMomentum.x);
        this.playerMomentum.x *= playerMomentumDecay;
      }

      if (this.cursors.up.isDown) {
        this.player.setVelocityY(-this.calculatePlayerSpeed());
        this.playerMomentum.y = -this.calculatePlayerSpeed();
      } else if (this.cursors.down.isDown) {
        this.player.setVelocityY(this.calculatePlayerSpeed());
        this.playerMomentum.y = this.calculatePlayerSpeed();
      } else {
        this.player.setVelocityY(this.playerMomentum.y);
        this.playerMomentum.y *= playerMomentumDecay;
      }
    }

    updatePlayerJoystick() {
      if (!this.joystickThumb) {
        return;
      }
      
      if (this.joystickThumb && this.isFiringMode) {
        return this.player.setVelocity(0);
      }
      
      let dx = this.joystickThumb.x - this.joystickBase.x;
      let dy = this.joystickThumb.y - this.joystickBase.y;

      // Normalize the vector
      let magnitude = Math.sqrt(dx * dx + dy * dy);
      if (magnitude > 0) {
        dx /= magnitude;
        dy /= magnitude;
      }

      // Use dx and dy to control the player
      // For example:
      this.player.setVelocity(dx * playerSpeed, dy * playerSpeed);
    }

    calculatePlayerSpeed() {
      return playerSpeed - Object.values(this.playerResources).reduce((acc, num) => (acc += num), 0) * 2;
    }

    createAllBlocks() {
      this.blocks = this.physics.add.staticGroup();
      this.resourceBlocks = this.physics.add.staticGroup();
      const center = Math.floor(worldWidth / 2 / blockSize);
      const ironChunks = {};

      for (let x = 0; x < worldWidth / blockSize; x++) {
        for (let y = 0; y < (worldHeight - 800) / blockSize; y++) {
          if (y === 0 || (y === 1 && (x + 1 === center || x === center || x - 1 === center || x - 2 === center))) {
            continue;
          }

          let blocksLife = 50;
          const yPos = y * blockSize + 785;

          if (yPos / (worldHeight + 800) > 0.3) {
            blocksLife = 100;
          }
          if (yPos / (worldHeight + 800) > 0.5) {
            blocksLife = 150;
          }
          if (yPos / (worldHeight + 800) > 0.7) {
            blocksLife = 200;
          }

          const random = Math.floor(Math.random() * (100 - 0 + 1)) + 0;
          const amountRandom = Math.floor(Math.random() * (2 - 0 + 1)) + 0;

          if (random > 99 || ironChunks[`${x}${y}`]) {
            if (!ironChunks[`${x}${y}`]) {
              ironChunks[`${x}${y + 1}`] = true;
              ironChunks[`${x + 1}${y}`] = true;
              ironChunks[`${x + 1}${y + 1}`] = true;
            }

            blocksLife += 50;

            const newBlock = new DestructibleBlock(
              this,
              x * blockSize,
              y * blockSize + 768,
              'dark',
              blocksLife,
              amountRandom,
              'iron',
            );
            this.blocks.add(newBlock);
            continue;
          }

          if (y === 2 && (x === center || x - 1 === center)) {
            const newBlock = new DestructibleBlock(
              this,
              x * blockSize,
              y * blockSize + 768,
              'stone',
              blocksLife,
              amountRandom,
              'stone',
            );
            this.blocks.add(newBlock);
            continue;
          }

          const newBlock = new DestructibleBlock(
            this,
            x * blockSize,
            y * blockSize + 768,
            'dark',
            blocksLife,
            amountRandom,
            'stone',
          );
          this.blocks.add(newBlock);
        }
      }
    }

    createStaticBlocks() {
      this.staticBlocks = this.physics.add.staticGroup();

      const center = Math.floor(worldWidth / 2 / blockSize);
      for (let x = 0; x < worldWidth / blockSize; x += 1) {
        if (x === center || (x >= center && x <= center + 1)) {
          continue;
        }

        this.staticBlocks.create(x * blockSize, 768, 'ground');
      }

      this.staticBlocks.create(worldWidth / 2 - blockSize - 14, 800, 'ground');
      this.staticBlocks.create(worldWidth / 2 + blockSize + 18, 800, 'ground');
    }

    createBackground() {
      this.add.image(750, 300, 'sky');
      this.add.image(1000, 2000, 'cave');
    }

    createHouse() {
      this.house = this.add.image(worldWidth / 2, 645, 'house').setInteractive();
      this.house.on('pointerdown', () => {
        // if (!this.isPlayerNearHouse()) {
        //   return;
        // }

        this.isFiringMode = !this.isFiringMode;

        this.baseResources.stone += this.playerResources.stone;
        this.baseResources.iron += this.playerResources.iron;

        this.playerMomentum = {
          x: 0,
          y: 0,
        };
        this.playerResources = {
          stone: 0,
          iron: 0,
        };
        this.toggleCrosshair();
      });
    }

    setWaveInterval() {
      // setInterval(() => {
        this.createEnemiesWave();
      // }, 1000);
    }

    handleBlockCollision(player, block) {
      if (this.cursors) {
        this.handleCursorsCollision(player, block);

        return;
      }

      if (this.joystickBase) {
        this.handleJoystickCollision(player, block);

        return;
      }
    }

    handleCursorsCollision(player, block) {
      if (this.cursors.left.isDown && block.x <= player.x && block.y <= player.y + blockSize) {
        this.handleDestroyedBlock(block);
      } else if (this.cursors.right.isDown && block.x >= player.x && block.y <= player.y + blockSize) {
        this.handleDestroyedBlock(block);
      } else if (this.cursors.down.isDown && block.y >= player.y && block.x - player.x <= blockSize) {
        this.handleDestroyedBlock(block);
      } else if (this.cursors.up.isDown && block.y <= player.y && player.x - block.x <= blockSize) {
        this.handleDestroyedBlock(block);
      }
    }

    handleJoystickCollision(player, block) {
      if (this.playerMoving.left && block.x <= player.x && block.y <= player.y + blockSize) {
        this.handleDestroyedBlock(block);
      } else if (this.playerMoving.right && block.x >= player.x && block.y <= player.y + blockSize) {
        this.handleDestroyedBlock(block);
      } else if (this.playerMoving.down && block.y >= player.y && block.x - player.x <= blockSize) {
        this.handleDestroyedBlock(block);
      } else if (this.playerMoving.up && block.y <= player.y && player.x - block.x <= blockSize) {
        this.handleDestroyedBlock(block);
      }
    }

    handleDestroyedBlock(block) {
      const isDestroyed = block.damage(playerDamage);

      if (isDestroyed) {
        this.playerResources[block.type] += block.amount;
        this.checkAllBlocks(block);
      }
    }

    checkAllBlocks(block) {
      this.blocks.getChildren().forEach((b) => {
        const left = block.x !== b.x && block.x - blockSize === b.x && block.y === b.y;
        const right = block.x !== b.x && block.x + blockSize === b.x && block.y === b.y;
        const up = block.y !== b.y && block.y - blockSize === b.y && block.x === b.x;
        const down = block.y !== b.y && block.y + blockSize === b.y && block.x === b.x;

        console.log(b.texture);
        if (left || right || up || down) {
          if (left && right && up && down) {
            b.updateTexture(b.type);
          }

          if (up) {
            b.updateTexture(`${b.type}-up`);
            return;
          }

          if (down) {
            b.updateTexture(`${b.type}-down`);
            return;
          }

          if (left) {
            b.updateTexture(`${b.type}-left`);
            return;
          }

          if (right) {
            b.updateTexture(`${b.type}-right`);
            return;
          }

          b.updateTexture(b.type || 'stone');
        }
      });
    }
  }

  const config = {
    type: Phaser.AUTO,
    width: '100%',
    height: '100%',
    scene: Main,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 10, y: 0 },
      },
    },
    input: {
      activePointers: 2,
    },
  };

  const game = new Phaser.Game(config);

  class DestructibleBlock extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y, texture, health, amount, type = null) {
      super(scene, x, y, texture);

      this.scene = scene;
      this.scene.add.existing(this);
      this.scene.physics.add.existing(this, true);

      this.amount = amount;
      this.type = type;
      this.health = health;
    }

    damage(amount) {
      this.health -= amount;

      if (this.health <= 0) {
        this.destroy();

        return true;
      }

      return false;
    }

    updateTexture(newTexture) {
      this.setTexture(newTexture);
    }
  }
};
