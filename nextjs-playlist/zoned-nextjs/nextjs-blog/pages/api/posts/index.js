export default function handler(req, res) {
  if (req.method === 'POST') {
    // Process a POST request
    // create a new posts
    res.json({
      title: 'title',
      date: new Date(),
      content: 'content',
    });
    return;
  }

  const { query } = req;
  // using query to fetch filtered list
  // Handle any other HTTP method
  res.json({
    data: [],
    meta: {
      total: 0,
    },
  });
}
