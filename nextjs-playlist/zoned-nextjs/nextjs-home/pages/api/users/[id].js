import { USERS } from 'lib/data/users';

export default function userHandler(req, res) {
  const {
    query: { id, name },
    method,
  } = req;

  switch (method) {
    case 'GET':
      // Get data from your database
      const user = USERS.find((i) => i.id === id);
      const result = user || {
        id,
        name: `Unkown user with id: ${id}`,
      };
      res.status(200).json(result);
      break;
    case 'PUT':
      // Update or create data in your database
      res.status(200).json({ id, name: name || `User ${id}` });
      break;
    default:
      res.setHeader('Allow', ['GET', 'PUT']);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}
