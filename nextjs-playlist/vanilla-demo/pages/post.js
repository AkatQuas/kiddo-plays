import { withRouter } from 'next/router';
import Layout from '../comps/my-layout';
import Markdown from 'react-markdown';

export default withRouter(({router}) => (
    <Layout>
        <h1>{router.query.title}</h1>
        <div className="markdown">
            <Markdown source={`
This is our blog post.
Yes. We can have a [link](/link).
And we can have a title as well.

### This is a title

And here's the content.`} />
        </div>
        <style jsx global>{`
        .markdown {
            font-family: 'Arial';
          }
     
          .markdown a {
            text-decoration: none;
            color: blue;
          }
     
          .markdown a:hover {
            opacity: 0.6;
          }
     
          .markdown h3 {
            margin: 0;
            padding: 0;
            text-transform: uppercase;
          }
        `}</style>
    </Layout>
))

/*
const Content = withRouter((props) => (
    <div>
      <h1>{props.router.query.title}</h1>
      <p>This is the blog post content.</p>
    </div>
  ))
  
  const Page = (props) => (
      <Layout>
         <Content />
      </Layout>
  )
  
  export default Page
  */