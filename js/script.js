document.addEventListener('DOMContentLoaded', () => {
    // 1. CAROUSEL ENGINE
    let currentSlide = 0;
    const slides = document.querySelectorAll('.slide');
    const intervalTime = 6000; // 6 seconds per slide

    if (slides.length > 0) {
        function nextSlide() {
            slides[currentSlide].classList.remove('active');
            currentSlide = (currentSlide + 1) % slides.length;
            slides[currentSlide].classList.add('active');
        }
        setInterval(nextSlide, intervalTime);
    }

    // 2. MOBILE MENU ENGINE
    const menuBtn = document.getElementById('menuBtn');
    const navLinks = document.getElementById('navLinks');
    
    if (menuBtn && navLinks) {
        menuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            menuBtn.querySelector('i').classList.toggle('fa-bars');
            menuBtn.querySelector('i').classList.toggle('fa-xmark');
        });
    }
});