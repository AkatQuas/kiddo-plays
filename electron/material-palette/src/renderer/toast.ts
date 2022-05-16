export const showToast = (message: string) => {
  const toastEl = document.querySelector('div#toast');
  console.log(
    '%c***** message *****',
    'background: #3C89FF; color: #f8f8f8; padding: 10px;margin-bottom: 5px;',
    '\n',
    message,
    toastEl,
    '\n'
  );
  if (!toastEl) {
    return;
  }

  toastEl.innerHTML = message;

  toastEl.classList.remove('hidden');

  setTimeout(() => {
    toastEl.classList.add('hidden');
    toastEl.innerHTML = '';
  }, 2000);
};
