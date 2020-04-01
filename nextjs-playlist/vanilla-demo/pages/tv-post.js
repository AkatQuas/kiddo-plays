// import { withRouter } from 'next/router';
import Layout from '../comps/my-layout';
import fetch from 'isomorphic-unfetch';

const TvPost = ({show, ...rest}) => (
    <Layout>
        <h1>{show.name} {rest.idtht}</h1>
        <p>{show.summary.replace(/<[/]?p>/g,'')}</p>
        <img src={show.image.medium} alt="" srcSet=""/>
    </Layout>
)

TvPost.getInitialProps = async context => {
    const { id } = context.query;
    const res = await fetch(`https://api.tvmaze.com/shows/${id}`)
    const show = await res.json();
    console.log(`Fetched show: ${show.name}`)
    console.log(show);
    return {
        show,
        idtht: ',.,.phth'
    }
}

export default TvPost;