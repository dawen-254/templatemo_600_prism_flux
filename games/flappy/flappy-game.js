(function () {
    'use strict';

    var CANVAS_W = 480;
    var CANVAS_H = 640;
    var GROUND_H = 80;
    var GRAVITY = 0.45;
    var JUMP_FORCE = -8;
    var BASE_PIPE_SPEED = 2.6;
    var BASE_PIPE_GAP = 170;
    var PIPE_WIDTH = 64;
    var PIPE_SPAWN_MS = 1500;
    var BIRD_SIZE = 30;
    var BIRD_X = 110;

    var SKILLS = [
        { at: 5, label: 'Godot' },
        { at: 10, label: 'Solar2D' },
        { at: 15, label: 'GDScript' },
        { at: 20, label: 'Lua' },
        { at: 25, label: 'Arcade Physics' },
        { at: 30, label: 'Gameplay Polish' }
    ];

    var ACHIEVEMENTS = [
        { at: 10, label: 'Bug Hunter' },
        { at: 25, label: 'Prototype Pilot' },
        { at: 50, label: 'Arcade Master' },
        { at: 100, label: 'Impossible Run' }
    ];

    var canvas = document.getElementById('flappyCanvas');
    var ctx = canvas.getContext('2d');
    var frame = document.getElementById('gameFrame');
    var readyOverlay = document.getElementById('readyOverlay');
    var gameOverOverlay = document.getElementById('gameOverOverlay');
    var readyHighScore = document.getElementById('readyHighScore');
    var gameOverHighScore = document.getElementById('gameOverHighScore');
    var finalScore = document.getElementById('finalScore');
    var skillToast = document.getElementById('skillToast');
    var achievementToast = document.getElementById('achievementToast');

    var state = 'ready';
    var bird = { y: CANVAS_H / 2, velocity: 0, rotation: 0 };
    var pipes = [];
    var particles = [];
    var score = 0;
    var speed = BASE_PIPE_SPEED;
    var gap = BASE_PIPE_GAP;
    var shake = 0;
    var lastSpawn = 0;
    var lastTs = 0;
    var seenAchievements = {};
    var skillTimer = 0;
    var achievementTimer = 0;
    var highScore = readHighScore();

    function readHighScore() {
        try {
            return Number(localStorage.getItem('flappyDevHighScore') || 0);
        } catch (error) {
            return 0;
        }
    }

    function writeHighScore(value) {
        try {
            localStorage.setItem('flappyDevHighScore', String(value));
        } catch (error) {
            // Storage may be unavailable in private browsing or local restrictions.
        }
    }

    function resetGame() {
        bird = { y: CANVAS_H / 2, velocity: 0, rotation: 0 };
        pipes = [];
        particles = [];
        score = 0;
        speed = BASE_PIPE_SPEED;
        gap = BASE_PIPE_GAP;
        shake = 0;
        lastSpawn = 0;
        seenAchievements = {};
        hideToast(skillToast);
        hideToast(achievementToast);
        updateOverlays();
    }

    function flap() {
        if (state === 'ready' || state === 'gameover') {
            resetGame();
            state = 'playing';
        }

        if (state === 'playing') {
            bird.velocity = JUMP_FORCE;
        }

        updateOverlays();
    }

    function endGame() {
        state = 'gameover';
        shake = 12;
        highScore = Math.max(highScore, score);
        writeHighScore(highScore);
        finalScore.textContent = 'Score: ' + score;
        updateOverlays();
    }

    function updateOverlays() {
        readyHighScore.textContent = 'High Score: ' + highScore;
        gameOverHighScore.textContent = 'High Score: ' + highScore;
        readyOverlay.classList.toggle('hidden', state !== 'ready');
        gameOverOverlay.classList.toggle('hidden', state !== 'gameover');
    }

    function showToast(element, text, timeoutMs) {
        element.textContent = text;
        element.classList.remove('hidden');

        if (element === skillToast) {
            clearTimeout(skillTimer);
            skillTimer = setTimeout(function () { hideToast(element); }, timeoutMs);
        } else {
            clearTimeout(achievementTimer);
            achievementTimer = setTimeout(function () { hideToast(element); }, timeoutMs);
        }
    }

    function hideToast(element) {
        element.classList.add('hidden');
    }

    function drawBackground(t) {
        var grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
        grad.addColorStop(0, '#0f172a');
        grad.addColorStop(1, '#1e293b');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
        ctx.font = '14px monospace';
        for (var i = 0; i < 18; i += 1) {
            var x = (i * 53 + (t * 0.01) % 53) % CANVAS_W;
            var y = (i * 97) % (CANVAS_H - GROUND_H);
            ctx.fillText(i % 2 === 0 ? '0' : '1', x, y);
        }

        ctx.fillStyle = '#0b1120';
        ctx.fillRect(0, CANVAS_H - GROUND_H, CANVAS_W, GROUND_H);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, CANVAS_H - GROUND_H);
        ctx.lineTo(CANVAS_W, CANVAS_H - GROUND_H);
        ctx.stroke();
    }

    function drawPipe(pipe) {
        var topH = pipe.gapY - gap / 2;
        var bottomY = pipe.gapY + gap / 2;

        ctx.fillStyle = '#22d3ee';
        ctx.strokeStyle = '#0e7490';
        ctx.lineWidth = 3;
        ctx.fillRect(pipe.x, 0, PIPE_WIDTH, topH);
        ctx.strokeRect(pipe.x, 0, PIPE_WIDTH, topH);

        ctx.fillStyle = '#0891b2';
        ctx.font = 'bold 22px monospace';
        ctx.fillText('{', pipe.x + PIPE_WIDTH / 2 - 6, topH - 12);

        ctx.fillStyle = '#22d3ee';
        ctx.fillRect(pipe.x, bottomY, PIPE_WIDTH, CANVAS_H - GROUND_H - bottomY);
        ctx.strokeRect(pipe.x, bottomY, PIPE_WIDTH, CANVAS_H - GROUND_H - bottomY);
        ctx.fillStyle = '#0891b2';
        ctx.fillText('}', pipe.x + PIPE_WIDTH / 2 - 6, bottomY + 26);
    }

    function roundedRect(x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    function drawBird() {
        ctx.save();
        ctx.translate(BIRD_X, bird.y);
        ctx.rotate(Math.max(-0.5, Math.min(0.9, bird.rotation)));
        ctx.fillStyle = '#fbbf24';
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 2;
        roundedRect(-BIRD_SIZE / 2, -BIRD_SIZE / 2, BIRD_SIZE, BIRD_SIZE, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('</>', 0, 5);
        ctx.restore();
    }

    function spawnParticles(x, y) {
        for (var i = 0; i < 14; i += 1) {
            particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                life: 30
            });
        }
    }

    function update(ts) {
        if (state !== 'playing') return;

        bird.velocity += GRAVITY;
        bird.y += bird.velocity;
        bird.rotation = bird.velocity * 0.04;

        speed = Math.min(5, BASE_PIPE_SPEED + score * 0.03);
        gap = Math.max(120, BASE_PIPE_GAP - score * 1.2);

        if (ts - lastSpawn > PIPE_SPAWN_MS) {
            lastSpawn = ts;
            var margin = 80;
            var gapY = margin + Math.random() * (CANVAS_H - GROUND_H - margin * 2);
            pipes.push({ x: CANVAS_W + PIPE_WIDTH, gapY: gapY, passed: false });
        }

        pipes.forEach(function (pipe) {
            pipe.x -= speed;
            if (!pipe.passed && pipe.x + PIPE_WIDTH < BIRD_X - BIRD_SIZE / 2) {
                pipe.passed = true;
                score += 1;
                handleScoreUnlocks();
            }
        });

        pipes = pipes.filter(function (pipe) {
            return pipe.x > -PIPE_WIDTH;
        });

        particles.forEach(function (particle) {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life -= 1;
        });

        particles = particles.filter(function (particle) {
            return particle.life > 0;
        });

        if (bird.y + BIRD_SIZE / 2 > CANVAS_H - GROUND_H || bird.y - BIRD_SIZE / 2 < 0) {
            spawnParticles(BIRD_X, bird.y);
            endGame();
            return;
        }

        checkPipeCollisions();

        if (shake > 0) shake -= 1;
    }

    function handleScoreUnlocks() {
        var skill = SKILLS.find(function (item) {
            return item.at === score;
        });

        if (skill) {
            showToast(skillToast, 'Skill unlocked: ' + skill.label, 1800);
            spawnParticles(BIRD_X, bird.y);
        }

        var achievement = ACHIEVEMENTS.find(function (item) {
            return item.at === score;
        });

        if (achievement && !seenAchievements[achievement.label]) {
            seenAchievements[achievement.label] = true;
            showToast(achievementToast, 'Achievement: ' + achievement.label, 2200);
        }
    }

    function checkPipeCollisions() {
        var bLeft = BIRD_X - BIRD_SIZE / 2 + 4;
        var bRight = BIRD_X + BIRD_SIZE / 2 - 4;
        var bTop = bird.y - BIRD_SIZE / 2 + 4;
        var bBottom = bird.y + BIRD_SIZE / 2 - 4;

        for (var i = 0; i < pipes.length; i += 1) {
            var pipe = pipes[i];
            var pLeft = pipe.x;
            var pRight = pipe.x + PIPE_WIDTH;
            var topH = pipe.gapY - gap / 2;
            var bottomY = pipe.gapY + gap / 2;
            var overlapsX = bLeft < pRight && bRight > pLeft;

            if (overlapsX && (bTop < topH || bBottom > bottomY)) {
                spawnParticles(BIRD_X, bird.y);
                endGame();
                return;
            }
        }
    }

    function drawHUD() {
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(score), CANVAS_W / 2, 60);
    }

    function drawParticles() {
        particles.forEach(function (particle) {
            ctx.globalAlpha = Math.max(0, particle.life / 30);
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(particle.x, particle.y, 4, 4);
        });
        ctx.globalAlpha = 1;
    }

    function render(ts) {
        if (!lastTs) lastTs = ts;
        lastTs = ts;
        update(ts);

        ctx.save();
        if (shake > 0) {
            ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        }

        drawBackground(ts);
        pipes.forEach(drawPipe);
        drawParticles();
        drawBird();
        if (state === 'playing') drawHUD();
        ctx.restore();

        requestAnimationFrame(render);
    }

    frame.addEventListener('mousedown', flap);
    frame.addEventListener('touchstart', function (event) {
        event.preventDefault();
        flap();
    }, { passive: false });

    window.addEventListener('keydown', function (event) {
        if (event.code === 'Space' || event.code === 'ArrowUp') {
            event.preventDefault();
            flap();
        }
    });

    updateOverlays();
    requestAnimationFrame(render);
}());