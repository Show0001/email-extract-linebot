exports.extractEmails = function (text) {
  const regex = /[\w.-]+@[\w.-]+\.\w+/g;
  return text.match(regex) || [];
};