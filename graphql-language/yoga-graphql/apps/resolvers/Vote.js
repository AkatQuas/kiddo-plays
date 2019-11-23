function link(parent, args, ctx) {
  return ctx.prisma.vote({ id: parent.id }).link();
}

function user(parent, args, ctx) {
  return ctx.prisma.vote({ id: parent.id }).user();
}

module.exports = {
  link,
  user,
}