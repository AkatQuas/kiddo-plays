import React from 'react';
import Header from '../components/header';
import { withI18next } from '../lib/withI18next';

export default withI18next(['activity'])(({ t, initialI18nStore }) => {
    const staff = t('activity:staff', { returnObjects: true, em: 'aNewStaff', joinArrays: '->'});

    return (
        <div>
            <Header />
            <p> We have an array here! </p>
            {
                t('activity:activities', { returnObjects: true }).map(i => (
                    <div key={i.name}>{i.time} -> {i.name} </div>
                ))
            }
            <p>{staff}</p>
    </div>
    )
})