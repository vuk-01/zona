// "5 spaces", "1 space", and "None yet" for a category nobody has listed yet
export const spacesCount = (count: number) =>
  count === 0 ? 'None yet' : `${count} ${count === 1 ? 'space' : 'spaces'}`
