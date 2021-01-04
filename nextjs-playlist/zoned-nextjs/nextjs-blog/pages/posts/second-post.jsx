import Head from 'next/head';
import Link from 'next/link';
import Layout from '../../components/layout';

export default function FirstPost() {
  return (
    <Layout>
      <Head>
        <title>Second Post | 📚</title>
      </Head>
      <h1>Second Post</h1>
      <h2>
        <Link href="/">
          <a>Back to homepage</a>
        </Link>
      </h2>
    </Layout>
  );
}
