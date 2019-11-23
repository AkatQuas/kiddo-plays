function postedBy(parent, args, ctx) {
  return ctx.prisma.link({ id: parent.id }).postedBy();
}

function votes(parent, args, ctx) {
  return ctx.prisma.link({id: parent.id}).votes();
}

module.exports = {
  postedBy,
  votes
}