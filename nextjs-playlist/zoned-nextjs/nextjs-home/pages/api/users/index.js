// Fake users data

import { USERS } from 'lib/data/users';

export default function handler(req, res) {
  // Get data from your database
  res.status(200).json(USERS);
}
