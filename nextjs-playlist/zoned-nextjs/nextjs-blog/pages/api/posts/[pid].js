export default function handler(req, res) {
  // fetch details with pid post
  const {
    query: { pid },
  } = req;

  res.end(`Post: ${pid}`);
}
