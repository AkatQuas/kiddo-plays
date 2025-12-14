type fn<T extends unknown = unknown> = (
  array: T[],
  isAgtB: (a: T, b: T) => boolean
) => T[];

/**
 * See the animation at
 *    https://www.runoob.com/wp-content/uploads/2019/03/bubbleSort.gif
 *
 * @param array
 * @param isAgtB
 * @returns
 */
const bubbleSort: fn<number> = (array, isAgtB) => {
  for (let index = 0; index < array.length; index++) {
    for (let j = 0; j < array.length - index - 1; j++) {
      if (isAgtB(array[j], array[j + 1])) {
        let tmp = array[j];
        array[j] = array[j + 1];
        array[j + 1] = tmp;
      }
    }
  }
  return array;
};

/**
 * See the animation at
 *    https://www.runoob.com/wp-content/uploads/2019/03/insertionSort.gif
 *
 * @param array
 * @param isAgtB
 * @returns
 */
const insertSort: fn = (array, isAgtB) => {
  for (let index = 1; index < array.length; index++) {
    let value = array[index];
    let j = index - 1;
    for (; j >= 0; j--) {
      if (isAgtB(array[j], value)) {
        array[j + 1] = array[j];
      } else {
        break;
      }
    }
    array[j + 1] = value;
  }
  return array;
};

/**
 * See the animation at
 *    https://www.runoob.com/wp-content/uploads/2019/03/selectionSort.gif
 *
 * @param array
 * @param isAgtB
 * @returns
 */
const selectSort: fn = (array, isAgtB) => {
  for (let index = 0; index < array.length; index++) {
    let min = index;
    for (let j = index + 1; j < array.length; j++) {
      if (isAgtB(array[min], array[j])) {
        min = j;
      }
    }
    if (min !== index) {
      let temp = array[index];
      array[index] = array[min];
      array[min] = temp;
    }
  }
  return array;
};

/**
 * See the animation at
 *    https://www.runoob.com/wp-content/uploads/2019/03/mergeSort.gif
 * @param array
 * @param isAgtB
 * @returns
 */
const mergeSort: fn = (array, isAgtB) => {
  function MergeSort(a1: typeof array, front: number, end: number) {
    if (front >= end) return;
    const mid = Math.floor((front + end) / 2);
    MergeSort(a1, front, mid);
    MergeSort(a1, mid + 1, end);
    merge(a1, front, mid, end);
  }

  function merge(a1: typeof array, i: number, j: number, k: number) {
    const temp: typeof array = [];
    let ix = i;
    let jx = j + 1;
    while (ix <= j && jx <= k) {
      if (isAgtB(a1[ix], a1[jx])) {
        temp.push(a1[jx]);
        jx += 1;
      } else {
        temp.push(a1[ix]);
        ix += 1;
      }
    }

    const restStart = ix > j ? jx : ix;
    const restEnd = ix > j ? k : j;
    for (let index = restStart; index <= restEnd; index++) {
      temp.push(a1[index]);
    }

    ix = i;
    let it = 0;
    while (ix <= k) {
      a1[ix] = temp[it];
      it++;
      ix++;
    }
  }
  MergeSort(array, 0, array.length - 1);
  return array;
};
