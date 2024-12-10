export const saveErrorLog = (error) => {
  fs.writeFileSync('../../log.txt', `\nERROR:\n${error}\n`, {flag: 'a'});
};
