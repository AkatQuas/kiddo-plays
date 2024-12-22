const dd = { a: '1', b: 1 };

Card({
  data: dd as unknown as { c: boolean },
});
