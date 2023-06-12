module.exports = { generateUUID };

const { v4: uuidv4 } = require('uuid');

function generateUUID(context, userEvents, next) {
  context.vars.uuid = uuidv4();
  return next();
}
