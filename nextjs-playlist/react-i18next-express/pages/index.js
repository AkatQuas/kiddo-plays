import React from 'react';
import Header from '../components/header';
import ComponentWithTrans from '../components/ComponentWithTrans';
import PureComponent from '../components/PureComponent';
import ExtendedComponent from '../components/ExtendedComponent';
import { withI18next } from '../lib/withI18next';


export default withI18next(['common', 'home'])(({ t, initialI18nStore, i18n }) => {
    console.log(t('home:welcome'))
    return (
        <div>
            <Header i18n={i18n} />
            <h1>{t('home:welcome')}</h1>
            <ComponentWithTrans />
            <ExtendedComponent />
            <PureComponent t={t} />
    </div>
    )
})