window.onload = () => {
  const blockSize = 32;
  const playerSize = 64;
  const worldWidth = 1500;
  const worldHeight = 2500;
  const groundLevel = 400;

  class Main extends Phaser.Scene {
    player;
    cursors;
    base;
    crosshair;
    isFiringMode = false;
    isShooting = false;
    shootingTimer;
    shotInterval = 500;
    shots;
    enemies;

    blocks;
    staticBlocks;
    joystickBase;
    joystickThumb;

    baseResources = {
      stone: 0,
      iron: 0,
    };

    preload() {
      this.load.image('sky', 'assets/sky-bg-0.jpg');
      this.load.image('cave', 'assets/cave-bg-0.png');

      this.load.image('player', 'assets/player-miner.png');

      this.load.image('ground', 'assets/ground.png');
      this.load.image('stone', 'assets/stone.png');
      this.load.image('iron', 'assets/iron.png');
      this.load.image('dark', 'assets/dark.png');

      this.load.image('base', 'assets/castle.png');
      this.load.image('crosshair', 'assets/pointer.png');
      this.load.image('orc', 'assets/orc.png');
      this.load.image('arrow', 'assets/arrow.png');
      this.load.image('test', 'assets/test.png');
      this.load.image('cracks', 'assets/crack.png');
      this.load.image('overlay', 'assets/overlay.png');
      this.load.image('overlay-angle', 'assets/overlay-angle.png');
    }

    create() {
      this.createBackground();
      this.createBase();
      this.createAnimations();
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
      this.listenToEvents();
      this.physics.world.createDebugGraphic();
    }

    createAnimations() {
      this.anims.create({
        key: 'walk',
        frames: this.anims.generateFrameNumbers('player', { frames: [0, 1, 2, 3] }),
        frameRate: 8,
        repeat: -1,
      });

      this.anims.create({
        key: 'idle',
        frames: this.anims.generateFrameNumbers('player', { frames: [5, 6, 7, 8] }),
        frameRate: 8,
        repeat: -1,
      });
    }

    createEnemies() {
      this.enemies = this.physics.add.group({ classType: OrcEnemie, defaultKey: 'enemie' });
    }

    createEnemiesWave() {
      const enemie = this.enemies.get(playerSize * 3, groundLevel - playerSize, 'orc', 100);

      this.physics.moveTo(enemie, this.base.$.x, groundLevel - playerSize, 100);
    }

    createShots() {
      this.shots = this.physics.add.group({
        classType: Phaser.Physics.Arcade.Image,
        defaultKey: 'arrow',
      });
    }

    listenToEvents() {
      this.input.on(
        'pointerdown',
        (pointer) => {
          this.pointerdownCoords = { x: pointer.x, y: pointer.x };

          this.startShooting(pointer);
        },
        this,
      );

      this.input.on(
        'pointermove',
        (pointer) => {
          if (this.isFiringMode) {
            this.crosshair.setPosition(pointer.worldX, pointer.worldY);
          }
          this.dragJoystick(pointer);
        },
        this,
      );

      this.input.on(
        'pointerup',
        (pointer) => {
          this.stopShooting();

          this.pointerdownCoords = null;
          this.joystickThumb.x = this.joystickBase.x;
          this.joystickThumb.y = this.joystickBase.y;
        },
        this,
      );
    }

    startShooting(pointer) {
      if (!this.isFiringMode || this.isShooting) {
        return;
      }

      this.crosshair.setPosition(pointer.worldX, pointer.worldY);

      if (!this.isShooting) {
        this.isShooting = true;
        this.fireShot(pointer.worldX, pointer.worldY); // Shoot immediately

        // Set up a repeating timer for subsequent shots
        this.shootingTimer = this.time.addEvent({
          delay: this.shotInterval,
          callback: () => this.fireShot(pointer.worldX, pointer.worldY),
          callbackScope: this,
          loop: true,
        });
      }
    }

    stopShooting() {
      this.isShooting = false;

      if (this.shootingTimer) {
        this.shootingTimer.remove(false);
        this.shootingTimer = null;
      }
    }

    fireShot(targetX, targetY) {
      let shot = this.shots.get(this.base.$.x, this.base.$.y);

      if (!shot) {
        return;
      }

      shot.setActive(true);
      shot.setVisible(true);
      shot.setRotation(Phaser.Math.Angle.Between(this.base.$.x, this.base.$.y, targetX, targetY));

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
      this.crosshair.setVisible(this.isFiringMode);
    }

    createCrosshair() {
      this.crosshair = this.add.sprite(0, 0, 'crosshair');
      this.toggleCrosshair();
    }

    playerTouchedBase() {
      this.baseResources.stone += this.player.resources.stone;
      this.baseResources.iron += this.player.resources.iron;

      this.player.momentum = {
        x: 0,
        y: 0,
      };
      this.player.resources = {
        stone: 0,
        iron: 0,
      };
    }

    setPhysics() {
      this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

      this.physics.add.collider(this.player.$, this.blocks, this.handleBlockCollision.bind(this));
      this.physics.add.collider(this.player.$, this.staticBlocks);
      this.physics.add.collider(this.player.$, this.enemies);
      this.physics.add.overlap(this.player.$, this.base.$, this.playerTouchedBase.bind(this));

      this.physics.add.collider(this.enemies, this.base.$, this.handleBaseEnemieCollision.bind(this));
      this.physics.add.collider(this.enemies, this.staticBlocks);

      this.physics.add.collider(this.shots, this.staticBlocks, (shot) => {
        shot.destroy();
      });
      this.physics.add.collider(this.shots, this.blocks);
      this.physics.add.collider(this.shots, this.enemies, (shot, enemy) => {
        enemy.takeDamage(50);

        shot.destroy();
      });
    }

    handleBaseEnemieCollision(enemie, base) {
      base.takeDamage(enemie.damage);
    }

    createPlayer() {
      this.player = new Player(this, worldWidth / 2, groundLevel, 'player');
    }

    createCameras() {
      this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
      this.cameras.main.setLerp(0.1, 0.1);
      this.cameras.main.setZoom(2);
      this.cameras.main.centerOn(0, 0);
      this.cameras.main.startFollow(this.player.$);
    }

    createCursors() {
      if (!this.sys.game.device.os.android && !this.sys.game.device.os.iOS) {
        return;
      }

      // this.cursors = this.input.keyboard.createCursorKeys();
    }

    isPlayerNearBase() {
      return Phaser.Math.Distance.Between(this.player.$.x, this.player.$.y, this.base.$.x, this.base.$.y) < playerSize;
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
        return this.player.$.setVelocity(0);
      }

      if (this.cursors.left.isDown) {
        this.player.$.setFlipX(false);
        this.player.$.setVelocityX(-this.calculatePlayerSpeed());
        this.player.momentum.x = -this.calculatePlayerSpeed();
      } else if (this.cursors.right.isDown) {
        this.player.$.setFlipX(true);
        this.player.$.setVelocityX(this.calculatePlayerSpeed());
        this.player.momentum.x = this.calculatePlayerSpeed();
      } else {
        this.player.$.setVelocityX(this.player.momentum.x);
        this.player.momentum.x *= this.player.momentumDecay;
      }

      if (this.cursors.up.isDown) {
        this.player.$.setVelocityY(-this.calculatePlayerSpeed());
        this.player.momentum.y = -this.calculatePlayerSpeed();
      } else if (this.cursors.down.isDown) {
        this.player.$.setVelocityY(this.calculatePlayerSpeed());
        this.player.momentum.y = this.calculatePlayerSpeed();
      } else {
        this.player.$.setVelocityY(this.player.momentum.y);
        this.player.momentum.y *= this.player.momentumDecay;
      }
    }

    dragJoystick(pointer) {
      this.distance = Phaser.Math.Distance.Between(
        this.joystickBase.x,
        this.joystickBase.y,
        pointer.worldX,
        pointer.worldY,
      );
      this.angle = Phaser.Math.Angle.Between(this.joystickBase.x, this.joystickBase.y, pointer.worldX, pointer.worldY);

      if (this.distance > this.joystickBase.radius) {
        this.distance = this.joystickBase.radius;
      }

      if (this.angle <= -1.2) {
        this.player.moving = { up: true };
      } else if (this.angle <= -2.5 || this.angle >= 2.5) {
        this.player.moving = { left: true };
        this.player.$.setFlipX(false);
      } else if (this.angle >= -0.05 && this.angle <= 1) {
        this.player.moving = { right: true };
        this.player.$.setFlipX(true);
      } else if (this.angle >= 1.2 && this.angle <= 1.7) {
        this.player.moving = { down: true };
      } else {
        this.player.moving = {};
      }

      this.joystickBase.x = this.cameras.main.worldView.x + this.cameras.main.worldView.width * 0.8;
      this.joystickBase.y = this.cameras.main.worldView.y + this.cameras.main.worldView.height * 0.8;
      this.joystickThumb.x = this.joystickBase.x + this.distance * Math.cos(this.angle);
      this.joystickThumb.y = this.joystickBase.y + this.distance * Math.sin(this.angle);
    }

    createJoystick() {
      // if (!this.sys.game.device.os.android || !this.sys.game.device.os.iOS) {
      //   return;
      // }
      const x = this.cameras.main.worldView.x + this.cameras.main.worldView.width * 0.9;
      const y = this.cameras.main.worldView.y + this.cameras.main.worldView.height * 0.9;

      this.joystickBase = this.add.circle(x, y, 35, 0x888888).setAlpha(0.5).setInteractive();
      this.joystickThumb = this.add.circle(x, y, 15, 0xcccccc).setAlpha(0.5).setInteractive();

      this.input.setDraggable(this.joystickThumb);

      this.input.on('drag', (pointer) => {}, this);

      this.input.on(
        'dragend',
        () => {
          // this.joystickThumb.x = this.joystickBase.x;
          // this.joystickThumb.y = this.joystickBase.y;
        },
        this,
      );
    }

    updatePlayerJoystick() {
      if (!this.joystickThumb) {
        return;
      }

      if (this.joystickThumb && this.isFiringMode) {
        return this.player.$.setVelocity(0);
      }

      let dx = this.joystickThumb.x - this.joystickBase.x;
      let dy = this.joystickThumb.y - this.joystickBase.y;

      // Normalize the vector
      const magnitude = Math.sqrt(dx * dx + dy * dy);
      if (magnitude > 0) {
        dx /= magnitude;
        dy /= magnitude;
      }

      this.player.$.setVelocity(dx * this.calculatePlayerSpeed(), dy * this.calculatePlayerSpeed());

      if (!this.pointerdownCoords) {
        return;
      }

      this.joystickBase.x = this.cameras.main.worldView.x + this.cameras.main.worldView.width * 0.8;
      this.joystickBase.y = this.cameras.main.worldView.y + this.cameras.main.worldView.height * 0.8;
      this.joystickThumb.x = this.joystickBase.x + this.distance * Math.cos(this.angle);
      this.joystickThumb.y = this.joystickBase.y + this.distance * Math.sin(this.angle);
    }

    calculatePlayerSpeed() {
      return this.player.speed - Object.values(this.player.resources).reduce((acc, num) => (acc += num), 0) * 2;
    }

    createAllBlocks() {
      this.blocks = this.physics.add.staticGroup();
      const center = Math.floor(worldWidth / 2 / blockSize);
      const ironChunks = {};

      for (let x = 0; x < worldWidth / blockSize + 1; x++) {
        for (let y = 0; y < (worldHeight - groundLevel - blockSize) / blockSize; y++) {
          if (y === 0 || (y === 1 && (x === center || x - 1 === center))) {
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
              y * blockSize + groundLevel,
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
              y * blockSize + groundLevel,
              'stone',
              blocksLife,
              amountRandom,
              'stone',
            );
            this.blocks.add(newBlock);
            newBlock.setOverlay('down');

            continue;
          }

          const newBlock = new DestructibleBlock(
            this,
            x * blockSize,
            y * blockSize + groundLevel,
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
      for (let x = 0; x < worldWidth / blockSize + 1; x += 1) {
        if (x === center || (x >= center && x <= center + 1)) {
          continue;
        }

        const block = this.staticBlocks.create(x * blockSize, groundLevel, 'ground');
        block.body.setSize(blockSize, blockSize);
      }

      this.staticBlocks.create(worldWidth / 2 - blockSize - 14, 800, 'ground');
      this.staticBlocks.create(worldWidth / 2 + blockSize + 18, 800, 'ground');
    }

    createBackground() {
      this.add.image(750, 185, 'sky');
      this.add.image(750, 1634, 'cave');
    }

    createBase() {
      this.base = new Base(this, worldWidth / 2, groundLevel - 113, 'base', 100);

      this.base.$.on('pointerdown', () => {
        if (!this.isPlayerNearBase() && !this.isFiringMode) {
          return;
        }

        this.isFiringMode = !this.isFiringMode;

        if (this.isFiringMode) {
          this.cameras.main.stopFollow(this.player.$);
          this.cameras.main.centerOn(worldWidth / 2, groundLevel - 325);
        } else {
          this.cameras.main.startFollow(this.player.$);
        }

        this.player.$.body.setAllowGravity(!this.isFiringMode);
        this.player.$.setVisible(!this.isFiringMode);
        this.cameras.main.setZoom(this.isFiringMode ? 1 : 2);

        this.player.$.x = worldWidth / 2;
        this.player.$.y = groundLevel - playerSize * 2.3;

        this.toggleCrosshair();
        this.toggleJoystick(!this.isFiringMode);
      });
    }

    toggleJoystick(isShow) {
      this.joystickBase.setVisible(isShow);
      this.joystickThumb.setVisible(isShow);
    }

    setWaveInterval() {
      this.createEnemiesWave();

      setInterval(() => {
        this.createEnemiesWave();
      }, 60000);
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
        this.damageBlock(block);
      } else if (this.cursors.right.isDown && block.x >= player.x && block.y <= player.y + blockSize) {
        this.damageBlock(block);
      } else if (this.cursors.down.isDown && block.y >= player.y && block.x - player.x <= blockSize) {
        this.damageBlock(block);
      } else if (this.cursors.up.isDown && block.y <= player.y && player.x - block.x <= blockSize) {
        this.damageBlock(block);
      }
    }

    handleJoystickCollision(player, block) {
      if (this.player.moving.left && block.x <= player.x && block.y <= player.y + blockSize) {
        this.damageBlock(block);
      } else if (this.player.moving.right && block.x >= player.x && block.y <= player.y + blockSize) {
        this.damageBlock(block);
      } else if (this.player.moving.down && block.y >= player.y && block.x - player.x <= blockSize) {
        this.damageBlock(block);
      } else if (this.player.moving.up && block.y <= player.y && player.x - block.x <= blockSize) {
        this.damageBlock(block);
      }
    }

    damageBlock(block) {
      const isDestroyed = block.damage(this.player.damage);

      if (isDestroyed) {
        this.player.resources[block.type] += block.amount;
        this.player.addExperience(10);
        this.checkAllBlocks(block);
      }
    }

    checkAllBlocks(block) {
      this.blocks.getChildren().forEach((b) => {
        const left = block.x !== b.x && block.x - blockSize === b.x && block.y === b.y;
        const right = block.x !== b.x && block.x + blockSize === b.x && block.y === b.y;
        const up = block.y !== b.y && block.y - blockSize === b.y && block.x === b.x;
        const down = block.y !== b.y && block.y + blockSize === b.y && block.x === b.x;
        const upLeft = block.x !== b.x && block.x - blockSize === b.x && block.y - blockSize === b.y;
        const downLeft = block.x !== b.x && block.x - blockSize === b.x && block.y + blockSize === b.y;
        const upRight = block.x !== b.x && block.x + blockSize === b.x && block.y - blockSize === b.y;
        const downRight = block.x !== b.x && block.x + blockSize === b.x && block.y + blockSize === b.y;

        if (left || right || up || down) {
          b.updateTexture(b.type);

          if (up) {
            return b.setOverlay(`up`);
          }

          if (down) {
            return b.setOverlay(`down`);
          }

          if (left) {
            return b.setOverlay(`left`);
          }

          if (right) {
            return b.setOverlay(`right`);
          }
        }

        if (
          b.texture.key === 'dark' &&
          !left &&
          !right &&
          !up &&
          !down &&
          (downLeft || downRight || upRight || upLeft)
        ) {
          b.updateTexture(b.type);

          if (downLeft) {
            return b.setAngleOverlay(`down-left`);
          }
          if (downRight) {
            return b.setAngleOverlay(`down-right`);
          }
          if (upRight) {
            return b.setAngleOverlay(`up-right`);
          }
          if (upLeft) {
            return b.setAngleOverlay(`up-left`);
          }
        }
      });
    }
  }

  class DestructibleBlock extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y, texture, health, amount, type = null) {
      super(scene, x, y, texture);

      this.scene = scene;
      this.x = x;
      this.y = y;
      this.block = this.scene.add.existing(this);
      this.scene.physics.add.existing(this, true);

      this.amount = amount;
      this.type = type;
      this.health = health;
      this.fullHealth = health;
    }

    damage(amount) {
      this.health -= amount;

      if (!this.cracks) {
        this.cracks = this.scene.add.sprite(this.x, this.y, 'cracks').setAlpha(0);
      }

      this.cracks.setAlpha(1 - this.health / this.fullHealth);

      if (this.health <= 0) {
        this.destroy();
        this.cracks.destroy();
        this.overlay && this.overlay.destroy();
        this.angleOverlay && this.angleOverlay.destroy();

        return true;
      }

      return false;
    }

    updateTexture(newTexture) {
      this.setTexture(newTexture);
    }

    setOverlay(position) {
      if (!this.overlay) {
        this.overlay = this.scene.add.sprite(this.x, this.y, 'overlay');
      }
      if (this.angleOverlay) {
        this.angleOverlay.destroy();
      }

      if (position === 'up') {
        this.overlay.flipY = false;
      }
      if (position === 'down') {
        this.overlay.flipY = true;
      }
      if (position === 'left') {
        this.overlay.setAngle(270);
      }
      if (position === 'right') {
        this.overlay.setAngle(90);
      }
    }

    setAngleOverlay(position) {
      if (!this.angleOverlay) {
        this.angleOverlay = this.scene.add.sprite(this.x, this.y, 'overlay-angle');
      }
      if (this.overlay) {
        this.overlay.destroy();
      }

      if (position === 'down-left') {
        this.angleOverlay.setAngle(0);
      }
      if (position === 'down-right') {
        this.angleOverlay.setAngle(270);
      }
      if (position === 'up-right') {
        this.angleOverlay.setAngle(180);
      }
      if (position === 'up-left') {
        this.angleOverlay.setAngle(90);
      }
    }
  }

  class Base extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y, texture, health) {
      super(scene, x, y, texture);

      this.scene = scene;
      this.$ = scene.physics.add.staticImage(x, y, texture);
      this.$.setInteractive();

      this.health = health;
      this.fullHealth = health;
    }

    takeDamage(amount) {
      this.health -= amount;

      if (this.health <= 0) {
        this.destroy();

        return true;
      }

      return false;
    }
  }

  class OrcEnemie extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y, texture, health, type = null) {
      super(scene, x, y, texture);

      this.scene = scene;

      this.type = type;
      this.damage = 1;
      this.health = health;
      this.fullHealth = health;
    }

    takeDamage(amount) {
      this.health -= amount;

      if (this.health <= 0) {
        this.destroy();

        return true;
      }

      return false;
    }
  }

  class Player extends Phaser.GameObjects.Sprite {
    damage = 1;
    speed = 150;
    momentumDecay = 0.94;
    momentum = {
      x: 0,
      y: 0,
    };
    resources = {
      stone: 0,
      iron: 0,
    };
    moving = {
      up: false,
      left: false,
      right: false,
      down: false,
    };

    constructor(scene, x, y, texture, health) {
      super(scene, x, y, texture);

      this.scene = scene;
      this.$ = scene.physics.add
        .image(worldWidth / 2, 0, 'player', '__BASE')
        .setScale(0.8)
        .refreshBody();

      this.$.setBounce(0.1, 0.8);
      this.$.setCollideWorldBounds(true);
      this.$.x = x;
      this.$.y = y;

      this.health = health;
      this.fullHealth = health;

      this.experience = 0;
      this.level = 1;
      this.nextLevelXP = 100;
    }

    addExperience(amount) {
      this.experience += amount;

      if (this.experience >= this.nextLevelXP) {
        this.levelUp();
      }
    }

    levelUp() {
      this.level++;
      this.experience -= this.nextLevelXP;

      this.nextLevelXP = Math.round(this.nextLevelXP * 1.5);

      console.log(`Leveled up to level ${this.level}! Next level at ${this.nextLevelXP} XP.`);
    }

    takeDamage(amount) {
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

  new Phaser.Game({
    type: Phaser.AUTO,
    width: '100%',
    height: '100%',
    scene: Main,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 300 },
      },
    },
    fps: {
      limit: 70,
    },
    input: {
      activePointers: 2,
    },
  });
};
