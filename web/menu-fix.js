document.addEventListener('DOMContentLoaded', () => {
  const menuBtn = document.getElementById('menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const menuIcon = menuBtn.querySelector('.material-symbols-outlined');

  // Add click listeners to all menu links to close menu on selection
  const menuLinks = mobileMenu.querySelectorAll('a[role="menuitem"]');
  menuLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (mobileMenu.classList.contains('open')) {
        mobileMenu.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
        menuIcon.textContent = 'menu';
      }
    });
  });
});
