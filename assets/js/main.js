// DOM Elementleri
const body = document.body;
const cursor = document.createElement('div');
const cursorTrails = [];
const hiddenMessages = document.querySelectorAll('.hidden-message');
const soundControl = document.querySelector('.sound-control');
const ambientSound = document.getElementById('ambient-sound');
const glitchSound = document.getElementById('glitch-sound');
const bloodDrips = [];

// Ses Efektleri
const sounds = {
    ambient: new Audio('/assets/sounds/ambient.mp3'),
    glitch: new Audio('/assets/sounds/glitch.mp3'),
    hover: new Audio('/assets/sounds/hover.mp3'),
    click: new Audio('/assets/sounds/click.mp3'),
    drip: new Audio('/assets/sounds/drip.mp3')
};

// Ses Ayarları
sounds.ambient.loop = true;
sounds.ambient.volume = 0.3;
sounds.glitch.volume = 0.5;
sounds.hover.volume = 0.2;
sounds.click.volume = 0.4;
sounds.drip.volume = 0.3;

// Özel İmleç
function initCustomCursor() {
    cursor.className = 'custom-cursor';
    body.appendChild(cursor);

    // İmleç İzi
    for (let i = 0; i < 10; i++) {
        const trail = document.createElement('div');
        trail.className = 'cursor-trail';
        body.appendChild(trail);
        cursorTrails.push({
            element: trail,
            x: 0,
            y: 0,
            delay: i * 2
        });
    }

    // İmleç Takibi
    document.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX - 10 + 'px';
        cursor.style.top = e.clientY - 10 + 'px';

        cursorTrails.forEach((trail, index) => {
            setTimeout(() => {
                trail.x = e.clientX - 5;
                trail.y = e.clientY - 5;
                trail.element.style.left = trail.x + 'px';
                trail.element.style.top = trail.y + 'px';
            }, trail.delay);
        });
    });

    // İmleç Efektleri
    document.addEventListener('mouseenter', () => {
        cursor.style.transform = 'scale(1.2)';
    });

    document.addEventListener('mouseleave', () => {
        cursor.style.transform = 'scale(1)';
    });
}

// Glitch Efekti
function createGlitchEffect() {
    const glitchTexts = document.querySelectorAll('.glitch-text');
    
    glitchTexts.forEach(text => {
        setInterval(() => {
            if (Math.random() < 0.1) {
                text.style.transform = `translate(${Math.random() * 10 - 5}px, ${Math.random() * 10 - 5}px)`;
                text.style.textShadow = `
                    ${Math.random() * 10 - 5}px ${Math.random() * 10 - 5}px 0 rgba(255, 0, 0, 0.5),
                    ${Math.random() * 10 - 5}px ${Math.random() * 10 - 5}px 0 rgba(0, 255, 0, 0.5)
                `;
                sounds.glitch.currentTime = 0;
                sounds.glitch.play();
            } else {
                text.style.transform = 'translate(0, 0)';
                text.style.textShadow = 'none';
            }
        }, 100);
    });
}

// Kan Damlası Efekti
function createBloodDrips() {
    const sections = document.querySelectorAll('.section');
    
    sections.forEach(section => {
        const drip = document.createElement('div');
        drip.className = 'blood-drip';
        drip.style.left = Math.random() * 100 + '%';
        section.appendChild(drip);
        bloodDrips.push(drip);

        setInterval(() => {
            if (Math.random() < 0.1) {
                drip.style.display = 'block';
                drip.style.animation = 'none';
                drip.offsetHeight; // Reflow
                drip.style.animation = 'drip 2s infinite';
                sounds.drip.currentTime = 0;
                sounds.drip.play();
            }
        }, 5000);
    });
}

// Gizli Mesajlar
function initHiddenMessages() {
    const messages = [
        "Buraya ait değilsin...",
        "Geri dön...",
        "Tehlikeli bölge...",
        "Gözlerin üzerinde...",
        "Kaç...",
        "Çok geç...",
        "Artık bizimsin..."
    ];

    let currentMessage = 0;
    let messageTimeout;

    function showRandomMessage() {
        const message = hiddenMessages[currentMessage];
        message.textContent = messages[Math.floor(Math.random() * messages.length)];
        message.style.left = Math.random() * (window.innerWidth - 200) + 'px';
        message.style.top = Math.random() * (window.innerHeight - 100) + 'px';
        message.classList.add('visible');

        messageTimeout = setTimeout(() => {
            message.classList.remove('visible');
            currentMessage = (currentMessage + 1) % hiddenMessages.length;
            showRandomMessage();
        }, 3000);
    }

    showRandomMessage();

    // Sayfa değiştiğinde timeout'u temizle
    window.addEventListener('beforeunload', () => {
        clearTimeout(messageTimeout);
    });
}

// Ses Kontrolü
function initSoundControl() {
    let isMuted = false;

    soundControl.addEventListener('click', () => {
        isMuted = !isMuted;
        
        Object.values(sounds).forEach(sound => {
            sound.muted = isMuted;
        });

        soundControl.querySelector('button').textContent = isMuted ? '🔇' : '🔊';
    });
}

// Sayfa Yükleme Efekti
function initPageLoad() {
    body.classList.add('loading');
    
    // Arka plan sesini başlat
    sounds.ambient.play().catch(() => {
        console.log('Otomatik ses oynatma engellendi');
    });

    // Yükleme ekranını kaldır
    setTimeout(() => {
        body.classList.remove('loading');
        body.classList.add('loaded');
    }, 2000);
}

// Buton Efektleri
function initButtonEffects() {
    const buttons = document.querySelectorAll('.button');
    
    buttons.forEach(button => {
        button.addEventListener('mouseenter', () => {
            sounds.hover.currentTime = 0;
            sounds.hover.play();
        });

        button.addEventListener('click', () => {
            sounds.click.currentTime = 0;
            sounds.click.play();
        });
    });
}

// CRT Efekti
function initCRTEffect() {
    const crtContainer = document.querySelector('.crt-effect');
    let isScreenOn = true;

    // Ekran açma/kapama efekti
    document.addEventListener('keydown', (e) => {
        if (e.key === 'p' || e.key === 'P') {
            isScreenOn = !isScreenOn;
            crtContainer.classList.toggle('screen-off', !isScreenOn);
            crtContainer.classList.toggle('screen-on', isScreenOn);
        }
    });
}

// Sayfa Kaydırma Efekti
function initScrollEffect() {
    let lastScroll = 0;
    const sections = document.querySelectorAll('.section');

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        
        sections.forEach(section => {
            const rect = section.getBoundingClientRect();
            if (rect.top < window.innerHeight && rect.bottom > 0) {
                if (currentScroll > lastScroll) {
                    section.style.transform = 'translateY(20px)';
                    section.style.opacity = '0';
                } else {
                    section.style.transform = 'translateY(-20px)';
                    section.style.opacity = '0';
                }
                
                setTimeout(() => {
                    section.style.transform = 'translateY(0)';
                    section.style.opacity = '1';
                }, 300);
            }
        });

        lastScroll = currentScroll;
    });
}

// Sayfa Yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
    initCustomCursor();
    createGlitchEffect();
    createBloodDrips();
    initHiddenMessages();
    initSoundControl();
    initPageLoad();
    initButtonEffects();
    initCRTEffect();
    initScrollEffect();
});

// Sayfa Kapatıldığında
window.addEventListener('beforeunload', () => {
    Object.values(sounds).forEach(sound => {
        sound.pause();
        sound.currentTime = 0;
    });
}); 