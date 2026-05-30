function test() {
  let x: number | undefined;
  return {
    a: 1,
    reset: () => {
      x = undefined;
    },
  };
}
