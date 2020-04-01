import React, { Fragment } from 'react';
import PropTypes from 'prop-types';

const Link = ({
    active,
    children,
    onClick
}) => active ? (
    <Fragment>
        <span>{children}</span>
        <style jsx>{`
            span {
                padding: 10px 15px;
                color: aliceblue;
                background-color: aquamarine;
                margin-right: 10px;
            }
        `}</style>
    </Fragment>
) : (
            <Fragment>
                <a href="" onClick={e => {
                    e.preventDefault();
                    onClick();
                }}>{children}</a>
                <style jsx>{`
                    a {
                        padding: 10px 15px;
                        text-decoration: none;
                        border: 1px solid aliceblue;
                        margin-right: 10px;
                    }
                `}</style>
            </Fragment>
        )

Link.propTypes = {
    active: PropTypes.bool.isRequired,
    children: PropTypes.node.isRequired,
    onClick: PropTypes.func.isRequired
}

export default Link