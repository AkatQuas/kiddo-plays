function links(parent, args, ctx) {
  return ctx.prisma.user({ id: parent.id }).links();
}

module.exports = {
  links,
};
