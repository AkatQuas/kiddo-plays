import { gqlFetcher } from 'lib/gql-fetcher';
import useSWR from 'swr';

export default function GraphQL() {
  const { data, error } = useSWR('{ users { name } }', gqlFetcher);

  if (error) return <div>Failed to load</div>;
  if (!data) return <div>Loading...</div>;

  const { users } = data;

  return (
    <div>
      {users.map((user, i) => (
        <div key={i}>{user.name}</div>
      ))}
    </div>
  );
}
