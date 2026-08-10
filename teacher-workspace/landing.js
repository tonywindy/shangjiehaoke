(function () {
  const dialog = document.getElementById('accessDialog');
  const closeButton = dialog.querySelector('.dialog-close');
  const cancelButton = dialog.querySelector('.dialog-cancel');
  const menuButton = document.querySelector('.menu-button');
  const mobileNav = document.getElementById('mobileNav');
  let lastFocused = null;

  function openDialog() {
    lastFocused = document.activeElement;
    dialog.hidden = false;
    document.body.classList.add('dialog-open');
    closeButton.focus();
  }

  function closeDialog() {
    dialog.hidden = true;
    document.body.classList.remove('dialog-open');
    if (lastFocused) lastFocused.focus();
  }

  document.querySelectorAll('.js-open-access').forEach((button) => {
    button.addEventListener('click', openDialog);
  });

  closeButton.addEventListener('click', closeDialog);
  cancelButton.addEventListener('click', closeDialog);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !dialog.hidden) closeDialog();
  });

  menuButton.addEventListener('click', () => {
    const isOpen = mobileNav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
  });
  mobileNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mobileNav.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
    });
  });

  document.getElementById('copyrightYear').textContent = new Date().getFullYear();
})();
