import Head from 'next/head';
import Link from 'next/link';
import Layout, { siteTitle } from '../components/layout';
import styles from '../styles/Home.module.css';
import utilStyles from '../styles/utils.module.css';

export default function Home() {
  return (
    <Layout home>
      <div className={styles.container}>
        <Head>
          <title>{siteTitle} | Simple Blog</title>
        </Head>
        <section className={utilStyles.headingMd}>
          <Link href="/gql">
            <a>check out graphql page</a>
          </Link>
          <br />
          <Link href="/cookie">
            <a>check out cookie page</a>
          </Link>
          <br />
          <Link href="/user">
            <a>check out users page</a>
          </Link>
          <br />
          <Link href="/blog">
            <a>check out blogs page, redirected!</a>
          </Link>
        </section>
        <hr />
        <main className={styles.main}>
          <h1>The value of customKey is: {process.env.customKey}</h1>
          <p className={styles.description}>
            Get started by editing{' '}
            <code className={styles.code}>pages/index.js</code>
          </p>
          <div className={styles.grid}>
            <a href="https://nextjs.org/docs" className={styles.card}>
              <h3>Documentation &rarr;</h3>
              <p>Find in-depth information about Next.js features and API.</p>
            </a>

            <a href="https://nextjs.org/learn" className={styles.card}>
              <h3>Learn &rarr;</h3>
              <p>Learn about Next.js in an interactive course with quizzes!</p>
            </a>

            <a
              href="https://github.com/vercel/next.js/tree/master/examples"
              className={styles.card}
            >
              <h3>Examples &rarr;</h3>
              <p>Discover and deploy boilerplate example Next.js projects.</p>
            </a>

            <a
              href="https://vercel.com/import?filter=next.js&utm_source=create-next-app&utm_medium=default-template&utm_campaign=create-next-app"
              className={styles.card}
            >
              <h3>Deploy &rarr;</h3>
              <p>
                Instantly deploy your Next.js site to a public URL with Vercel.
              </p>
            </a>
          </div>
        </main>

        <h1 className={styles.title}>
          Learn <a href="https://nextjs.org">Next.js!</a>
        </h1>
      </div>
    </Layout>
  );
}
