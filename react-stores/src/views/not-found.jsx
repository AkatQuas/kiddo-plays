import React, { Fragment } from 'react';

export default _ => {

    const lang = navigator['browserLanguage'] ? navigator['browserLanguage'] : navigator.language;
    const isEn = lang.indexOf('en') > -1;
    
    return (
        <Fragment>
            <div className="page-404">
                <div className="tips">
                    <h1>{isEn ? 'Page not found.': '页面不存在。'}</h1>
                    <h4>{isEn ? 'Error 404.': '休息一下，返回瞧瞧吧'}</h4>
                </div>
            </div>
            <style jsx>{`
                .page-404 {
                    text-align: center;
                    margin-top: 16px;
                
                    .tips {
                        color: red;
                        h1 {
                            color: #59a9f0;
                            font-size: 20px;
                        }
                        h4 {
                            font-size: 16px;
                            color: #b8b8b8;
                        }
                    }
                }
            `}</style>
        </Fragment>
    );
};