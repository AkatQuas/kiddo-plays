const initialData = {
  name: "Women's Mid Rise Skinny Jeans",
  categoryId: '100',
};

const MAXIMUM_NAME_LENGTH = 50;
const VALID_CATEGORY_IDS = [100, 101];

function initializePage() {
  document.querySelector('#name').value = initialData.name;

  const category = document.querySelector('#category');
  const count = category.length;
  for (let index = 0; index < count; index++) {
    if (category[index].value == initialData.categoryId) {
      category.selectedIndex = index;
      break;
    }
  }
}

function getSelectedCategoryId() {
  const category = document.querySelector('#category');
  const index = category.selectedIndex;
  if (index !== -1) {
    return category[index].value;
  }
  return '0';
}

function setErrorMessage(error) {
  const errorMessage = document.querySelector('#errorMessage');
  errorMessage.innerText = error;
  errorMessage.style.display = error === '' ? 'none' : '';
}

function onClickSave() {
  let errorMessage = '';
  const errorMessagePointer = Module._malloc(256);

  const name = document.querySelector('#name').value;
  const categoryId = getSelectedCategoryId();
  if (
    !validateName(name, errorMessagePointer) ||
    !validateCategory(categoryId, errorMessagePointer)
  ) {
    errorMessage = Module.UTF8ToString(errorMessagePointer);
  }

  Module._free(errorMessagePointer);
  setErrorMessage(errorMessage);
  if (errorMessage === '') {
  }
}

function validateName(name, errorMessagePointer) {
  const isValid = Module.ccall(
    'ValidateName' /* name of the function called in the module */,
    'number' /* return type of the function */,
    ['string', 'number', 'number'] /* arguments types */,
    [name, MAXIMUM_NAME_LENGTH, errorMessagePointer] /* real arguments */
  );
  return isValid === 1;
}

function validateCategory(categoryId, errorMessagePointer) {
  const arrayLength = VALID_CATEGORY_IDS.length;
  const bytesPerElement = Module.HEAP32.BYTES_PER_ELEMENT;
  const arrayPointer = Module._malloc(arrayLength * bytesPerElement);
  Module.HEAP32.set(VALID_CATEGORY_IDS, arrayPointer / bytesPerElement);
  const isValid = Module.ccall(
    'ValidateCategory',
    'number',
    ['string', 'number', 'number', 'number'],
    [categoryId, arrayPointer, arrayLength, errorMessagePointer]
  );
  Module._free(arrayPointer);

  return isValid === 1;
}

// console.log(Module);
