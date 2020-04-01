import React, { Fragment } from 'react';
import Router from 'next/router';
import { I18n } from 'react-i18next';

// export default ({i18n}) => {
export default () => {
    const jump = path => Router.push({
        pathname: path,
    })
    const lang = [
        {
            l: 'cn',
            label: '中文'
        },
        {
            l: 'en',
            label: 'English'
        }
    ]

    const links = [
        { path: '/', label: 'home' },
        { path: '/about', label: 'about' },
        { path: '/activity', label: 'activity' },
    ]
    return (
        <Fragment>
            <div className="header">
                <div className="links">
                    {
                        links.map(i => (
                            <div key={i.path} onClick={_ => jump(i.path)}>{i.label}</div>
                        ))
                    }

                </div>
                <I18n>
                    {
                        (t, { i18n }) => (

                            <div className="language">
                                {
                                    lang.map(i => (
                                        <span key={i.l} onClick={_ => i18n.changeLanguage(i.l)}>{i.label}</span>
                                    ))
                                }
                            </div>
                        )
                    }
                </I18n>
            </div>
            <style jsx>{`
            .header { 
                display: flex;
                padding: 10px;
            
                .links {
                    display: flex;
                    justify-content: space-around;
                    flex: 3;
                }
                .language {
                    display: flex;
                    flex: 2;
                    justify-content: flex-end;
                    span {
                        padding: 0 10px;
                        color: aqua;
                    }
                }
            }
        `}</style>
        </Fragment>
    )
}