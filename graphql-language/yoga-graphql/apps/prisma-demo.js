const { prisma } = require('./generated/prisma-client');

async function main() {
  const newLink = await prisma.createLink({
    url: 'www.prisma.io',
    description: 'Prisma demo from 1521',
  });
  console.log(`Created new link ${newLink.url} (ID: ${newLink.id})`);

  const allLinks = await prisma.links();

  console.log(allLinks);
}
main().catch(e => console.error(e));
