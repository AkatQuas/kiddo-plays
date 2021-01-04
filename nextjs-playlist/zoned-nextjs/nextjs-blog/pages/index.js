import Head from 'next/head';
import Link from 'next/link';
import Date from '../components/date';
import Layout, { siteTitle } from '../components/layout';
import { getSortedPostsData } from '../lib/posts';
import styles from '../styles/Home.module.css';
import utilStyles from '../styles/utils.module.css';

export default function Home({ allPostsData }) {
  return (
    <Layout home>
      <div className={styles.container}>
        <Head>
          <title>{siteTitle} | Simple Blog</title>
        </Head>
        <section className={`${utilStyles.headingMd} ${utilStyles.padding1px}`}>
          <h2 className={utilStyles.headingLg}>Blog</h2>
          <ul className={utilStyles.list}>
            {allPostsData.map(({ id, date, title }) => (
              <li className={utilStyles.listItem} key={id}>
                <Link href={`/posts/${id}`}>
                  <a>{title}</a>
                </Link>
                <br />
                <small className={utilStyles.lightText}>
                  <Date dateString={date} />
                </small>
              </li>
            ))}
          </ul>
        </section>
        <hr />
        <main className={styles.main}>
          <h1>The value of customKey is: {process.env.customKey}</h1>
          <h3 className={styles.title}>
            Read{' '}
            <Link href="/posts/first-post">
              <a>this first post!</a>
            </Link>
          </h3>

          <h3 className={styles.title}>
            Read{' '}
            <Link href="/posts/second-post">
              <a>this second post!</a>
            </Link>
          </h3>
        </main>
      </div>
    </Layout>
  );
}

/**
 * called at build time
 */
export async function getStaticProps() {
  const allPostsData = getSortedPostsData();
  return {
    props: {
      allPostsData,
    },
  };
}
