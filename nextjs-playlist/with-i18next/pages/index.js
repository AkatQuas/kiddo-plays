import React, { Component, Fragment } from 'react';
import { I18nextProvider } from 'react-i18next';
import startI18n from '../utils/startI18n';
import { getAllTranslations } from '../utils/translationHelpers'

import Lang from '../components/Lang'
import Title from '../components/Title'
import Post from '../components/Post'

export default class HomePage extends Component {
    static async getInitialProps(ctx) {
        const translations = await getAllTranslations(
            ['en', 'cn'],
            ['common', 'ns'], 'http://localhost:3000/static/locales/'
        )
        const lang = ctx.req.headers['accept-language'].split(',')[0]
        // todo detect the language from header 
        return { translations,lang };
    }

    constructor(props) {
        super(props)
        this.i18n = startI18n(props.translations, props.lang)
    }

    render() {
        return (
            <I18nextProvider i18n={this.i18n}>
                <Fragment>
                    <Lang />
                    <Title />
                    <Post />
                </Fragment>
            </I18nextProvider>
        )
    }
}
