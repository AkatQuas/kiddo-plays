import React from 'react';
import Header from '../components/header';
import { withI18next } from '../lib/withI18next';

export default withI18next(['about'])(({t, initialI18nStore}) => (
    <div>
        <Header />
        <p>{t('about:page')}</p>
        <p>{t('about:link.gotoHome')}</p>

    </div>
)) 