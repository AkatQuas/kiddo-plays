import Link from 'next/link';
import Layout from '../comps/my-layout';
import fetch from 'isomorphic-unfetch';

const PostLink = ({title,id}) => (
  <li>
    <Link as={`/p/${id}`} href={`/post?title=${title}`}>
      <a>{title}</a>
    </Link>
    <style jsx>{`
      li {
        list-style: none;
      }
      a {
        text-decoration: none;
        color: #68f;
      }
    `}</style>
  </li>
)

const Index = ({shows}) => (
  <Layout>
    <Link href="/about">
      <button>About Page</button>
    </Link>
    <p>Hello Next.js</p>
    <hr />
    <ul>
      <PostLink id="hello-nextjs" title="Hello Next.js" />
      <PostLink id="learn-next" title="Learn Next.js is awesome" />
      <PostLink id="deploy-next" title="Deploy apps with Zeit" />
    </ul>
    <h1>Batman TV Shows</h1>
    <ul>
      {shows.map(({show}) => (
        <li key={show.id}>
          <Link as={`/tv/${show.id}`} href={`/tv-post?id=${show.id}`}>
            <a>{show.name}</a>
          </Link>
        </li>
      ))}
    </ul>
    <style jsx>{`
      h1, a {
        font-family: "Arial";
      }

      ul {
        padding: 0;
      }

      li {
        list-style: none;
        margin: 5px 0;
      }

      a {
        text-decoration: none;
        color: blue;
      }

      a:hover {
        opacity: 0.6;
      }
    `}</style>
  </Layout>
)

Index.getInitialProps = async _ => {
  const res = await fetch('https://api.tvmaze.com/search/shows?q=batman');
  const data = await res.json()

  console.log(`Show data fetched. Count: ${data.length}`)

  return {
    shows: data
  }
}

export default Index
