import React, { Fragment } from 'react'
import { translate } from 'react-i18next'
export default translate()(props => {
    console.log(props.i18n.language)
    const langs = [
        {
            l: 'en',
            t: 'English'
        },
        {
            l: 'cn',
            t: 'CHINESE'
        }
    ]
    const { i18n } = props;
    return (
        <Fragment>
            <h1>
                {langs.map(i => (
                    <span key={i.l} onClick={ _ => i18n.changeLanguage(i.l) }>{i.t}</span>
                ))}
            </h1>
            <style jsx>{`
            h1  span {
                margin: 0 20px;
            }
            `}</style>
        </Fragment>
    )
})